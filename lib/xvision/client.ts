import { getXVisionToken, refreshXVisionToken } from "./auth";

async function xvisionRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const send = async (token: string) => {
    const res = await fetch(`${process.env.XVISION_API_URL}${path}`, {
      method,
      headers: body === undefined ? { SessionKey: token } : { SessionKey: token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { res, text: await res.text() };
  };

  let { res, text } = await send(await getXVisionToken());
  const isExpired =
    res.status === 401 || (res.status === 400 && text.includes("SessionKey expired"));
  if (isExpired) {
    ({ res, text } = await send(await refreshXVisionToken()));
  }
  if (!res.ok) {
    throw new Error(`xVision ${method} ${path} failed (${res.status}): ${text}`);
  }
  return JSON.parse(text) as T;
}

export function xvisionGet<T>(path: string): Promise<T> {
  return xvisionRequest<T>("GET", path);
}

export function xvisionPost<T>(path: string, body: unknown): Promise<T> {
  return xvisionRequest<T>("POST", path, body);
}
