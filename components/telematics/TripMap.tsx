"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapUnavailable } from "@/components/telematics/MapErrorBoundary";
import type { TripEvent, TripPoint } from "@/lib/xvision/types";

type Props = { points: TripPoint[]; events: TripEvent[]; height?: string };

const EVENT_COLORS: Record<TripEvent["category"], string> = {
  braking: "#cf6679",
  acceleration: "#e6c364",
  speeding: "#e6c364",
  other: "#8a8f98",
};

function routeData(points: TripPoint[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: points.map((p) => [p.lng, p.lat]) },
  };
}

function eventLabel(e: TripEvent): string {
  const when = e.at ? new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  return [e.type, when].filter(Boolean).join(" · ");
}

export function TripMap({ points, events, height = "h-72" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const loadedRef = useRef(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failed, setFailed] = useState(!token);
  const hasRoute = points.length > 0;

  // Create the map once; route/marker updates (e.g. a live trip refreshing) reuse it.
  useEffect(() => {
    if (failed || !token || !containerRef.current || !hasRoute) return;
    try {
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [points[0].lng, points[0].lat],
        zoom: 13,
      });
      mapRef.current = map;
      map.on("error", (e) => {
        console.error("[TripMap] mapbox error:", e.error);
        if (!loadedRef.current) setFailed(true);
      });
      map.on("load", () => {
        loadedRef.current = true;
        map.addSource("route", { type: "geojson", data: routeData(pointsRef.current) });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#a5d0bc", "line-width": 4 },
        });
        drawRef.current();
      });
    } catch (err) {
      console.error("[TripMap] failed to initialize:", err);
      setFailed(true);
    }
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      try {
        mapRef.current?.remove();
      } catch {
        // map never finished initializing
      }
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed, token, hasRoute]);

  const pointsRef = useRef(points);
  pointsRef.current = points;

  const draw = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || pointsRef.current.length === 0) return;
    const pts = pointsRef.current;
    (map.getSource("route") as mapboxgl.GeoJSONSource | undefined)?.setData(routeData(pts));

    markersRef.current.forEach((m) => m.remove());
    const start = pts[0];
    const end = pts[pts.length - 1];
    const markers = [
      new mapboxgl.Marker({ color: "#a5d0bc" }).setLngLat([start.lng, start.lat]).setPopup(new mapboxgl.Popup().setText("Start")),
      new mapboxgl.Marker({ color: "#f2f2f2" }).setLngLat([end.lng, end.lat]).setPopup(new mapboxgl.Popup().setText("End")),
      ...events.map((e) =>
        new mapboxgl.Marker({ color: EVENT_COLORS[e.category], scale: 0.6 })
          .setLngLat([e.lng, e.lat])
          .setPopup(new mapboxgl.Popup().setText(eventLabel(e))),
      ),
    ];
    markers.forEach((m) => m.addTo(map));
    markersRef.current = markers;

    const bounds = new mapboxgl.LngLatBounds();
    pts.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    drawRef.current();
  }, [points, events]);

  if (!hasRoute) {
    return (
      <div className="flex h-24 items-center justify-center border border-wm-border bg-wm-s1 text-wm-text3 label-technical">
        No route points for this trip
      </div>
    );
  }
  return failed ? <MapUnavailable /> : <div ref={containerRef} className={`${height} w-full`} />;
}
