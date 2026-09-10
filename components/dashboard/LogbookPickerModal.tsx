"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { vehicleDisplayName } from "@/lib/vehicle-display";
import type { Vehicle } from "@/types/database";

type VehicleProp = Pick<Vehicle, "id" | "year" | "make" | "model" | "nickname">;

export function LogbookPickerModal({ vehicles }: { vehicles: VehicleProp[] }) {
  const router = useRouter();
  const [logbookModalOpen, setLogbookModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setLogbookModalOpen(true)}
        className="label-technical text-wm-accent hover:text-wm-text"
      >
        View full logbook →
      </button>

      {logbookModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-wm-bg/80 backdrop-blur-sm"
          onClick={() => setLogbookModalOpen(false)}
        >
          <div
            className="carbon-texture mx-4 w-full max-w-md border border-wm-border bg-wm-s1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-wm-border px-5 py-4">
              <h3 className="font-headline text-lg text-wm-text">Select a Vehicle</h3>
              <button
                type="button"
                onClick={() => setLogbookModalOpen(false)}
                className="text-wm-text2 hover:text-wm-text"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {vehicles.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-wm-text2">No vehicles in your garage yet.</p>
                <Link
                  href="/garage/add"
                  onClick={() => setLogbookModalOpen(false)}
                  className="label-technical mt-4 inline-flex border border-wm-accent px-4 py-2 text-wm-accent transition-colors hover:bg-wm-accent hover:text-wm-bg"
                >
                  Add a Vehicle
                </Link>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setLogbookModalOpen(false);
                      router.push(`/garage/${v.id}/logbook`);
                    }}
                    className="flex w-full items-center justify-between border-b border-wm-border px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-wm-s2"
                  >
                    <div className="min-w-0">
                      <p className="font-headline truncate text-sm font-medium text-wm-text">
                        {vehicleDisplayName(v)}
                      </p>
                      <p className="text-xs text-wm-text3">
                        {v.year} {v.make} {v.model}
                      </p>
                    </div>
                    <Icon name="chevron_right" size={20} className="shrink-0 text-wm-text3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
