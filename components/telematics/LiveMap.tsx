"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Icon } from "@/components/ui/Icon";
import { MapUnavailable } from "@/components/telematics/MapErrorBoundary";
import { EVENT_COLORS, routeData } from "@/components/telematics/TripMap";
import { STATUS_COLOR } from "@/components/dashboard/FleetMap";
import { formatCentralTime } from "@/lib/central-day";
import type { FleetStatus } from "@/lib/fleet-status";
import type { TripEvent, TripPoint } from "@/lib/xvision/types";

export type MapFocus = { key: string; lat: number; lng: number };

type Props = {
  position: { lat: number; lng: number } | null;
  name: string;
  status: FleetStatus;
  // The in-progress trip's points, drawn behind the vehicle in live view.
  route: TripPoint[];
  // A selected trip replaces the live view with its route until it is cleared.
  trip: { points: TripPoint[]; events: TripEvent[] } | null;
  focus: MapFocus | null;
  onReturnToLive: () => void;
};

const LIVE_ZOOM = 15;
const ARROW_IMAGE = "route-arrow";

function styleVehicleMarker(el: HTMLDivElement, status: FleetStatus, name: string) {
  el.style.width = "20px";
  el.style.height = "20px";
  el.style.borderRadius = "9999px";
  el.style.border = "3px solid #111111";
  el.style.boxShadow = "0 0 0 2px #f2f2f2";
  el.style.background = STATUS_COLOR[status];
  el.title = name;
}

function focusMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "22px";
  el.style.height = "22px";
  el.style.borderRadius = "9999px";
  el.style.border = "3px solid #e6c364";
  el.style.background = "rgba(230, 195, 100, 0.25)";
  el.style.boxShadow = "0 0 0 6px rgba(230, 195, 100, 0.2)";
  return el;
}

