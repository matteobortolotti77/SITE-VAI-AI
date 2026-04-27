// Configuração — lê variáveis de ambiente
// Em dev: passar via `node --env-file=.env src/server.js` (Node 22+)
// Em prod: setar no provedor (Railway/Render)

function optional(name, fallback) {
    return process.env[name] || fallback;
}

export const config = {
    port: Number(optional('PORT', 3000)),
    env: optional('NODE_ENV', 'development'),
    corsOrigin: optional('CORS_ORIGIN', 'http://localhost:8765').split(',').map(s => s.trim()),

    supabase: {
        url: optional('SUPABASE_URL', ''),
        anonKey: optional('SUPABASE_ANON_KEY', ''),
        serviceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY', ''),
    },

    mp: {
        accessToken: optional('MP_ACCESS_TOKEN', ''),
        webhookSecret: optional('MP_WEBHOOK_SECRET', ''),
    },

    isReady() {
        // Read-only: precisa só de SUPABASE_URL + (service_role OU anon)
        return !!(this.supabase.url && (this.supabase.serviceRoleKey || this.supabase.anonKey));
    },
    canWrite() {
        // Writes (POST /reservations etc) exigem service_role
        return !!(this.supabase.url && this.supabase.serviceRoleKey);
    },
    canCharge() {
        // Pagamentos exigem MercadoPago
        return !!this.mp.accessToken;
    }
};
