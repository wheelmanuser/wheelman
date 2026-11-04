"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapUnavailable } from "@/components/telematics/MapErrorBoundary";
import { computeMapView, type FleetPin, type FleetStatus } from "@/lib/fleet-status";

type Props = {
  pins: FleetPin[];
  // Pins used to frame the map when it first loads (all vehicles, regardless of the active filter).
  framePins: FleetPin[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
};

export const STATUS_COLOR: Record<FleetStatus, string> = {
  moving: "#a5d0bc",
  parked: "#e6c364",
  offline: "#cf6679",
  no_device: "#8a8f98",
};

const SOURCE = "fleet";
const FONT = ["DIN Pro Medium", "Arial Unicode MS Regular"];
const NOT_CLUSTER = ["!", ["has", "point_count"]];

function toGeoJSON(pins: FleetPin[]) {
  return {
    type: "FeatureCollection" as const,
    features: pins.map((p) => ({
      type: "Feature" as const,
      properties: { id: p.id, name: p.name, color: STATUS_COLOR[p.status] },
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    })),
  };
}

function hoverFilter(id: string | null) {
  return ["all", NOT_CLUSTER, ["==", ["get", "id"], id ?? ""]];
}

export function FleetMap({ pins, framePins, hoveredId, onHover, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const pinsRef = useRef(pins);
  const framePinsRef = useRef(framePins);
  framePinsRef.current = framePins;
  const hoveredRef = useRef(hoveredId);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  pinsRef.current = pins;
  hoveredRef.current = hoveredId;
  onHoverRef.current = onHover;
  onSelectRef.current = onSelect;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failed, setFailed] = useState(!token);

  // Created once; later refreshes only swap the source data so the user's pan/zoom is kept.
  useEffect(() => {
    if (failed || !token || !containerRef.current) return;
    try {
      mapboxgl.accessToken = token;
      const view = computeMapView(framePinsRef.current);
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        ...(view.kind === "bounds"
          ? { bounds: view.bounds, fitBoundsOptions: { padding: 60, maxZoom: 14 } }
          : view.kind === "center"
          ? { center: view.center, zoom: view.zoom }
          : {}),
      });
      mapRef.current = map;

      map.on("error", (e) => {
        console.error("[FleetMap] mapbox error:", e.error);
        if (!loadedRef.current) setFailed(true);
      });

      map.on("load", () => {
        loadedRef.current = true;
        map.addSource(SOURCE, {
          type: "geojson",
          data: toGeoJSON(pinsRef.current),
          cluster: true,
          clusterRadius: 40,
          clusterMaxZoom: 15,
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: SOURCE,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#0c3729",
            "circle-stroke-color": "#a5d0bc",
            "circle-stroke-width": 2,
            "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 10, 24],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: SOURCE,
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 13 },
          paint: { "text-color": "#a5d0bc" },
        });
        map.addLayer({
          id: "pin-hover",
          type: "circle",
          source: SOURCE,
          filter: hoverFilter(hoveredRef.current),
          paint: { "circle-radius": 13, "circle-color": ["get", "color"], "circle-opacity": 0.35 },
        });
        map.addLayer({
          id: "pins",
          type: "circle",
          source: SOURCE,
          filter: NOT_CLUSTER,
          paint: {
            "circle-radius": 7,
            "circle-color": ["get", "color"],
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "pin-labels",
          type: "symbol",
          source: SOURCE,
          filter: NOT_CLUSTER,
          layout: {
            "text-field": ["get", "name"],
            "text-font": FONT,
            "text-size": 12,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
          },
          paint: { "text-color": "#e8e8e8", "text-halo-color": "#111111", "text-halo-width": 1.5 },
        });

        map.on("mousemove", "pins", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string" && id !== hoveredRef.current) onHoverRef.current(id);
        });
        map.on("mouseleave", "pins", () => {
          map.getCanvas().style.cursor = "";
          onHoverRef.current(null);
        });
        map.on("click", "pins", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectRef.current(id);
        });

        map.on("mouseenter", "clusters", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "clusters", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "clusters", (e) => {
          const feature = e.features?.[0];
          const clusterId = feature?.properties?.cluster_id;
          if (!feature || clusterId === undefined) return;
          const center = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          (map.getSource(SOURCE) as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (!err && zoom !== null && zoom !== undefined) map.easeTo({ center, zoom });
          });
        });
      });
    } catch (err) {
      console.error("[FleetMap] failed to initialize:", err);
      setFailed(true);
    }
    return () => {
      try {
        mapRef.current?.remove();
      } catch {
        // map never finished initializing
      }
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [failed, token]);

  useEffect(() => {
    if (!loadedRef.current) return;
    (mapRef.current?.getSource(SOURCE) as mapboxgl.GeoJSONSource | undefined)?.setData(toGeoJSON(pins));
  }, [pins]);

  useEffect(() => {
    if (loadedRef.current) mapRef.current?.setFilter("pin-hover", hoverFilter(hoveredId));
  }, [hoveredId]);

  if (failed) return <MapUnavailable />;
  return <div ref={containerRef} className="h-full w-full" />;
}
