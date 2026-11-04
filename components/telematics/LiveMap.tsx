"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapUnavailable } from "@/components/telematics/MapErrorBoundary";
import { STATUS_COLOR } from "@/components/dashboard/FleetMap";
import type { FleetStatus } from "@/lib/fleet-status";
import type { TripPoint } from "@/lib/xvision/types";

type Props = {
  position: { lat: number; lng: number } | null;
  name: string;
  status: FleetStatus;
  route: TripPoint[];
};

const LIVE_ZOOM = 15;

function routeData(route: TripPoint[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: route.map((p) => [p.lng, p.lat]) },
  };
}

function styleMarker(el: HTMLDivElement, status: FleetStatus, name: string) {
  el.style.width = "20px";
  el.style.height = "20px";
  el.style.borderRadius = "9999px";
  el.style.border = "3px solid #111111";
  el.style.boxShadow = "0 0 0 2px #f2f2f2";
  el.style.background = STATUS_COLOR[status];
  el.title = name;
}

export function LiveMap({ position, name, status, route }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);
  const routeRef = useRef(route);
  routeRef.current = route;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failed, setFailed] = useState(!token);
  const hasPosition = position !== null;

  // Created once, centred on the vehicle; refreshes move the marker and redraw the route in place.
  useEffect(() => {
    if (failed || !token || !containerRef.current || !position) return;
    try {
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [position.lng, position.lat],
        zoom: LIVE_ZOOM,
      });
      mapRef.current = map;

      const el = document.createElement("div");
      styleMarker(el, status, name);
      markerElRef.current = el;
      markerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([position.lng, position.lat]).addTo(map);

      map.on("error", (e) => {
        console.error("[LiveMap] mapbox error:", e.error);
        if (!loadedRef.current) setFailed(true);
      });
      map.on("load", () => {
        loadedRef.current = true;
        map.addSource("live-route", { type: "geojson", data: routeData(routeRef.current) });
        map.addLayer({
          id: "live-route",
          type: "line",
          source: "live-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#a5d0bc", "line-width": 4, "line-opacity": 0.85 },
        });
      });
    } catch (err) {
      console.error("[LiveMap] failed to initialize:", err);
      setFailed(true);
    }
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      try {
        mapRef.current?.remove();
      } catch {
        // map never finished initializing
      }
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed, token, hasPosition]);

  useEffect(() => {
    if (position) markerRef.current?.setLngLat([position.lng, position.lat]);
    if (markerElRef.current) styleMarker(markerElRef.current, status, name);
  }, [position, status, name]);

  useEffect(() => {
    if (!loadedRef.current) return;
    (mapRef.current?.getSource("live-route") as mapboxgl.GeoJSONSource | undefined)?.setData(routeData(route));
  }, [route]);

  if (!position) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-wm-s2 p-6 text-center">
        <span className="material-symbols-outlined text-wm-text3" aria-hidden>
          location_off
        </span>
        <p className="label-technical text-wm-text3">No location reported yet</p>
      </div>
    );
  }
  return failed ? <MapUnavailable /> : <div ref={containerRef} className="h-full w-full" />;
}
