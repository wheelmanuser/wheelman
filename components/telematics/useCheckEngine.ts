"use client";
import { useCallback, useEffect, useState } from "react";

export type CheckEngineState =
  | { status: "loading" }
  | { status: "no_device" }
  | { status: "error" }
  | { status: "ok"; milOn: boolean; lastEventAt: string | null };

async function fetchState(vehicleId: string): Promise<CheckEngineState> {
  try {
    const res = await fetch(`/api/xvision/check-engine?vehicleId=${encodeURIComponent(vehicleId)}`);
    if (!res.ok) return { status: "error" };
    const body = (await res.json()) as { status?: string; milOn?: boolean; lastEventAt?: string | null };
    if (body.status === "no_device") return { status: "no_device" };
    return { status: "ok", milOn: body.milOn === true, lastEventAt: body.lastEventAt ?? null };
  } catch {
    return { status: "error" };
  }
}

export function useCheckEngine(vehicleIds: string[], enabled = true) {
  const key = vehicleIds.join(",");
  const [results, setResults] = useState<Record<string, CheckEngineState>>({});

  const refresh = useCallback(async () => {
    const ids = key ? key.split(",") : [];
    await Promise.all(
      ids.map(async (id) => {
        const state = await fetchState(id);
        setResults((prev) => ({ ...prev, [id]: state }));
      }),
    );
  }, [key]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { results, refresh };
}
