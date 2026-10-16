let tokenCache: { access: string; refresh: string; expiresAt: number } | null = null;

export async function getXVisionToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.access;
  const res = await fetch(`${process.env.XVISION_API_URL}/User/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Email: process.env.XVISION_EMAIL, Password: process.env.XVISION_PASSWORD }),
  });
  if (!res.ok) throw new Error(`xVision login failed: ${await res.text()}`);
  const data = await res.json();
  tokenCache = { access: data.access ?? data.Access, refresh: data.refresh ?? data.Refresh, expiresAt: Date.now() + 55 * 60 * 1000 };
  return tokenCache.access;
}

export async function refreshXVisionToken(): Promise<string> {
  if (!tokenCache) return getXVisionToken();
  const res = await fetch(`${process.env.XVISION_API_URL}/User/RefreshTokens`, {
    headers: { SessionKey: tokenCache.refresh, RefreshKey: tokenCache.refresh },
  });
  if (!res.ok) throw new Error(`xVision refresh failed: ${await res.text()}`);
  const data = await res.json();
  tokenCache = { access: data.access ?? data.Access, refresh: data.refresh ?? data.Refresh, expiresAt: Date.now() + 55 * 60 * 1000 };
  return tokenCache.access;
}

export function getCachedTokens(): { access: string; refresh: string } | null {
  return tokenCache ? { access: tokenCache.access, refresh: tokenCache.refresh } : null;
}
