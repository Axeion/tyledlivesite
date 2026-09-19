"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export interface LodgeMapProps {
  lat: number;
  lng: number;
  label: string;
  address?: string;
  height?: number;
}

export default function LodgeMapInner({ lat, lng, label, address, height = 320 }: LodgeMapProps) {
  return (
    <div data-testid="lodge-map" data-lat={lat} data-lng={lng} style={{ height }} className="w-full overflow-hidden rounded-lg">
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker center={[lat, lng]} radius={10} pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.8 }}>
          <Popup>
            <strong>{label}</strong>
            {address ? <div>{address}</div> : null}
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
