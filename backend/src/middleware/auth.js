// Verifica JWT Supabase — suporta RS256 (JWKS) e HS256 (legacy secret).
// Role obrigatória em app_metadata (não user_metadata, que cliente edita).
import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { config } from '../config.js';

// Cache de JWKS em memória — TTL 1h
let jwksCache = null;
let jwksCacheAt = 0;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getJwks() {
    const now = Date.now();
    if (jwksCache && (now - jwksCacheAt) < JWKS_TTL_MS) return jwksCache;
    const res = await fetch(`${config.supabase.url}/auth/v1/.well-known/jwks.json`);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    jwksCache = await res.json();
    jwksCacheAt = now;
    return jwksCache;
}

function jwkToPem(jwk) {
    return createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
}

async function verifyToken(token) {
    // Decode header sem verificar para descobrir alg
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());

    if (header.alg === 'HS256') {
        if (!config.supabase.jwtSecret) throw Object.assign(new Error('HS256 secret not configured'), { code: 503 });
        return jwt.verify(token, config.supabase.jwtSecret, {
            algorithms: ['HS256'],
            audience: 'authenticated',
        });
    }

    // RS256 / ES256 — verificar via JWKS
    const jwks = await getJwks();
    const key = header.kid
        ? jwks.keys.find(k => k.kid === header.kid)
        : jwks.keys[0];
    if (!key) throw new Error(`No matching JWK for kid=${header.kid}`);
    const pem = jwkToPem(key);
    return jwt.verify(token, pem, {
        algorithms: [header.alg],
        audience: 'authenticated',
    });
}

export async function verifyAdmin(request, reply) {
    const match = (request.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    if (!match) {
        return reply.code(401).send({ error: 'missing_token' });
    }

    let payload;
    try {
        payload = await verifyToken(match[1]);
    } catch (err) {
        const status = err.code === 503 ? 503 : 401;
        return reply.code(status).send({ error: status === 503 ? 'auth_not_configured' : 'invalid_token', detail: err.message });
    }

    if (payload?.app_metadata?.role !== 'admin') {
        return reply.code(403).send({ error: 'forbidden' });
    }

    request.adminUser = {
        id: payload.sub,
        email: payload.email || null,
        role: 'admin',
    };
}
