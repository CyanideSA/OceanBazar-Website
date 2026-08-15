/**
 * No-op stub kept so existing imports compile after debug-session cleanup.
 */
type DebugPayload = {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
};

export function debugSessionLog(_payload: DebugPayload): void {
  /* intentionally empty */
}
