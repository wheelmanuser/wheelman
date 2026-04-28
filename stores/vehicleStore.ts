import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/types/database";

type VehicleState = {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  fetchVehicles: () => Promise<void>;
  setSelectedVehicle: (id: string | null) => void;
};

export const useVehicleStore = create<VehicleState>((set) => ({
  vehicles: [],
  selectedVehicleId: null,
  fetchVehicles: async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    set({ vehicles: (data ?? []) as Vehicle[] });
  },
  setSelectedVehicle: (id) => set({ selectedVehicleId: id }),
}));
