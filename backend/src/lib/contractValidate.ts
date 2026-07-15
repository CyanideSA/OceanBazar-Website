import { z, type ZodTypeAny } from 'zod';
import { contractValidationFailures } from '../metrics/prometheus';
import { appLog } from './appLog';

export function parseContract<T extends ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string
): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;
  contractValidationFailures.inc({ path: context });
  appLog('warn', 'contract_validation_failed', {
    context,
    issues: parsed.error.flatten(),
  });
  return data as z.infer<T>;
}
