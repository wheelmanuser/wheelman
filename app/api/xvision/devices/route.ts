import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getXVisionDevices, toDeviceOption } from "@/lib/xvision/devices";
import type { XVisionDeviceOption } from "@/lib/xvision/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const devices = (await getXVisionDevices())
      .map(toDeviceOption)
      .filter((d): d is XVisionDeviceOption => d !== null);
    return NextResponse.json({ devices });
  } catch (err) {
    console.error("[xvision/devices]", err);
    return NextResponse.json({ error: "Could not load devices from xVision" }, { status: 502 });
  }
}
