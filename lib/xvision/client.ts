import { xvisionLogin } from './auth';
export async function xvisionGet<T>(path: string): Promise<T> {
  const { access } = await xvisionLogin();
  const res = await fetch(`${process.env.XVISION_API_URL}${path}`, {
    headers: {
      apikey: process.env.XVISION_API_KEY!,
      token: access,
    },
  });
  if (!res.ok) throw new Error(`xVision error: ${await res.text()}`);
  return res.json();
}
