/** Debug-mode NDJSON (session 9a9989). Never log secrets, OTP, or tokens. */
import fs from 'fs';
import path from 'path';

const INGEST_PATH = 'edcc0735-42b6-4958-a62f-412af4249672';
const SESSION_ID = '9a9989';

function logFileCandidates(): string[] {
  const candidates = [
    process.env.DEBUG_LOG_PATH,
    path.resolve(process.cwd(), 'debug-9a9989.log'),
    path.resolve(process.cwd(), '../debug-9a9989.log'),
    '/tmp/debug-9a9989.log',
  ].filter((p): p is string => Boolean(p));
  return candidates;
}

export function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  const payload = {
    sessionId: SESSION_ID,
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId: process.env.DEBUG_RUN_ID || 'pre-fix',
  };
  const line = `${JSON.stringify(payload)}\n`;

  for (const filePath of logFileCandidates()) {
    try {
      fs.appendFileSync(filePath, line, { encoding: 'utf8' });
    } catch {
      /* try next path */
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Debug-Session-Id': SESSION_ID,
  };
  const body = JSON.stringify(payload);
  for (const host of ['127.0.0.1', 'host.docker.internal']) {
    fetch(`http://${host}:7860/ingest/${INGEST_PATH}`, { method: 'POST', headers, body }).catch(() => {});
  }
}
