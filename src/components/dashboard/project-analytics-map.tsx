"use client";

import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import styles from "./dashboard.module.css";

export type ProjectAnalyticsMapPoint = {
  id: string;
  projectNumber: string;
  customer: string;
  address: string;
  status: string;
  projectKind: string;
  revenue: number;
  offerVolume: number;
  latitude: number;
  longitude: number;
};

type ProjectAnalyticsMapProps = {
  points: ProjectAnalyticsMapPoint[];
  selectedPointId: string;
  onSelectPoint: (projectId: string) => void;
  onOpenProject: (projectId: string) => void;
  formatMoney: (value: number) => string;
};

const DEFAULT_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    openStreetMap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "openStreetMap", type: "raster", source: "openStreetMap" }],
};

function getProjectMapStyle(): string | StyleSpecification {
  return process.env.NEXT_PUBLIC_PROJECT_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE;
}

export function ProjectAnalyticsMap({
  points,
  selectedPointId,
  onSelectPoint,
  onOpenProject,
  formatMoney,
}: ProjectAnalyticsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectPointRef = useRef(onSelectPoint);
  const pointsRef = useRef(points);
  const pointsSignature = points
    .map((point) => `${point.id}:${point.latitude}:${point.longitude}:${point.revenue}:${point.offerVolume}`)
    .join("|");
  const selectedPoint = points.find((point) => point.id === selectedPointId) ?? null;

  useEffect(() => {
    onSelectPointRef.current = onSelectPoint;
  }, [onSelectPoint]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      mapRef.current?.remove();
      const mapPoints = pointsRef.current;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getProjectMapStyle(),
        center: [10.4515, 51.1657],
        zoom: mapPoints.length > 0 ? 5.5 : 5,
        cooperativeGestures: true,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;
        const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
          type: "FeatureCollection",
          features: mapPoints.map((point) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
            properties: {
              id: point.id,
              projectNumber: point.projectNumber,
              tone: point.revenue > 0 ? "revenue" : point.offerVolume > 0 ? "offer" : "neutral",
            },
          })),
        };
        map.addSource("projects", {
          type: "geojson",
          data,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 48,
        });
        map.addLayer({
          id: "project-clusters",
          type: "circle",
          source: "projects",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#063f45",
            "circle-radius": ["step", ["get", "point_count"], 20, 10, 26, 30, 32],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        });
        map.addLayer({
          id: "project-cluster-count",
          type: "symbol",
          source: "projects",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "project-points",
          type: "circle",
          source: "projects",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "match",
              ["get", "tone"],
              "revenue",
              "#0f766e",
              "offer",
              "#d97706",
              "#475569",
            ],
            "circle-radius": 9,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        });
        map.addLayer({
          id: "project-labels",
          type: "symbol",
          source: "projects",
          filter: ["!", ["has", "point_count"]],
          minzoom: 10,
          layout: {
            "text-field": ["get", "projectNumber"],
            "text-offset": [0, 1.35],
            "text-size": 11,
            "text-anchor": "top",
          },
          paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 2 },
        });

        if (mapPoints.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          mapPoints.forEach((point) => bounds.extend([point.longitude, point.latitude]));
          map.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 0 });
        }
      });

      map.on("click", "project-clusters", async (event: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ["project-clusters"] });
        const clusterId = Number(features[0]?.properties?.cluster_id);
        const source = map.getSource("projects") as GeoJSONSource | undefined;
        if (!source || !Number.isFinite(clusterId)) return;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const coordinates = (features[0]?.geometry as GeoJSON.Point | undefined)?.coordinates;
        if (!coordinates) return;
        map.easeTo({ center: [coordinates[0], coordinates[1]], zoom });
      });
      map.on("click", "project-points", (event: MapMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ["project-points"] })[0];
        const projectId = String(feature?.properties?.id ?? "");
        if (projectId) onSelectPointRef.current(projectId);
      });
      ["project-clusters", "project-points"].forEach((layerId) => {
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pointsSignature]);

  useEffect(() => {
    if (!selectedPoint || !mapRef.current) return;
    mapRef.current.easeTo({ center: [selectedPoint.longitude, selectedPoint.latitude], zoom: Math.max(12, mapRef.current.getZoom()) });
  }, [selectedPoint]);

  return (
    <div className={styles.projectAnalyticsMapShell}>
      <div ref={containerRef} className={styles.projectAnalyticsMapCanvas} aria-label="Interaktive Projektkarte" />
      {points.length === 0 ? (
        <div className={styles.projectAnalyticsMapEmpty}>
          <strong>Noch keine kartierten Projekte</strong>
          <span>Geprüfte Koordinaten erscheinen hier automatisch.</span>
        </div>
      ) : null}
      {selectedPoint ? (
        <aside className={styles.projectAnalyticsMapPopup} aria-label={`Projekt ${selectedPoint.projectNumber}`}>
          <span>{selectedPoint.projectKind}</span>
          <strong>{selectedPoint.projectNumber}</strong>
          <p>{selectedPoint.customer}</p>
          <small>{selectedPoint.address}</small>
          <dl>
            <div><dt>Status</dt><dd>{selectedPoint.status}</dd></div>
            <div><dt>Umsatz</dt><dd>{formatMoney(selectedPoint.revenue)}</dd></div>
          </dl>
          <button type="button" onClick={() => onOpenProject(selectedPoint.id)}>Projekt öffnen</button>
        </aside>
      ) : null}
      <div className={styles.projectAnalyticsMapLegend} aria-label="Kartenlegende">
        <span data-tone="revenue">Umsatz</span>
        <span data-tone="offer">Angebot</span>
        <span data-tone="neutral">Ohne Umsatz/Angebot</span>
      </div>
    </div>
  );
}
