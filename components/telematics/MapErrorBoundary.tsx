"use client";
import { Component, type ReactNode } from "react";

export function MapUnavailable() {
  return (
    <div className="flex h-24 items-center justify-center border border-wm-border bg-wm-s1 text-wm-text3 label-technical">
      Map unavailable
    </div>
  );
}

export class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[VehicleMap] failed to render:", error);
  }

  render() {
    return this.state.failed ? <MapUnavailable /> : this.props.children;
  }
}
