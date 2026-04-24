// Cliente Supabase com service_role (acesso total — só backend usa)
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _client = null;

export function getDb() {
    if (_client) return _client;
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
        throw new Error('Supabase não configurado — preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
    }
    _client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
        auth: { persistSession: false }
    });
    return _client;
}
