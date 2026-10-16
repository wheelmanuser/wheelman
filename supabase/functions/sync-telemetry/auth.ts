// Constant-time comparison: lengths are checked first, then every byte is XORed so the time taken
// doesn't depend on where the first mismatch is.
export function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export type AuthResult = "ok" | "unauthorized" | "misconfigured";

// Expects "Authorization: Bearer <SYNC_TELEMETRY_KEY>". A missing/empty server key fails closed.
export function checkAuthorization(header: string | null, expectedKey: string | undefined): AuthResult {
  if (!expectedKey) return "misconfigured";
  const match = header?.match(/^Bearer (.+)$/i);
  if (!match) return "unauthorized";
  return timingSafeEqual(match[1], expectedKey) ? "ok" : "unauthorized";
}
