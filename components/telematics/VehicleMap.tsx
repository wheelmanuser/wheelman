"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapUnavailable } from "@/components/telematics/MapErrorBoundary";
import type { VehicleTelemetry } from "@/types/database";

type Props = {
  telemetry: VehicleTelemetry;
  vehicleName: string;
};

export function VehicleMap({ telemetry, vehicleName }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failed, setFailed] = useState(!token);

  useEffect(() => {
    if (failed || !token || !mapRef.current || !telemetry.latitude || !telemetry.longitude) return;

    let loaded = false;
    try {
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [telemetry.longitude, telemetry.latitude],
        zoom: 14,
      });
      mapInstance.current = map;

      map.on("load", () => {
        loaded = true;
      });
      // Errors before the first load (bad token, style fetch failure) are fatal; later tile errors are not.
      map.on("error", (e) => {
        console.error("[VehicleMap] mapbox error:", e.error);
        if (!loaded) setFailed(true);
      });

      new mapboxgl.Marker({ color: "#a5d0bc" })
        .setLngLat([telemetry.longitude, telemetry.latitude])
        .setPopup(new mapboxgl.Popup().setText(vehicleName))
        .addTo(map);
    } catch (err) {
      console.error("[VehicleMap] failed to initialize:", err);
      setFailed(true);
    }

    return () => {
      try {
        mapInstance.current?.remove();
      } catch {
        // map never finished initializing; nothing to clean up
      }
      mapInstance.current = null;
    };
  }, [failed, token, telemetry.latitude, telemetry.longitude, vehicleName]);

  if (!telemetry.latitude || !telemetry.longitude) {
    return (
      <div className="flex items-center justify-center h-48 border border-wm-border bg-wm-s1 text-wm-text3 label-technical">
        No GPS data available
      </div>
    );
  }

  return (
    <div className="border border-wm-border border-l-4 border-l-wm-accent overflow-hidden">
      {failed ? <MapUnavailable /> : <div ref={mapRef} className="h-64 w-full" />}
      {telemetry.address && (
        <div className="px-4 py-2 bg-wm-s1">
          <span className="label-technical text-wm-text3">Last Location</span>
          <p className="text-sm text-wm-text mt-0.5">{telemetry.address}</p>
        </div>
      )}
    </div>
  );
}
