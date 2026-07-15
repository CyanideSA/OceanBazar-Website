type LogLevel = 'info' | 'warn' | 'error';

export function appLog(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  const line = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...(fields && Object.keys(fields).length ? fields : {}),
  };
  if (level === 'error') console.error(JSON.stringify(line));
  else if (level === 'warn') console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}
