// POST /v1/reservations — cria carrinho com N reservas + preferência MercadoPago
// POST /v1/reservations/cart/:cart_id/passengers — completa dados após pagamento
// GET  /v1/reservations/cart/:cart_id — status público do carrinho

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client.js';
import { config } from '../config.js';
import { createPreference } from '../services/mercadopago.js';
import { computeAmounts, validateQty } from '../services/pricing.js';
import { isUrgent } from '../services/cutoff.js';

// === Schemas Zod ===
const cartItemSchema = z.object({
    product_slug: z.string().min(1),
    travel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'travel_date deve ser YYYY-MM-DD'),
    departure_time: z.string().min(1),
    qty_adults: z.number().int().min(1),
    qty_children: z.number().int().min(0).default(0),
    qty_infants: z.number().int().min(0).default(0)
});

// WhatsApp em E.164: + seguido de 8-15 dígitos
const whatsappRegex = /^\+\d{8,15}$/;

const createReservationSchema = z.object({
    customer: z.object({
        name: z.string().min(2, 'Nome muito curto'),
        whatsapp: z.string().regex(whatsappRegex, 'WhatsApp em formato inválido (use +<código país><número>)'),
        email: z.string().email().optional().nullable(),
        locale: z.string().optional().default('pt-BR')
    }),
    items: z.array(cartItemSchema).min(1).max(10),
    return_urls: z.object({
        success: z.string().url(),
        failure: z.string().url(),
        pending: z.string().url().optional()
    })
}).refine(data => {
    // Email obrigatório se WhatsApp não-BR
    const isBrazil = data.customer.whatsapp.startsWith('+55');
    return isBrazil || (data.customer.email && data.customer.email.length > 0);
}, { message: 'Email é obrigatório para clientes com WhatsApp internacional', path: ['customer', 'email'] });

const passengerSchema = z.object({
    reservation_id: z.string().uuid(),
    full_name: z.string().min(2),
    doc_type: z.enum(['cpf', 'passport']),
    doc_number: z.string().min(4).max(20),
    age_group: z.enum(['adult', 'child'])
});

const passengersPayloadSchema = z.object({
    passengers: z.array(passengerSchema).min(1).max(50)
});

