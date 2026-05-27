"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

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

export default function PropertyMap({ items, selectedId, onSelect }: Props) {
  if (!items.length) {
    return <p className="p-3 text-sm text-zinc-700">No map pins yet. Imported listings need a resolved address coordinate first.</p>;
  }

  const center: [number, number] = [items[0].lat, items[0].lon];

  return (
    <MapContainer center={center} zoom={13} style={{ height: "460px", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds items={items} />
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
  );
}