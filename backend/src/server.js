import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import healthRoutes from './routes/health.js';
import productsRoutes from './routes/products.js';
import reservationsRoutes from './routes/reservations.js';
import paymentsRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import { startCronJobs } from './services/cron.js';

const app = Fastify({
    logger: {
        transport: config.env === 'development' ? { target: 'pino-pretty' } : undefined,
    }
});

await app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
});
await app.register(sensible);
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
});

await app.register(healthRoutes, { prefix: '/v1' });
await app.register(productsRoutes, { prefix: '/v1' });
await app.register(reservationsRoutes, { prefix: '/v1' });
await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(paymentsRoutes);
}, { prefix: '/v1' });
await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(adminRoutes);
}, { prefix: '/v1' });

app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'not_found', path: req.url });
});

try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    if (!config.isReady()) {
        app.log.warn('⚠️  Backend rodando, mas .env incompleto. Endpoints retornarão 503 até preencher SUPABASE_* e MP_*.');
    }
    if (config.canWrite() && config.canNotify()) {
        startCronJobs(app.log);
    } else {
        app.log.warn('Cron jobs NÃO iniciados — falta SUPABASE_SERVICE_ROLE_KEY ou Z-API config.');
    }
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
