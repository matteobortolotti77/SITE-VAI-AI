import { config } from '../config.js';

export default async function healthRoutes(app) {
    app.get('/health', async () => ({
        ok: true,
        env: config.env,
        ready: config.isReady(),
        services: {
            supabase: !!config.supabase.url,
            mercadopago: !!config.mp.accessToken,
        },
        ts: new Date().toISOString()
    }));
}
