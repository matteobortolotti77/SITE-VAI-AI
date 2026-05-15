// Rotas /admin/* — todas protegidas por verifyAdmin (preHandler).
// Fase 2: reservations list/detail/patch-status. Refund autoritativo server-side.
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { verifyAdmin } from '../middleware/auth.js';
import { getDb } from '../db/client.js';
import { config } from '../config.js';
import { calculateRefund, isValidTransition } from '../services/refund.js';
import { refundPayment } from '../services/mercadopago.js';
import { sendWhatsAppText, buildProviderDailyList } from '../services/whatsapp.js';
import { uploadProductPhoto, deleteProductPhoto, getVoucherSignedUrl } from '../services/storage.js';

const RESERVATION_STATUSES = [
    'pending_payment',
    'deposit_paid',
    'fully_paid',
    'cancelled_noshow',
    'cancelled_force_majeure',
    'rescheduled',
];

const listQuerySchema = z.object({
    status: z.enum(RESERVATION_STATUSES).optional(),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    product_slug: z.string().optional(),
    cart_id: z.string().uuid().optional(),
    q: z.string().min(1).max(80).optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum([
        'created_desc', 'created_asc',
        'travel_asc', 'travel_desc',
        'amount_desc', 'amount_asc',
        'commission_desc', 'commission_asc',
        'status_asc', 'status_desc',
    ]).default('created_desc'),
});

const patchStatusSchema = z.object({
    to_status: z.enum(RESERVATION_STATUSES),
    reason: z.string().max(500).optional(),
});

const PRODUCT_TYPES = ['passeio', 'atividade', 'passagem_ida', 'passagem_volta'];
const PRICING_MODES = ['per_person', 'per_vehicle'];

const productShape = z.object({
    type: z.enum(PRODUCT_TYPES),
    slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, 'slug: a-z 0-9 e hífen apenas'),
    name: z.string().min(2).max(200),
    description: z.string().max(500).optional().nullable(),
    price_full: z.number().nonnegative(),
    price_deposit: z.number().nonnegative().optional().nullable(),
    pricing_mode: z.enum(PRICING_MODES).default('per_person'),
    vehicle_capacity: z.number().int().positive().optional().nullable(),
    insurance_per_pax: z.number().nonnegative().optional().nullable(),
    capacity: z.number().int().min(0),
    departure_times: z.array(z.string()).default([]),
    cutoff_hour: z.number().int().min(0).max(23).default(8),
    cutoff_minute: z.number().int().min(0).max(59).default(30),
    child_min_age: z.number().int().min(0).max(17).optional().nullable(),
    child_discount: z.number().min(0).max(1).optional().nullable(),
    infant_max_age: z.number().int().min(0).max(17).default(5),
    requires_cnh: z.boolean().default(false),
    bg_gradient: z.string().max(200).optional().nullable(),
    sort_order: z.number().int().default(0),
    active: z.boolean().default(true),
    provider_id: z.string().uuid().optional().nullable(),
});

const productBaseSchema = productShape.refine(d => d.pricing_mode !== 'per_vehicle' || d.vehicle_capacity, {
    message: 'vehicle_capacity obrigatório quando pricing_mode=per_vehicle',
    path: ['vehicle_capacity'],
});

const productPatchSchema = productShape.partial();

const providerShape = z.object({
    name: z.string().min(2).max(120),
    whatsapp: z.string().regex(/^\+\d{8,15}$/, 'WhatsApp em E.164 (+...)'),
    email: z.string().email().optional().nullable(),
    active: z.boolean().default(true),
});
const providerPatchSchema = providerShape.partial();

const providerProductSchema = z.object({
    product_id: z.string().uuid(),
    commission_value: z.number().nonnegative(),
    active: z.boolean().default(true),
});

const commissionPatchSchema = z.object({
    commission_amount: z.number().nonnegative(),
    reason: z.string().max(500).optional(),
});

const accordionsSchema = z.object({
    accordion_data: z.array(z.object({
        title: z.string().min(1),
        body_html: z.string(),
    })).max(20),
});

const childPolicySchema = z.object({
    child_min_age: z.number().int().min(0).max(17).optional().nullable(),
    child_discount: z.number().min(0).max(1).optional().nullable(),
    infant_max_age: z.number().int().min(0).max(17),
});

