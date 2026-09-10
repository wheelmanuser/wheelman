import { xvisionGet } from '../lib/xvision/client';
async function main() {
  const devices = await xvisionGet('/Device/GetDevices');
  console.log(JSON.stringify(devices, null, 2));
}
main().catch(console.error);
