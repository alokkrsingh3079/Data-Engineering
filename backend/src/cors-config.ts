const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

export function parseAllowedOrigins(rawValue?: string): string[] {
  const parts = (rawValue ?? '').split(/[\n,]+/);
  const seen = new Set<string>();

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '*') continue;
    const normalized = normalizeOrigin(trimmed);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
    }
  }

  return [...seen];
}

export function getAllowedOrigins(): string[] {
  const configured = parseAllowedOrigins(process.env.ALLOWED_ORIGIN);
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;

  const incoming = normalizeOrigin(origin);
  if (!incoming) return false;

  const incomingUrl = toUrl(incoming);
  if (!incomingUrl) return false;

  const host = incomingUrl.hostname;
  if (['localhost', '127.0.0.1', '::1'].includes(host)) {
    return true;
  }

  const allowed = getAllowedOrigins();
  return allowed.some((candidate) => normalizeOrigin(candidate) === incoming);
}

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  const url = toUrl(trimmed);
  return url ? url.origin : trimmed;
}

function toUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
