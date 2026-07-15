import axios, { type AxiosInstance, type AxiosRequestConfig, type Method } from 'axios';
import { z, type ZodTypeAny } from 'zod';
import { appLog } from '../lib/appLog';

const JAVA_BASE = (process.env.JAVA_API_URL || 'http://localhost:8000').replace(/\/$/, '');

/** Tomcat rejects Host headers with underscores (e.g. docker service name java_api). */
function javaUpstreamHostHeader(): string | undefined {
  try {
    const host = new URL(JAVA_BASE).host;
    if (host.includes('_')) {
      const port = new URL(JAVA_BASE).port || '8000';
      return `localhost:${port}`;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

const JAVA_HOST_HEADER = javaUpstreamHostHeader();

let instance: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!instance) {
    instance = axios.create({
      baseURL: JAVA_BASE,
      timeout: 30_000,
      headers: { Accept: 'application/json' },
    });
    instance.interceptors.request.use((config) => {
      const rid = config.headers['X-Request-Id'];
      if (!rid) {
        config.headers['X-Request-Id'] =
          `bff-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      }
      if (JAVA_HOST_HEADER) {
        config.headers.Host = JAVA_HOST_HEADER;
      }
      return config;
    });
  }
  return instance;
}

export type InternalApiOptions<T extends ZodTypeAny | undefined = undefined> = {
  method?: Method;
  path: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  requestId?: string;
  schema?: T;
  forwardAuth?: string;
};

export async function internalApiRequest<T extends ZodTypeAny | undefined, R = unknown>(
  opts: InternalApiOptions<T>
): Promise<R> {
  const client = getClient();
  const config: AxiosRequestConfig = {
    method: opts.method ?? 'GET',
    url: opts.path.startsWith('/') ? opts.path : `/${opts.path}`,
    params: opts.params,
    data: opts.data,
    headers: {
      ...(opts.requestId ? { 'X-Request-Id': opts.requestId } : {}),
      ...(opts.forwardAuth ? { Authorization: opts.forwardAuth } : {}),
      ...opts.headers,
    },
  };

  try {
    const res = await client.request(config);
    const body = res.data;
    if (opts.schema) {
      const parsed = opts.schema.safeParse(body);
      if (!parsed.success) {
        appLog('warn', 'internal_api_contract_mismatch', {
          path: opts.path,
          issues: parsed.error.flatten(),
        });
        return body as R;
      }
      return parsed.data as R;
    }
    return body as R;
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: unknown }; message?: string };
    appLog('error', 'internal_api_error', {
      path: opts.path,
      status: ax.response?.status,
      detail: ax.message,
    });
    throw err;
  }
}

export function getInternalApiBaseUrl(): string {
  return JAVA_BASE;
}

/** @deprecated Use internalApiRequest — kept for gradual migration */
export const internalApi = {
  get: <T = unknown>(path: string, config?: AxiosRequestConfig) =>
    getClient().get<T>(path, config).then((r) => r.data),
  post: <T = unknown>(path: string, data?: unknown, config?: AxiosRequestConfig) =>
    getClient().post<T>(path, data, config).then((r) => r.data),
};
