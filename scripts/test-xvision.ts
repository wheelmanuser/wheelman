import { getCachedTokens, getXVisionToken } from "../lib/xvision/auth";
import { xvisionGet } from "../lib/xvision/client";

function mask(token: string): string {
  return `${token.slice(0, 6)}… (${token.length} chars)`;
}

async function main() {
  const used = await getXVisionToken();
  const tokens = getCachedTokens();
  if (!tokens) throw new Error("Login succeeded but no tokens were cached");

  const which =
    used === tokens.refresh ? "refresh" : used === tokens.access ? "access" : "unknown";
  console.log(`Logged in. Token used for requests: ${which} token ${mask(used)}`);
  console.log(`  access:  ${mask(tokens.access)}`);
  console.log(`  refresh: ${mask(tokens.refresh)}`);

  const devices = await xvisionGet<unknown>("/Device/GetDevices");
  console.log("GetDevices response:");
  console.log(JSON.stringify(devices, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
