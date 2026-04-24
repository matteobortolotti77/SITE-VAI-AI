// Configuração — lê variáveis de ambiente
// Em dev: passar via `node --env-file=.env src/server.js` (Node 22+)
// Em prod: setar no provedor (Railway/Render)

function required(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Variável de ambiente faltando: ${name}`);
    }
    return value;
}

function optional(name, fallback) {
    return process.env[name] || fallback;
}

export const config = {
    port: Number(optional('PORT', 3000)),
    env: optional('NODE_ENV', 'development'),
    corsOrigin: optional('CORS_ORIGIN', 'http://localhost:8765'),

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
        return !!(this.supabase.url && this.supabase.serviceRoleKey && this.mp.accessToken);
    }
};