// A small chevron pointing along +x; symbol-placement "line" rotates it to follow the route's direction.
function arrowImage(): { width: number; height: number; data: Uint8ClampedArray } {
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.strokeStyle = "#0c3729";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(8, 6);
  ctx.lineTo(16, 12);
  ctx.lineTo(8, 18);
  ctx.stroke();
  return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

function eventPopupText(e: TripEvent): string {
  return [e.type, e.at ? formatCentralTime(e.at, true) : null].filter(Boolean).join(" · ");
}

export function LiveMap({ position, name, status, route, trip, focus, onReturnToLive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const vehicleMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const vehicleElRef = useRef<HTMLDivElement | null>(null);
  const tripMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const focusMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const loadedRef = useRef(false);

  const latest = useRef({ position, name, status, route, trip });
  latest.current = { position, name, status, route, trip };

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failed, setFailed] = useState(!token);
  const tripPoints = trip?.points ?? [];
  const canShowMap = position !== null || tripPoints.length > 0;

  // Draws whichever view is current: the selected trip, or the vehicle's live position.
  const renderView = (fit: boolean) => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const { position: pos, route: liveRoute, trip: selected } = latest.current;

    tripMarkersRef.current.forEach((m) => m.remove());
    tripMarkersRef.current = [];

    if (selected && selected.points.length > 0) {
      const pts = selected.points;
      (map.getSource("trip-route") as mapboxgl.GeoJSONSource).setData(routeData(pts));
      (map.getSource("live-route") as mapboxgl.GeoJSONSource).setData(routeData([]));
      if (vehicleElRef.current) vehicleElRef.current.style.display = "none";

      const start = pts[0];
      const end = pts[pts.length - 1];
      const markers = [
        new mapboxgl.Marker({ color: "#a5d0bc" }).setLngLat([start.lng, start.lat]).setPopup(new mapboxgl.Popup().setText("Start")),
        new mapboxgl.Marker({ color: "#f2f2f2" }).setLngLat([end.lng, end.lat]).setPopup(new mapboxgl.Popup().setText("End")),
        ...selected.events.map((e) =>
          new mapboxgl.Marker({ color: EVENT_COLORS[e.category], scale: 0.6 })
            .setLngLat([e.lng, e.lat])
            .setPopup(new mapboxgl.Popup().setText(eventPopupText(e))),
        ),
      ];
      markers.forEach((m) => m.addTo(map));
      tripMarkersRef.current = markers;

      if (fit) {
        const bounds = new mapboxgl.LngLatBounds();
        pts.forEach((p) => bounds.extend([p.lng, p.lat]));
        // Extra top padding keeps the route clear of the "Return to current location" button.
        map.fitBounds(bounds, { padding: { top: 72, bottom: 40, left: 40, right: 40 }, maxZoom: 16, duration: 600 });
      }
    } else {
      (map.getSource("trip-route") as mapboxgl.GeoJSONSource).setData(routeData([]));
      (map.getSource("live-route") as mapboxgl.GeoJSONSource).setData(routeData(liveRoute));
      if (vehicleElRef.current) vehicleElRef.current.style.display = "";
      if (fit && pos) map.easeTo({ center: [pos.lng, pos.lat], zoom: LIVE_ZOOM, duration: 600 });
    }
  };
  const renderRef = useRef(renderView);
  renderRef.current = renderView;

  useEffect(() => {
    if (failed || !token || !containerRef.current || !canShowMap) return;
    const { position: pos, trip: selected } = latest.current;
    const center = pos ?? selected?.points[0];
    if (!center) return;
    try {
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [center.lng, center.lat],
        zoom: LIVE_ZOOM,
      });
      mapRef.current = map;

      if (pos) {
        const el = document.createElement("div");
        styleVehicleMarker(el, latest.current.status, latest.current.name);
        vehicleElRef.current = el;
        vehicleMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([pos.lng, pos.lat]).addTo(map);
      }

      map.on("error", (e) => {
        console.error("[LiveMap] mapbox error:", e.error);
        if (!loadedRef.current) setFailed(true);
      });
      map.on("load", () => {
        loadedRef.current = true;
        if (!map.hasImage(ARROW_IMAGE)) map.addImage(ARROW_IMAGE, arrowImage(), { pixelRatio: 2 });
        map.addSource("live-route", { type: "geojson", data: routeData([]) });
        map.addLayer({
          id: "live-route",
          type: "line",
          source: "live-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#a5d0bc", "line-width": 4, "line-opacity": 0.85 },
        });
        map.addSource("trip-route", { type: "geojson", data: routeData([]) });
        map.addLayer({
          id: "trip-route",
          type: "line",
          source: "trip-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#a5d0bc", "line-width": 7 },
        });
        map.addLayer({
          id: "trip-arrows",
          type: "symbol",
          source: "trip-route",
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 70,
            "icon-image": ARROW_IMAGE,
            "icon-size": 1.15,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-rotation-alignment": "map",
          },
        });
        renderRef.current(true);
      });
    } catch (err) {
      console.error("[LiveMap] failed to initialize:", err);
      setFailed(true);
    }
    return () => {
      tripMarkersRef.current.forEach((m) => m.remove());
      tripMarkersRef.current = [];
      focusMarkerRef.current?.remove();
      focusMarkerRef.current = null;
      vehicleMarkerRef.current?.remove();
      vehicleMarkerRef.current = null;
      vehicleElRef.current = null;
      try {
        mapRef.current?.remove();
      } catch {
        // map never finished initializing
      }
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [failed, token, canShowMap]);

  // Vehicle marker follows refreshes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    if (!vehicleMarkerRef.current) {
      const el = document.createElement("div");
      vehicleElRef.current = el;
      vehicleMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([position.lng, position.lat]).addTo(map);
    }
    vehicleMarkerRef.current.setLngLat([position.lng, position.lat]);
    if (vehicleElRef.current) {
      styleVehicleMarker(vehicleElRef.current, status, name);
      if (latest.current.trip?.points.length) vehicleElRef.current.style.display = "none";
    }
  }, [position, status, name]);

  // Selecting / clearing a trip refits; a live refresh of the same trip only redraws.
  const tripKey = trip ? `${trip.points[0]?.at ?? ""}|${trip.points.length > 0}` : "none";
  useEffect(() => {
    focusMarkerRef.current?.remove();
    focusMarkerRef.current = null;
    renderRef.current(true);
  }, [tripKey]);
  useEffect(() => {
    renderRef.current(false);
  }, [trip, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    focusMarkerRef.current?.remove();
    focusMarkerRef.current = null;
    if (!focus) return;
    focusMarkerRef.current = new mapboxgl.Marker({ element: focusMarkerElement() }).setLngLat([focus.lng, focus.lat]).addTo(map);
    map.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 15), duration: 500 });
  }, [focus]);

  if (!canShowMap) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-wm-s2 p-6 text-center">
        <Icon name="location_off" size={28} className="text-wm-text3" />
        <p className="label-technical text-wm-text3">No location reported yet</p>
      </div>
    );
  }
  if (failed) return <MapUnavailable />;
  return (
    <div className="relative h-full w-full">
      {/* h-full rather than absolute inset-0: mapbox-gl.css forces .mapboxgl-map to position: relative. */}
      <div ref={containerRef} className="h-full w-full" />
      {trip && (
        <button
          type="button"
          onClick={onReturnToLive}
          className="label-technical absolute left-3 top-3 z-10 inline-flex items-center gap-1 border border-wm-accent bg-wm-bg/90 px-3 py-1.5 text-wm-accent shadow-lg transition-colors hover:bg-wm-accent hover:text-wm-bg"
        >
          <Icon name="my_location" size={14} /> Return to current location
        </button>
      )}
    </div>
  );
}
