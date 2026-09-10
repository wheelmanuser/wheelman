"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { VehicleTelemetry } from "@/types/database";

type Props = {
  telemetry: VehicleTelemetry;
  vehicleName: string;
};

export function VehicleMap({ telemetry, vehicleName }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !telemetry.latitude || !telemetry.longitude) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    mapInstance.current = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [telemetry.longitude, telemetry.latitude],
      zoom: 14,
    });

    new mapboxgl.Marker({ color: "#a5d0bc" })
      .setLngLat([telemetry.longitude, telemetry.latitude])
      .setPopup(new mapboxgl.Popup().setText(vehicleName))
      .addTo(mapInstance.current);

    return () => mapInstance.current?.remove();
  }, [telemetry.latitude, telemetry.longitude, vehicleName]);

  if (!telemetry.latitude || !telemetry.longitude) {
    return (
      <div className="flex items-center justify-center h-48 border border-wm-border bg-wm-s1 text-wm-text3 label-technical">
        No GPS data available
      </div>
    );
  }

  return (
    <div className="border border-wm-border border-l-4 border-l-wm-accent overflow-hidden">
      <div ref={mapRef} className="h-64 w-full" />
      {telemetry.address && (
        <div className="px-4 py-2 bg-wm-s1">
          <span className="label-technical text-wm-text3">Last Location</span>
          <p className="text-sm text-wm-text mt-0.5">{telemetry.address}</p>
        </div>
      )}
    </div>
  );
}
