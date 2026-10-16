type TokenPair = { access: string; refresh: string };
type TokenCache = TokenPair & { expiresAt: number };

const EXPIRY_BUFFER_MS = 60 * 1000;
const TOKEN_TTL_MS = 55 * 60 * 1000;

let tokenCache: TokenCache | null = null;

function requireEnv(name: "XVISION_API_URL" | "XVISION_EMAIL" | "XVISION_PASSWORD"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function storeTokens(data: unknown): string {
  const pair = data as Partial<TokenPair> | null;
  if (typeof pair?.access !== "string" || typeof pair?.refresh !== "string") {
    throw new Error("xVision token response missing access/refresh");
  }
  tokenCache = {
    access: pair.access,
    refresh: pair.refresh,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  return tokenCache.refresh;
}

export async function getXVisionToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + EXPIRY_BUFFER_MS) {
    return tokenCache.refresh;
  }

  const res = await fetch(`${requireEnv("XVISION_API_URL")}/User/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: requireEnv("XVISION_EMAIL"),
      password: requireEnv("XVISION_PASSWORD"),
    }),
  });
  if (!res.ok) throw new Error(`xVision login failed: ${await res.text()}`);
  return storeTokens(await res.json());
}

export async function refreshXVisionToken(): Promise<string> {
  if (!tokenCache) return getXVisionToken();

  const res = await fetch(`${requireEnv("XVISION_API_URL")}/User/RefreshTokens`, {
    headers: { token: tokenCache.refresh },
  });
  if (!res.ok) {
    tokenCache = null;
    throw new Error(`xVision token refresh failed: ${await res.text()}`);
  }
  return storeTokens(await res.json());
}

export function getCachedTokens(): TokenPair | null {
  return tokenCache ? { access: tokenCache.access, refresh: tokenCache.refresh } : null;
}
