import { getXVisionToken, refreshXVisionToken } from "./auth";

async function xvisionRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const send = (token: string) =>
    fetch(`${process.env.XVISION_API_URL}${path}`, {
      method,
      headers: body === undefined ? { SessionKey: token } : { SessionKey: token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await send(await getXVisionToken());
  if (res.status === 401) {
    res = await send(await refreshXVisionToken());
  }
  if (!res.ok) {
    throw new Error(`xVision ${method} ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function xvisionGet<T>(path: string): Promise<T> {
  return xvisionRequest<T>("GET", path);
}

export function xvisionPost<T>(path: string, body: unknown): Promise<T> {
  return xvisionRequest<T>("POST", path, body);
}
