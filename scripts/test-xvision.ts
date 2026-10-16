import { getCachedTokens, getXVisionToken, refreshXVisionToken } from "../lib/xvision/auth";
import { xvisionGet } from "../lib/xvision/client";

function mask(token: string): string {
  return `${token.slice(0, 6)}… (${token.length} chars)`;
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

  const devices = await xvisionGet<unknown>("/Device/GetDevices");
  console.log("GetDevices response:");
  console.log(JSON.stringify(devices, null, 2));

  console.log("\nForcing token refresh...");
  const newAccess = await refreshXVisionToken();
  const after = getCachedTokens();
  if (!after) throw new Error("Refresh succeeded but no tokens were cached");
  console.log(`Refreshed. New access token: ${mask(newAccess)} (changed: ${newAccess !== tokens.access})`);
  console.log(`  access:  ${mask(after.access)}`);
  console.log(`  refresh: ${mask(after.refresh)} (changed: ${after.refresh !== tokens.refresh})`);

  const devicesAfter = await xvisionGet<unknown>("/Device/GetDevices");
  console.log("GetDevices response after refresh:");
  console.log(JSON.stringify(devicesAfter, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
