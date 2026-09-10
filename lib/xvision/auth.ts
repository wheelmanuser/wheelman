export async function xvisionLogin(): Promise<{ access: string; refresh: string }> {
  const res = await fetch(`${process.env.XVISION_API_URL}/User/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.XVISION_EMAIL,
      password: process.env.XVISION_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`xVision login failed: ${await res.text()}`);
  return res.json();
}
