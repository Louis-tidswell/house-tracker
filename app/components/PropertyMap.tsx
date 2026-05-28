"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

type MapProperty = {
  id: string;
  title: string | null;
  address: string | null;
  lat: number;
  lon: number;
};

type Props = {
  items: MapProperty[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const FLOOD_LAYER_URL =
  "https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services/Flood_Awareness_Flood_Risk_Overall/FeatureServer/0";

const FLOOD_STYLES: Record<string, { color: string; fillOpacity: number }> = {
  High: { color: "#08306b", fillOpacity: 0.6 },
  Medium: { color: "#2171b5", fillOpacity: 0.4 },
  Low: { color: "#6baed6", fillOpacity: 0.25 },
  "Very Low": { color: "#c6dbef", fillOpacity: 0.15 },
};

const redIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;"></div>',
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const blackIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#111827;border:2px solid white;"></div>',
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ items }: { items: MapProperty[] }) {
  const map = useMap();

  useEffect(() => {
    if (!items.length) return;
    const bounds = L.latLngBounds(items.map((item) => [item.lat, item.lon] as [number, number]));
    map.fitBounds(bounds.pad(0.2));
  }, [items, map]);

  return null;
}

function FloodOverlay({ enabled }: { enabled: boolean }) {
  const map = useMap();
  const layer_ref = useRef<L.GeoJSON | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  // Remove layer when disabled
  useEffect(() => {
    if (!enabled) {
      if (layer_ref.current) {
        map.removeLayer(layer_ref.current);
      }
    } else if (layer_ref.current) {
      map.addLayer(layer_ref.current);
    }
  }, [enabled, map]);

  // Fetch flood data when enabled and fetchKey changes
  useEffect(() => {
    if (!enabled) return;

    const bounds = map.getBounds();
    const envelope = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "FLOOD_RISK",
      geometry: envelope,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outSR: "4326",
      f: "geojson",
      resultRecordCount: "2000",
    });

    let cancelled = false;

    void fetch(`${FLOOD_LAYER_URL}/query?${params.toString()}`)
      .then((res) => res.json())
      .then((geojson) => {
        if (cancelled || !geojson || !geojson.features) return;

        if (layer_ref.current) {
          map.removeLayer(layer_ref.current);
        }

        const geo_layer = L.geoJSON(geojson, {
          style: (feature) => {
            const risk = feature?.properties?.FLOOD_RISK as string | undefined;
            const s = FLOOD_STYLES[risk ?? ""] ?? FLOOD_STYLES["Very Low"];
            return {
              color: s.color,
              fillColor: s.color,
              fillOpacity: s.fillOpacity,
              weight: 0.5,
              opacity: 0.7,
            };
          },
        });

        layer_ref.current = geo_layer;
        geo_layer.addTo(map);
      })
      .catch(() => {
        // Silently fail - the overlay is optional
      });

    return () => { cancelled = true; };
  }, [enabled, map, fetchKey]);

  // Refetch when map moves
  useEffect(() => {
    if (!enabled) return;

    function on_moveend() {
      setFetchKey((k) => k + 1);
    }

    map.on("moveend", on_moveend);
    return () => { map.off("moveend", on_moveend); };
  }, [enabled, map]);

  return null;
}

export default function PropertyMap({ items, selectedId, onSelect }: Props) {
  const [floodEnabled, setFloodEnabled] = useState(false);

  if (!items.length) {
    return <p className="p-3 text-sm text-zinc-700">No map pins yet. Imported listings need a resolved address coordinate first.</p>;
  }

  const center: [number, number] = [items[0].lat, items[0].lon];

  return (
    <div className="relative">
      <MapContainer center={center} zoom={13} style={{ height: "460px", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds items={items} />
        <FloodOverlay enabled={floodEnabled} />
        {items.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lon]}
            icon={selectedId === item.id ? blackIcon : redIcon}
            eventHandlers={{ click: () => onSelect(item.id) }}
          >
            <Popup>
              <div>
                <strong>{item.title ?? "Property"}</strong>
                <br />
                {item.address ?? "No address"}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Flood overlay toggle */}
      <div className="absolute top-2 right-2 z-[1000] rounded bg-white/90 px-2 py-1.5 text-xs shadow backdrop-blur-sm" style={{ maxWidth: "180px" }}>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={floodEnabled}
            onChange={(e) => setFloodEnabled(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span className="font-medium text-zinc-800">Flood awareness</span>
        </label>

        {/* Legend */}
        {floodEnabled && (
          <div className="mt-1.5 space-y-0.5 border-t pt-1.5">
            {Object.entries(FLOOD_STYLES).map(([risk, style]) => (
              <div key={risk} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: style.color, opacity: style.fillOpacity + 0.3 }} />
                <span className="text-zinc-700">{risk}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BCC attribution */}
      {floodEnabled && (
        <p className="mt-1 text-[10px] text-zinc-500">
          Flood data: Brisbane City Council — Flood Awareness Map
        </p>
      )}
    </div>
  );
}