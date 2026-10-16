"use client";
import { useEffect, useRef } from "react";
import { startVisibleInterval } from "@/lib/visible-interval";

export function useVisibleInterval(callback: () => void, intervalMs: number, enabled = true) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    return startVisibleInterval(document, () => latest.current(), intervalMs);
  }, [enabled, intervalMs]);
}
