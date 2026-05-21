import { createClient } from "@/lib/supabase/server";
import { TelematicsClient } from "@/components/telematics/TelematicsClient";
import type { Vehicle } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TelematicsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id,year,make,model,nickname")
    .order("created_at", { ascending: false });

  return (
    <TelematicsClient
      vehicles={(data ?? []) as Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname">[]}
    />
  );
}
