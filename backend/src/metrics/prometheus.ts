import { Request, Response, Router } from 'express';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'bff_http_request_duration_seconds',
  help: 'BFF HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const javaProxyErrors = new client.Counter({
  name: 'bff_java_proxy_errors_total',
  help: 'Java internal API / proxy failures',
  registers: [register],
});

export const realtimeConnections = new client.Gauge({
  name: 'bff_socketio_connections',
  help: 'Active Socket.IO connections',
  registers: [register],
});

export const contractValidationFailures = new client.Counter({
  name: 'bff_contract_validation_failures_total',
  help: 'Internal API contract validation mismatches',
  labelNames: ['path'],
  registers: [register],
});

export const metricsRouter = Router();

metricsRouter.get('/', async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export function metricsMiddleware() {
  return (req: Request, res: Response, next: () => void) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const dur = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ? String(req.route.path) : req.path.split('?')[0];
      httpRequestDuration.observe(
        { method: req.method, route, status: String(res.statusCode) },
        dur
      );
    });
    next();
  };
}
