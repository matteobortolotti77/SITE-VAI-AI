import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config.js';
import healthRoutes from './routes/health.js';
import productsRoutes from './routes/products.js';

const app = Fastify({
    logger: {
        transport: config.env === 'development' ? { target: 'pino-pretty' } : undefined,
    }
});

await app.register(cors, { origin: config.corsOrigin });
await app.register(sensible);

await app.register(healthRoutes, { prefix: '/v1' });
await app.register(productsRoutes, { prefix: '/v1' });

app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'not_found', path: req.url });
});

try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    if (!config.isReady()) {
        app.log.warn('⚠️  Backend rodando, mas .env incompleto. Endpoints retornarão 503 até preencher SUPABASE_* e MP_*.');
    }
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
