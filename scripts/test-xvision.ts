import { getCachedTokens, getXVisionToken, refreshXVisionToken } from "../lib/xvision/auth";
import { xvisionGet } from "../lib/xvision/client";
import { getXVisionCustomerId, getXVisionDevices } from "../lib/xvision/devices";

function mask(token: string): string {
  return `${token.slice(0, 6)}… (${token.length} chars)`;
}

function count(payload: unknown): string {
  return Array.isArray(payload) ? `${payload.length} devices` : `non-array response (${typeof payload})`;
}

async function main() {
  const used = await getXVisionToken();
  const tokens = getCachedTokens();
  if (!tokens) throw new Error("Login succeeded but no tokens were cached");

  const which =
    used === tokens.access ? "access" : used === tokens.refresh ? "refresh" : "unknown";
  console.log(`Logged in. Token used for requests: ${which} token ${mask(used)}`);
  console.log(`  access:  ${mask(tokens.access)}`);
  console.log(`  refresh: ${mask(tokens.refresh)}`);

  const customerId = await getXVisionCustomerId();
  console.log(`Customer ID resolved: …${customerId.slice(-4)}`);

  const withoutCustomer = await xvisionGet<unknown>("/Device/GetDevices");
  console.log(`GetDevices WITHOUT CustomerID: ${count(withoutCustomer)}`);

  const devices = await getXVisionDevices();
  console.log(`GetDevices WITH CustomerID:    ${devices.length} devices`);
  if (devices[0]) console.log(`  device fields: ${Object.keys(devices[0]).join(", ")}`);

  console.log("\nForcing token refresh...");
  const newAccess = await refreshXVisionToken();
  const after = getCachedTokens();
  if (!after) throw new Error("Refresh succeeded but no tokens were cached");
  console.log(`Refreshed. New access token: ${mask(newAccess)} (changed: ${newAccess !== tokens.access})`);
  console.log(`  refresh: ${mask(after.refresh)} (changed: ${after.refresh !== tokens.refresh})`);

  const devicesAfter = await getXVisionDevices();
  console.log(`GetDevices WITH CustomerID after refresh: ${devicesAfter.length} devices`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