export default async function adminRoutes(app) {
    app.addHook('preHandler', verifyAdmin);

    // Smoke test
    app.get('/admin/ping', async (request) => ({
        ok: true,
        admin: request.adminUser.email,
        ts: new Date().toISOString(),
    }));

    // ---------- GET /admin/reservations ----------
    app.get('/admin/reservations', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });

        const parse = listQuerySchema.safeParse(request.query);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_query', issues: parse.error.issues });
        const q = parse.data;

        const db = getDb();
        let query = db
            .from('reservations')
            .select(`
                id, cart_id, status, travel_date, departure_time,
                qty_adults, qty_children, qty_infants,
                amount_deposit, amount_remaining, amount_total, commission_amount,
                gateway_payment_id, customer_ack_at, created_at, updated_at,
                customer:customers(id, name, whatsapp, email, locale),
                product:products(id, slug, name, type, pricing_mode),
                provider:providers(id, name, whatsapp)
            `, { count: 'exact' });

        if (q.status) query = query.eq('status', q.status);
        if (q.from_date) query = query.gte('travel_date', q.from_date);
        if (q.to_date) query = query.lte('travel_date', q.to_date);
        if (q.cart_id) query = query.eq('cart_id', q.cart_id);
        if (q.product_slug) {
            const { data: prod } = await db.from('products').select('id').eq('slug', q.product_slug).maybeSingle();
            if (!prod) return { items: [], total: 0, page: q.page, page_size: q.page_size };
            query = query.eq('product_id', prod.id);
        }
        if (q.q) {
            // Sanitize: PostgREST .or() usa `,` como separador, `(`/`)` para grouping.
            // Strip esses chars + `\` para evitar filter injection.
            const safe = q.q.replace(/[,()\\]/g, '');
            if (!safe) return { items: [], total: 0, page: q.page, page_size: q.page_size };
            const { data: cids } = await db
                .from('customers')
                .select('id')
                .or(`name.ilike.%${safe}%,whatsapp.ilike.%${safe}%,email.ilike.%${safe}%`);
            const ids = (cids || []).map(c => c.id);
            if (ids.length === 0) return { items: [], total: 0, page: q.page, page_size: q.page_size };
            query = query.in('customer_id', ids);
        }

        const sortMap = {
            created_desc: ['created_at', false],
            created_asc: ['created_at', true],
            travel_asc: ['travel_date', true],
            travel_desc: ['travel_date', false],
            amount_desc: ['amount_total', false],
            amount_asc: ['amount_total', true],
            commission_desc: ['commission_amount', false],
            commission_asc: ['commission_amount', true],
            status_asc: ['status', true],
            status_desc: ['status', false],
        };
        const [sortCol, sortAsc] = sortMap[q.sort];
        query = query.order(sortCol, { ascending: sortAsc });

        const from = (q.page - 1) * q.page_size;
        const to = from + q.page_size - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });

        return { items: data || [], total: count || 0, page: q.page, page_size: q.page_size };
    });

    // ---------- GET /admin/reservations/:id ----------
    app.get('/admin/reservations/:id', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });

        const db = getDb();
        const { data: r, error } = await db
            .from('reservations')
            .select(`
                *,
                customer:customers(*),
                product:products(id, slug, name, type, pricing_mode, vehicle_capacity, departure_times),
                passengers(*),
                payments(*)
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        if (!r) return reply.code(404).send({ error: 'not_found' });

        const [{ data: notifications }, { data: audit }] = await Promise.all([
            db.from('notifications')
                .select('*')
                .eq('reservation_id', id)
                .order('created_at', { ascending: false })
                .limit(50),
            db.from('reservation_audit_log')
                .select('*')
                .eq('reservation_id', id)
                .order('created_at', { ascending: false })
                .limit(50),
        ]);

        // Pré-calcula refund quote para cada transição válida (UI mostra antes de confirmar)
        const refund_quote = {};
        for (const target of RESERVATION_STATUSES) {
            if (isValidTransition(r.status, target)) {
                refund_quote[target] = calculateRefund(r, target);
            }
        }

        return {
            ...r,
            notifications: notifications || [],
            audit_log: audit || [],
            refund_quote,
        };
    });

    // ---------- PATCH /admin/reservations/:id/status ----------
    app.patch('/admin/reservations/:id/status', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });

        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });

        const parse = patchStatusSchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        const { to_status, reason } = parse.data;

        const idempotencyKey = request.headers['idempotency-key'];
        if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length > 200) {
            return reply.code(400).send({ error: 'missing_idempotency_key' });
        }

        const db = getDb();
        const requestHash = createHash('sha256')
            .update(JSON.stringify({ id, to_status, reason: reason || null }))
            .digest('hex');

        // Idempotency replay
        const { data: existing } = await db
            .from('idempotency_keys')
            .select('*')
            .eq('key', idempotencyKey)
            .maybeSingle();

        if (existing) {
            if (existing.request_hash !== requestHash) {
                return reply.code(409).send({ error: 'idempotency_conflict', message: 'Mesma key, payload diferente' });
            }
            return reply.code(existing.response_status).send(existing.response_body);
        }

        // Lock + leitura via RPC (SELECT FOR UPDATE)
        const { data: locked, error: lockErr } = await db.rpc('lock_reservation', { p_id: id });
        if (lockErr) return reply.code(500).send({ error: 'lock_failed', message: lockErr.message });
        if (!locked) return reply.code(404).send({ error: 'not_found' });

        // Valida transição
        if (!isValidTransition(locked.status, to_status)) {
            return reply.code(422).send({
                error: 'invalid_transition',
                from: locked.status,
                to: to_status,
            });
        }

        // Calcula refund autoritativo
        const refund = calculateRefund(locked, to_status);

        // Executa refund no MP se necessário
        let refundGatewayId = null;
        let refundError = null;
        if (refund.refund_amount > 0) {
            const paidPayment = await findApprovedPayment(db, id);
            if (!paidPayment) {
                refundError = 'no_approved_payment_found';
            } else {
                try {
                    const mpResult = await refundPayment(paidPayment.gateway_id, refund.refund_amount);
                    refundGatewayId = mpResult.id;
                    await db.from('payments').insert({
                        reservation_id: id,
                        gateway: 'mercadopago',
                        gateway_id: mpResult.id,
                        type: 'refund',
                        amount: -Math.abs(refund.refund_amount),
                        status: mpResult.status,
                        gateway_payload: mpResult,
                    });
                } catch (e) {
                    refundError = e.message;
                }
            }

            if (refundError) {
                return reply.code(502).send({
                    error: 'refund_failed',
                    message: refundError,
                    refund_amount: refund.refund_amount,
                });
            }
        }

        // Atualiza status
        const { error: updErr } = await db
            .from('reservations')
            .update({ status: to_status })
            .eq('id', id);
        if (updErr) return reply.code(500).send({ error: 'update_failed', message: updErr.message });

        // Audit log
        await db.from('reservation_audit_log').insert({
            reservation_id: id,
            actor_id: request.adminUser.id,
            actor_email: request.adminUser.email,
            action: 'status_change',
            from_status: locked.status,
            to_status,
            reason: reason || null,
            refund_amount: refund.refund_amount || null,
            refund_gateway_id: refundGatewayId,
            metadata: { policy: refund.policy },
        });

        const responseBody = {
            ok: true,
            reservation_id: id,
            from_status: locked.status,
            to_status,
            refund: {
                amount: refund.refund_amount,
                policy: refund.policy,
                gateway_id: refundGatewayId,
            },
        };

        // Persist idempotency
        await db.from('idempotency_keys').insert({
            key: idempotencyKey,
            actor_id: request.adminUser.id,
            endpoint: 'PATCH /admin/reservations/:id/status',
            request_hash: requestHash,
            response_status: 200,
            response_body: responseBody,
        });

        return reply.code(200).send(responseBody);
    });

    // ---------- GET /admin/products ----------
    app.get('/admin/products', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const includeInactive = request.query.include_inactive === '1' || request.query.include_inactive === 'true';
        const db = getDb();
        let q = db.from('products').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true });
        if (!includeInactive) q = q.eq('active', true);
        const { data, error } = await q;
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        return { items: data || [] };
    });

    // ---------- GET /admin/products/:id ----------
    app.get('/admin/products/:id', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const db = getDb();
        const { data, error } = await db.from('products').select('*').eq('id', id).maybeSingle();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        if (!data) return reply.code(404).send({ error: 'not_found' });
        return data;
    });

    // ---------- POST /admin/products ----------
    app.post('/admin/products', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const parse = productBaseSchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        const db = getDb();
        const { data, error } = await db.from('products').insert(parse.data).select('*').single();
        if (error) {
            if (error.code === '23505') return reply.code(409).send({ error: 'slug_already_exists' });
            return reply.code(500).send({ error: 'db_error', message: error.message });
        }
        await logProductChange(db, request.adminUser, data.id, 'create', null, parse.data);
        return reply.code(201).send(data);
    });

    // ---------- PATCH /admin/products/:id ----------
    app.patch('/admin/products/:id', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const parse = productPatchSchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        if (Object.keys(parse.data).length === 0) return reply.code(400).send({ error: 'empty_patch' });
        const db = getDb();
        const { data: before } = await db.from('products').select('*').eq('id', id).maybeSingle();
        if (!before) return reply.code(404).send({ error: 'not_found' });
        const { data, error } = await db.from('products').update(parse.data).eq('id', id).select('*').single();
        if (error) {
            if (error.code === '23505') return reply.code(409).send({ error: 'slug_already_exists' });
            return reply.code(500).send({ error: 'db_error', message: error.message });
        }
        await logProductChange(db, request.adminUser, id, 'update', before, parse.data);
        return data;
    });

    // ---------- DELETE /admin/products/:id (soft delete) ----------
    app.delete('/admin/products/:id', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const db = getDb();
        const { data, error } = await db.from('products').update({ active: false }).eq('id', id).select('id, slug, active').single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        if (!data) return reply.code(404).send({ error: 'not_found' });
        await logProductChange(db, request.adminUser, id, 'soft_delete', null, { active: false });
        return data;
    });

    // ---------- PATCH /admin/products/:id/accordions ----------
    app.patch('/admin/products/:id/accordions', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const parse = accordionsSchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        const db = getDb();
        const { data, error } = await db.from('products')
            .update({ accordion_data: parse.data.accordion_data })
            .eq('id', id)
            .select('id, accordion_data')
            .single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        if (!data) return reply.code(404).send({ error: 'not_found' });
        await logProductChange(db, request.adminUser, id, 'accordions_update', null, parse.data);
        return data;
    });

    // ---------- PATCH /admin/products/:id/child-policy ----------
    app.patch('/admin/products/:id/child-policy', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const parse = childPolicySchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        const db = getDb();
        const { data, error } = await db.from('products')
            .update(parse.data)
            .eq('id', id)
            .select('id, child_min_age, child_discount, infant_max_age')
            .single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        if (!data) return reply.code(404).send({ error: 'not_found' });
        await logProductChange(db, request.adminUser, id, 'child_policy_update', null, parse.data);
        return data;
    });

    // ---------- GET /admin/reservations/:id/voucher — fresh signed URL ----------
    app.get('/admin/reservations/:id/voucher', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        try {
            const url = await getVoucherSignedUrl(id);
            return { url, expires_in: 7 * 24 * 3600 };
        } catch (e) {
            return reply.code(404).send({ error: 'voucher_not_found', message: e.message });
        }
    });

    // ---------- POST /admin/products/:id/photos (multipart upload) ----------
    app.post('/admin/products/:id/photos', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });

        const file = await request.file();
        if (!file) return reply.code(400).send({ error: 'no_file' });

        const buffer = await file.toBuffer();
        if (buffer.length > 5 * 1024 * 1024) return reply.code(413).send({ error: 'file_too_large' });

        const db = getDb();
        const { data: prod } = await db.from('products').select('id, photos').eq('id', id).maybeSingle();
        if (!prod) return reply.code(404).send({ error: 'not_found' });

        let upload;
        try {
            upload = await uploadProductPhoto(id, buffer, file.mimetype);
        } catch (e) {
            return reply.code(400).send({ error: 'upload_failed', message: e.message });
        }

        const photos = [...(prod.photos || []), upload.url];
        const { data, error } = await db.from('products').update({ photos }).eq('id', id).select('id, photos').single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });

        await logProductChange(db, request.adminUser, id, 'photo_add', null, { url: upload.url });
        return reply.code(201).send(data);
    });

    // ---------- DELETE /admin/products/:id/photos/:idx ----------
    app.delete('/admin/products/:id/photos/:idx', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        const idx = Number(request.params.idx);
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        if (!Number.isInteger(idx) || idx < 0) return reply.code(400).send({ error: 'invalid_idx' });

        const db = getDb();
        const { data: prod } = await db.from('products').select('id, photos').eq('id', id).maybeSingle();
        if (!prod) return reply.code(404).send({ error: 'not_found' });

        const photos = [...(prod.photos || [])];
        if (idx >= photos.length) return reply.code(404).send({ error: 'photo_not_found' });

        const removed = photos.splice(idx, 1)[0];

        const { data, error } = await db.from('products').update({ photos }).eq('id', id).select('id, photos').single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });

        // Best-effort delete do file Storage (não aborta se falhar)
        deleteProductPhoto(removed).catch(err => request.log.warn({ err: err.message, removed }, 'photo storage delete failed'));

        await logProductChange(db, request.adminUser, id, 'photo_remove', null, { url: removed });
        return data;
    });

    // ---------- PATCH /admin/products/:id/photos/reorder ----------
    app.patch('/admin/products/:id/photos/reorder', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const order = request.body?.order;
        if (!Array.isArray(order)) return reply.code(400).send({ error: 'invalid_order' });

        const db = getDb();
        const { data: prod } = await db.from('products').select('id, photos').eq('id', id).maybeSingle();
        if (!prod) return reply.code(404).send({ error: 'not_found' });

        const current = prod.photos || [];
        if (order.length !== current.length) return reply.code(400).send({ error: 'order_length_mismatch' });
        const sortedOrder = [...order].sort((a, b) => a - b);
        for (let i = 0; i < sortedOrder.length; i++) {
            if (sortedOrder[i] !== i) return reply.code(400).send({ error: 'invalid_permutation' });
        }
        const reordered = order.map(i => current[i]);

        const { data, error } = await db.from('products').update({ photos: reordered }).eq('id', id).select('id, photos').single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        return data;
    });

    // ---------- GET /admin/analytics/sales ----------
    app.get('/admin/analytics/sales', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });

        const fromDate = request.query.from_date || isoDateOffset(-30);
        const toDate = request.query.to_date || isoDateOffset(0);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
            return reply.code(400).send({ error: 'invalid_date' });
        }

        const cacheKey = `sales:${fromDate}:${toDate}`;
        const cached = analyticsCache.get(cacheKey);
        if (cached && (Date.now() - cached.at) < 60_000) return cached.data;

        const db = getDb();
        const { data, error } = await db
            .from('reservations')
            .select('id, status, travel_date, amount_total, amount_deposit, commission_amount, created_at, product:products(id, slug, name)')
            .gte('created_at', `${fromDate}T00:00:00-03:00`)
            .lte('created_at', `${toDate}T23:59:59-03:00`);
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });

        const items = data || [];
        const summary = {
            from_date: fromDate,
            to_date: toDate,
            total_count: items.length,
            total_revenue: 0,
            total_deposits: 0,
            total_commissions: 0,
            by_status: {},
            by_product: {},
            by_day: {},
        };

        for (const r of items) {
            const total = Number(r.amount_total) || 0;
            const deposit = Number(r.amount_deposit) || 0;
            const commission = Number(r.commission_amount) || 0;
            const isPaid = r.status === 'deposit_paid' || r.status === 'fully_paid';

            if (isPaid) {
                summary.total_revenue += total;
                summary.total_deposits += deposit;
                summary.total_commissions += commission;
            }

            summary.by_status[r.status] = (summary.by_status[r.status] || 0) + 1;

            if (r.product) {
                const k = r.product.slug;
                if (!summary.by_product[k]) summary.by_product[k] = { name: r.product.name, count: 0, revenue: 0, commission: 0 };
                summary.by_product[k].count++;
                if (isPaid) {
                    summary.by_product[k].revenue += total;
                    summary.by_product[k].commission += commission;
                }
            }

            const day = r.created_at.slice(0, 10);
            if (!summary.by_day[day]) summary.by_day[day] = { count: 0, revenue: 0, commission: 0 };
            summary.by_day[day].count++;
            if (isPaid) {
                summary.by_day[day].revenue += total;
                summary.by_day[day].commission += commission;
            }
        }

        summary.total_revenue = round2(summary.total_revenue);
        summary.total_deposits = round2(summary.total_deposits);
        summary.total_commissions = round2(summary.total_commissions);
        for (const k in summary.by_product) {
            summary.by_product[k].revenue = round2(summary.by_product[k].revenue);
            summary.by_product[k].commission = round2(summary.by_product[k].commission);
        }
        for (const k in summary.by_day) {
            summary.by_day[k].revenue = round2(summary.by_day[k].revenue);
            summary.by_day[k].commission = round2(summary.by_day[k].commission);
        }

        analyticsCache.set(cacheKey, { at: Date.now(), data: summary });
        return summary;
    });

    // ---------- GET /admin/analytics/passengers-preview?date= ----------
    app.get('/admin/analytics/passengers-preview', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });

        const date = request.query.date || isoDateOffset(1);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply.code(400).send({ error: 'invalid_date' });

        const db = getDb();
        const { data, error } = await db
            .from('reservations')
            .select(`
                id, departure_time, qty_adults, qty_children, qty_infants, status,
                customer:customers(name, whatsapp),
                product:products(id, slug, name, provider_id, provider:providers(id, name, whatsapp))
            `)
            .eq('travel_date', date)
            .in('status', ['deposit_paid', 'fully_paid'])
            .order('departure_time', { ascending: true });
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });

        const reservations = data || [];
        // Agrupa por provider → product → time
        const groups = new Map();
        for (const r of reservations) {
            const provider = r.product?.provider;
            const provKey = provider?.id || 'no_provider';
            if (!groups.has(provKey)) {
                groups.set(provKey, {
                    provider: provider || { id: null, name: 'Sem fornecedor', whatsapp: null },
                    products: new Map(),
                });
            }
            const g = groups.get(provKey);
            const prodKey = r.product?.id || 'unknown';
            if (!g.products.has(prodKey)) {
                g.products.set(prodKey, { product: r.product, slots: new Map() });
            }
            const ps = g.products.get(prodKey);
            const slot = r.departure_time;
            if (!ps.slots.has(slot)) ps.slots.set(slot, []);
            ps.slots.get(slot).push(r);
        }

        const out = [];
        for (const [, g] of groups) {
            const products = [];
            for (const [, ps] of g.products) {
                const slots = [];
                for (const [time, list] of ps.slots) {
                    const pax = list.reduce((s, r) => s + r.qty_adults + r.qty_children + r.qty_infants, 0);
                    slots.push({
                        time,
                        pax_total: pax,
                        reservations: list.map(r => ({
                            id: r.id,
                            customer_name: r.customer?.name,
                            customer_whatsapp: r.customer?.whatsapp,
                            qty_adults: r.qty_adults,
                            qty_children: r.qty_children,
                            qty_infants: r.qty_infants,
                            status: r.status,
                        })),
                    });
                }
                products.push({ product: ps.product, slots });
            }
            out.push({ provider: g.provider, products });
        }

        return { date, providers: out, total_reservations: reservations.length };
    });

    // ---------- POST /admin/notifications/send-daily ----------
    app.post('/admin/notifications/send-daily', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        if (!config.canNotify()) return reply.code(503).send({ error: 'whatsapp_not_configured' });

        const { date } = request.body || {};
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply.code(400).send({ error: 'invalid_date' });

        const db = getDb();
        const { data: reservations, error } = await db
            .from('reservations')
            .select(`
                id, departure_time, qty_adults, qty_children, qty_infants,
                customer:customers(name, doc_number),
                product:products(id, name, provider:providers(id, name, whatsapp))
            `)
            .eq('travel_date', date)
            .in('status', ['deposit_paid', 'fully_paid']);
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });

        const items = reservations || [];
        if (items.length === 0) return { date, sent: 0, failed: 0, results: [], message: 'sem reservas para esta data' };

        // Agrupa por provider
        const byProvider = new Map();
        for (const r of items) {
            const provider = r.product?.provider;
            if (!provider?.whatsapp) continue;
            if (!byProvider.has(provider.id)) byProvider.set(provider.id, { provider, items: [] });
            byProvider.get(provider.id).items.push(r);
        }

        const travelDateBR = formatDateBR(date);
        const results = [];

        for (const [, g] of byProvider) {
            const passengers = g.items.map(r => ({
                name: r.customer?.name || 'Sem nome',
                doc: r.customer?.doc_number || '—',
                product: r.product?.name || '?',
                time: r.departure_time,
                qty: r.qty_adults + r.qty_children + r.qty_infants,
            }));
            const text = buildProviderDailyList({
                providerName: g.provider.name,
                travelDate: travelDateBR,
                passengers,
            });

            let status = 'sent';
            let errorMsg = null;
            try {
                await sendWhatsAppText(g.provider.whatsapp, text);
            } catch (e) {
                status = 'failed';
                errorMsg = e.message;
            }

            await db.from('notifications').insert({
                reservation_id: null,
                recipient_type: 'provider',
                channel: 'whatsapp',
                status,
                message_preview: text.slice(0, 500),
                sent_at: status === 'sent' ? new Date().toISOString() : null,
                error: errorMsg,
            });

            results.push({
                provider_id: g.provider.id,
                provider_name: g.provider.name,
                passenger_count: passengers.length,
                status,
                error: errorMsg,
            });
        }

        const sent = results.filter(r => r.status === 'sent').length;
        const failed = results.length - sent;

        await db.from('admin_audit_log').insert({
            actor_id: request.adminUser.id,
            actor_email: request.adminUser.email,
            entity: 'notification_batch',
            action: 'send_daily',
            metadata: { date, sent, failed, results },
        });

        return { date, sent, failed, results };
    });

    // ---------- PATCH /admin/reservations/:id/commission ----------
    app.patch('/admin/reservations/:id/commission', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const parse = commissionPatchSchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });

        const idempotencyKey = request.headers['idempotency-key'];
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            return reply.code(400).send({ error: 'missing_idempotency_key' });
        }

        const db = getDb();
        const requestHash = createHash('sha256')
            .update(JSON.stringify({ id, ...parse.data }))
            .digest('hex');

        const { data: existing } = await db
            .from('idempotency_keys')
            .select('*')
            .eq('key', idempotencyKey)
            .maybeSingle();
        if (existing) {
            if (existing.request_hash !== requestHash) return reply.code(409).send({ error: 'idempotency_conflict' });
            return reply.code(existing.response_status).send(existing.response_body);
        }

        const { data: before } = await db.from('reservations').select('id, commission_amount, amount_total').eq('id', id).maybeSingle();
        if (!before) return reply.code(404).send({ error: 'not_found' });

        if (parse.data.commission_amount > Number(before.amount_total)) {
            return reply.code(422).send({
                error: 'commission_exceeds_total',
                commission_amount: parse.data.commission_amount,
                amount_total: Number(before.amount_total),
            });
        }

        const { data: updated, error } = await db
            .from('reservations')
            .update({ commission_amount: parse.data.commission_amount })
            .eq('id', id)
            .select('id, commission_amount')
            .single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });

        await db.from('reservation_audit_log').insert({
            reservation_id: id,
            actor_id: request.adminUser.id,
            actor_email: request.adminUser.email,
            action: 'commission_change',
            reason: parse.data.reason || null,
            metadata: { from: Number(before.commission_amount), to: parse.data.commission_amount },
        });

        const responseBody = {
            ok: true,
            reservation_id: id,
            commission_amount: Number(updated.commission_amount),
            previous: Number(before.commission_amount),
        };
        await db.from('idempotency_keys').insert({
            key: idempotencyKey,
            actor_id: request.adminUser.id,
            endpoint: 'PATCH /admin/reservations/:id/commission',
            request_hash: requestHash,
            response_status: 200,
            response_body: responseBody,
        });
        return responseBody;
    });

    // ---------- GET /admin/providers ----------
    app.get('/admin/providers', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const db = getDb();
        const includeInactive = request.query.include_inactive === '1';
        let q = db.from('providers').select('*').order('name', { ascending: true });
        if (!includeInactive) q = q.eq('active', true);
        const { data, error } = await q;
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        return { items: data || [] };
    });

    // ---------- GET /admin/providers/:id ----------
    app.get('/admin/providers/:id', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const db = getDb();
        const { data: provider, error } = await db.from('providers').select('*').eq('id', id).maybeSingle();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        if (!provider) return reply.code(404).send({ error: 'not_found' });

        const { data: links } = await db
            .from('provider_products')
            .select('*, product:products(id, slug, name, type)')
            .eq('provider_id', id)
            .order('created_at', { ascending: false });

        return { ...provider, products: links || [] };
    });

    // ---------- POST /admin/providers ----------
    app.post('/admin/providers', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const parse = providerShape.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        const db = getDb();
        const { data, error } = await db.from('providers').insert(parse.data).select('*').single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        await db.from('admin_audit_log').insert({
            actor_id: request.adminUser.id,
            actor_email: request.adminUser.email,
            entity: 'provider',
            entity_id: data.id,
            action: 'create',
            patch_data: parse.data,
        });
        return reply.code(201).send(data);
    });

    // ---------- PATCH /admin/providers/:id ----------
    app.patch('/admin/providers/:id', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const parse = providerPatchSchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        if (Object.keys(parse.data).length === 0) return reply.code(400).send({ error: 'empty_patch' });
        const db = getDb();
        const { data: before } = await db.from('providers').select('*').eq('id', id).maybeSingle();
        if (!before) return reply.code(404).send({ error: 'not_found' });
        const { data, error } = await db.from('providers').update(parse.data).eq('id', id).select('*').single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        await db.from('admin_audit_log').insert({
            actor_id: request.adminUser.id,
            actor_email: request.adminUser.email,
            entity: 'provider',
            entity_id: id,
            action: 'update',
            before_data: { name: before.name, whatsapp: before.whatsapp, email: before.email, active: before.active },
            patch_data: parse.data,
        });
        return data;
    });

    // ---------- DELETE /admin/providers/:id (soft) ----------
    app.delete('/admin/providers/:id', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const id = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'invalid_id' });
        const db = getDb();
        const { data, error } = await db.from('providers').update({ active: false }).eq('id', id).select('id, active').single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        if (!data) return reply.code(404).send({ error: 'not_found' });
        return data;
    });

    // ---------- POST /admin/providers/:id/products (link or update commission) ----------
    app.post('/admin/providers/:id/products', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const providerId = request.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(providerId)) return reply.code(400).send({ error: 'invalid_id' });
        const parse = providerProductSchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        const db = getDb();
        const { data, error } = await db
            .from('provider_products')
            .upsert({
                provider_id: providerId,
                product_id: parse.data.product_id,
                commission_value: parse.data.commission_value,
                active: parse.data.active,
            }, { onConflict: 'provider_id,product_id' })
            .select('*')
            .single();
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        await db.from('admin_audit_log').insert({
            actor_id: request.adminUser.id,
            actor_email: request.adminUser.email,
            entity: 'provider_product',
            entity_id: data.id,
            action: 'upsert',
            patch_data: parse.data,
            metadata: { provider_id: providerId },
        });
        return data;
    });

    // ---------- DELETE /admin/providers/:provider_id/products/:product_id (unlink) ----------
    app.delete('/admin/providers/:provider_id/products/:product_id', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });
        const { provider_id: providerId, product_id: productId } = request.params;
        if (!/^[0-9a-f-]{36}$/i.test(providerId) || !/^[0-9a-f-]{36}$/i.test(productId)) {
            return reply.code(400).send({ error: 'invalid_id' });
        }
        const db = getDb();
        const { error } = await db
            .from('provider_products')
            .delete()
            .eq('provider_id', providerId)
            .eq('product_id', productId);
        if (error) return reply.code(500).send({ error: 'db_error', message: error.message });
        return { ok: true };
    });
}

const analyticsCache = new Map();

function isoDateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function formatDateBR(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function round2(n) { return Math.round(n * 100) / 100; }

async function logProductChange(db, actor, productId, action, before, patch) {
    await db.from('admin_audit_log').insert({
        actor_id: actor.id,
        actor_email: actor.email,
        entity: 'product',
        entity_id: productId,
        action,
        before_data: before ? compactBefore(before) : null,
        patch_data: patch || null,
    });
}

function compactBefore(row) {
    const keys = ['type','slug','name','price_full','price_deposit','pricing_mode','capacity','active','child_discount','infant_max_age','child_min_age','requires_cnh','vehicle_capacity','insurance_per_pax'];
    const out = {};
    for (const k of keys) if (row[k] !== undefined) out[k] = row[k];
    return out;
}

async function findApprovedPayment(db, reservationId) {
    const { data } = await db
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)
        .in('type', ['deposit', 'full'])
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data || null;
}
