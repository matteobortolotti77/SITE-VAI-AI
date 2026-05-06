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

    resend: {
        apiKey: optional('RESEND_API_KEY', ''),
        from: optional('RESEND_FROM', 'reservas@voltaailha.com.br'),
    },

    zapi: {
        instanceId: optional('Z_API_INSTANCE_ID', ''),
        token: optional('Z_API_TOKEN', ''),
        whatsappNumber: optional('Z_API_WHATSAPP_NUMBER', '5575998240043'),
    },

    isReady() {
        return !!(this.supabase.url && (this.supabase.serviceRoleKey || this.supabase.anonKey));
    },
    canWrite() {
        return !!(this.supabase.url && this.supabase.serviceRoleKey);
    },
    canCharge() {
        return !!this.mp.accessToken;
    },
    canNotify() {
        return !!(this.resend.apiKey && this.zapi.instanceId && this.zapi.token);
    }
};
