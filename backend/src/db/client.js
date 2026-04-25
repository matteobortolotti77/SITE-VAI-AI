// Cliente Supabase. Prefere service_role (acesso total, p/ writes).
// Cai em anon se service_role faltar — útil pra testar leitura sem ela ainda.
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _client = null;

export function getDb() {
    if (_client) return _client;
    if (!config.supabase.url) {
        throw new Error('SUPABASE_URL faltando no .env');
    }
    const key = config.supabase.serviceRoleKey || config.supabase.anonKey;
    if (!key) {
        throw new Error('Nem SUPABASE_SERVICE_ROLE_KEY nem SUPABASE_ANON_KEY no .env');
    }
    _client = createClient(config.supabase.url, key, {
        auth: { persistSession: false }
    });
    return _client;
}
