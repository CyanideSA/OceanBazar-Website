/**
 * Load before other app modules. OpenTelemetry and Sentry must initialize early.
 * - OTLP: set OTEL_EXPORTER_OTLP_ENDPOINT (no trailing /v1/traces). Skipped when SENTRY_DSN is set to avoid double HTTP instrumentation.
 * - Sentry: set SENTRY_DSN
 */
import * as Sentry from '@sentry/node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const otelBase = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, '');
if (otelBase && !process.env.SENTRY_DSN) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'oceanbazar-bff',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${otelBase}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
  process.once('beforeExit', () => {
    sdk.shutdown().catch(() => {});
  });
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    integrations: [Sentry.expressIntegration()],
  });
}

export { Sentry };
