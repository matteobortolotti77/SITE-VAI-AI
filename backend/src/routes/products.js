import { getDb } from '../db/client.js';
import { config } from '../config.js';

export default async function productsRoutes(app) {

    // GET /products → lista produtos ativos
    app.get('/products', async (request, reply) => {
        if (!config.isReady()) {
            return reply.code(503).send({
                error: 'service_not_configured',
                message: 'Backend ainda não configurado. Preencha .env (SUPABASE_*).'
            });
        }
        const db = getDb();
        const { data, error } = await db
            .from('products')
            .select('id, slug, type, name, description, price_full, price_deposit, capacity, departure_times, child_min_age, child_discount, infant_max_age, requires_cnh, accordion_data, photos, bg_gradient, translations, sort_order')
            .eq('active', true)
            .order('sort_order', { ascending: true });

        if (error) return reply.code(500).send({ error: error.message });
        return { products: data };
    });

    // GET /products/:slug → detalhe
    app.get('/products/:slug', async (request, reply) => {
        if (!config.isReady()) return reply.code(503).send({ error: 'service_not_configured' });
        const db = getDb();
        const { data, error } = await db
            .from('products')
            .select('*')
            .eq('slug', request.params.slug)
            .eq('active', true)
            .maybeSingle();

        if (error) return reply.code(500).send({ error: error.message });
        if (!data) return reply.code(404).send({ error: 'not_found' });
        return data;
    });

    // GET /availability?product_id=&date=
    app.get('/availability', async (request, reply) => {
        if (!config.isReady()) return reply.code(503).send({ error: 'service_not_configured' });
        const { product_id, date } = request.query;
        if (!product_id || !date) {
            return reply.code(400).send({ error: 'missing_params', need: ['product_id', 'date'] });
        }
        const db = getDb();
        const { data, error } = await db
            .from('availability')
            .select('product_id, departure_time, seats_left')
            .eq('product_id', product_id)
            .eq('travel_date', date);

        if (error) return reply.code(500).send({ error: error.message });
        return { availability: data || [] };
    });
}