// === Helpers ===
function isCpfValid(cpf) {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (d1 !== parseInt(digits[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    let d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    return d2 === parseInt(digits[10]);
}

async function upsertCustomer(db, customerData) {
    // Tenta achar customer existente por whatsapp; senão cria
    const { data: existing } = await db
        .from('customers')
        .select('id')
        .eq('whatsapp', customerData.whatsapp)
        .maybeSingle();

    if (existing) {
        // Atualiza nome/email/locale (podem ter mudado)
        await db.from('customers').update({
            name: customerData.name,
            email: customerData.email || null,
            locale: customerData.locale
        }).eq('id', existing.id);
        return existing.id;
    }

    const { data: created, error } = await db.from('customers').insert({
        name: customerData.name,
        whatsapp: customerData.whatsapp,
        email: customerData.email || null,
        locale: customerData.locale
    }).select('id').single();

    if (error) throw new Error(`Falha ao criar customer: ${error.message}`);
    return created.id;
}

// === Rotas ===
export default async function reservationsRoutes(app) {

    // POST /v1/reservations
    app.post('/reservations', async (request, reply) => {
        if (!config.canWrite()) {
            return reply.code(503).send({ error: 'service_not_configured', message: 'Backend sem service_role' });
        }
        if (!config.canCharge()) {
            return reply.code(503).send({ error: 'mp_not_configured', message: 'MercadoPago não configurado' });
        }

        // 1. Valida payload
        const parse = createReservationSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });
        }
        const payload = parse.data;
        const db = getDb();

        // 2. Busca produtos referenciados
        const slugs = [...new Set(payload.items.map(it => it.product_slug))];
        const { data: products, error: prodErr } = await db
            .from('products')
            .select('*')
            .in('slug', slugs)
            .eq('active', true);

        if (prodErr) return reply.code(500).send({ error: 'db_error', message: prodErr.message });
        if (!products || products.length !== slugs.length) {
            const found = new Set((products || []).map(p => p.slug));
            const missing = slugs.filter(s => !found.has(s));
            return reply.code(404).send({ error: 'product_not_found', missing });
        }
        const productBySlug = Object.fromEntries(products.map(p => [p.slug, p]));

        // 3. Valida cada item: D-0, qty, capacity
        for (const item of payload.items) {
            const product = productBySlug[item.product_slug];
            if (isUrgent(product, item.travel_date)) {
                return reply.code(422).send({
                    error: 'cutoff_exceeded',
                    message: 'Reservas para hoje após o horário de corte devem ser feitas via WhatsApp',
                    product_slug: item.product_slug
                });
            }
            const qtyError = validateQty(product, {
                adults: item.qty_adults,
                children: item.qty_children,
                infants: item.qty_infants
            });
            if (qtyError) {
                return reply.code(422).send({ error: 'invalid_qty', message: qtyError, product_slug: item.product_slug });
            }
        }

        // 4. Lock + verificação de disponibilidade (per produto/data/horário)
        // Usa view availability — não dá pra FOR UPDATE em view, então fazemos check simples
        // Numa segunda iteração: SELECT FOR UPDATE direto na tabela reservations
        for (const item of payload.items) {
            const product = productBySlug[item.product_slug];
            const { data: avail, error: availErr } = await db
                .from('availability')
                .select('seats_left')
                .eq('product_id', product.id)
                .eq('travel_date', item.travel_date)
                .eq('departure_time', item.departure_time)
                .maybeSingle();

            const seatsLeft = avail ? avail.seats_left : product.capacity;
            const seatsNeeded = product.pricing_mode === 'per_vehicle'
                ? 1
                : (item.qty_adults + item.qty_children);

            if (seatsLeft < seatsNeeded) {
                return reply.code(409).send({
                    error: 'no_availability',
                    product_slug: item.product_slug,
                    travel_date: item.travel_date,
                    departure_time: item.departure_time,
                    seats_left: seatsLeft,
                    seats_needed: seatsNeeded
                });
            }
        }

        // 5. Upsert customer
        const customerId = await upsertCustomer(db, payload.customer);

        // 6. Cria N reservas com mesmo cart_id
        const cartId = randomUUID();
        const reservationsToInsert = payload.items.map(item => {
            const product = productBySlug[item.product_slug];
            const amounts = computeAmounts(product, {
                adults: item.qty_adults,
                children: item.qty_children,
                infants: item.qty_infants
            });
            return {
                cart_id: cartId,
                customer_id: customerId,
                product_id: product.id,
                travel_date: item.travel_date,
                departure_time: item.departure_time,
                qty_adults: item.qty_adults,
                qty_children: item.qty_children,
                qty_infants: item.qty_infants,
                amount_deposit: amounts.deposit,
                amount_remaining: amounts.remaining,
                amount_total: amounts.total,
                status: 'pending_payment',
                gateway: 'mercadopago'
            };
        });

        const { data: insertedReservations, error: insErr } = await db
            .from('reservations')
            .insert(reservationsToInsert)
            .select('id, product_id, amount_deposit, amount_total');

        if (insErr) return reply.code(500).send({ error: 'db_insert_failed', message: insErr.message });

        // 7. Cria preference MP somando os deposits
        const mpItems = payload.items.map(item => {
            const product = productBySlug[item.product_slug];
            const amounts = computeAmounts(product, {
                adults: item.qty_adults,
                children: item.qty_children,
                infants: item.qty_infants
            });
            const paxLabel = product.pricing_mode === 'per_vehicle'
                ? `1 veículo`
                : `${item.qty_adults + item.qty_children} pax`;
            return {
                title: `${product.name} (${item.travel_date} ${item.departure_time}, ${paxLabel}) — sinal`,
                quantity: 1,
                unit_price: amounts.deposit
            };
        });

        let preferenceResult;
        try {
            preferenceResult = await createPreference({
                cartId,
                items: mpItems,
                payer: {
                    name: payload.customer.name,
                    email: payload.customer.email
                },
                urls: {
                    success: payload.return_urls.success,
                    failure: payload.return_urls.failure,
                    pending: payload.return_urls.pending || payload.return_urls.success
                }
            });
        } catch (e) {
            // Rollback: marca as reservas como canceladas pra liberar vagas
            await db.from('reservations')
                .update({ status: 'cancelled_force_majeure', notes: 'MP preference failed: ' + e.message })
                .eq('cart_id', cartId);
            return reply.code(502).send({ error: 'mp_preference_failed', message: e.message });
        }

        // 8. Salva preference_id em todas as reservas do cart
        await db.from('reservations')
            .update({ gateway_payment_id: preferenceResult.preferenceId })
            .eq('cart_id', cartId);

        return reply.code(201).send({
            cart_id: cartId,
            reservations: insertedReservations.map(r => ({
                id: r.id,
                amount_deposit: r.amount_deposit,
                amount_total: r.amount_total
            })),
            preference_id: preferenceResult.preferenceId,
            init_point: preferenceResult.init_point,
            sandbox_init_point: preferenceResult.sandbox_init_point
        });
    });

    // GET /v1/reservations/cart/:cart_id
    app.get('/reservations/cart/:cart_id', async (request, reply) => {
        if (!config.isReady()) return reply.code(503).send({ error: 'service_not_configured' });
        const db = getDb();
        const { data, error } = await db
            .from('reservations')
            .select('id, status, travel_date, departure_time, qty_adults, qty_children, qty_infants, amount_deposit, amount_total, products(slug, name, pricing_mode)')
            .eq('cart_id', request.params.cart_id);
        if (error) return reply.code(500).send({ error: error.message });
        if (!data || data.length === 0) return reply.code(404).send({ error: 'not_found' });
        return { cart_id: request.params.cart_id, reservations: data };
    });

    // POST /v1/reservations/cart/:cart_id/passengers
    app.post('/reservations/cart/:cart_id/passengers', async (request, reply) => {
        if (!config.canWrite()) return reply.code(503).send({ error: 'service_not_configured' });

        const parse = passengersPayloadSchema.safeParse(request.body);
        if (!parse.success) return reply.code(400).send({ error: 'invalid_payload', issues: parse.error.issues });

        const { passengers } = parse.data;
        const db = getDb();

        // Confere que todas as reservation_ids pertencem ao cart_id
        const { data: validReservations, error: rErr } = await db
            .from('reservations')
            .select('id')
            .eq('cart_id', request.params.cart_id);
        if (rErr) return reply.code(500).send({ error: rErr.message });
        const validIds = new Set((validReservations || []).map(r => r.id));
        const invalid = passengers.filter(p => !validIds.has(p.reservation_id));
        if (invalid.length > 0) {
            return reply.code(400).send({ error: 'reservation_mismatch', cart_id: request.params.cart_id });
        }

        // Valida CPFs (passport não tem checksum)
        for (const p of passengers) {
            if (p.doc_type === 'cpf' && !isCpfValid(p.doc_number)) {
                return reply.code(400).send({ error: 'invalid_cpf', passenger_name: p.full_name });
            }
        }

        // Insere todos (substitui se já existiam — primeiro deleta os antigos)
        await db.from('passengers')
            .delete()
            .in('reservation_id', [...validIds]);

        const { data: inserted, error: insErr } = await db.from('passengers')
            .insert(passengers.map(p => ({
                reservation_id: p.reservation_id,
                full_name: p.full_name,
                doc_type: p.doc_type,
                doc_number: p.doc_number.replace(/\D/g, ''),  // normaliza CPF; passport mantém alfanumérico → vamos tratar abaixo
                age_group: p.age_group
            })).map((p, i) => {
                // Restaura número original pra passport (alfanumérico)
                const original = passengers[i];
                if (original.doc_type === 'passport') {
                    p.doc_number = original.doc_number.trim().toUpperCase();
                }
                return p;
            }))
            .select('id');

        if (insErr) return reply.code(500).send({ error: insErr.message });
        return reply.code(201).send({ passengers_saved: inserted.length });
    });
}
