import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";
import React, { useEffect, useRef, useState } from "react";
import { Crosshair, ExternalLink, MapPin, X } from "lucide-react";
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

declare global {
  interface Window {
    google?: any;
  }
}

type Coordinates = { lat: number; lng: number };

interface MapPickerModalProps {
  isOpen: boolean;
  initialLat?: number | string;
  initialLng?: number | string;
  onClose: () => void;
  onSelect: (coordinates: Coordinates) => void;
}

const DEFAULT_CENTER: Coordinates = { lat: 11.3475, lng: 106.1275 };
let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Không thể tải Google Maps."));
    document.head.appendChild(script);
  });

  return mapsLoader;
}

function toCoordinate(value: number | string | undefined) {
    const coordinate =
        typeof value === "number"
            ? value
            : Number.parseFloat(value || "");

    return Number.isFinite(coordinate) ? coordinate : undefined;
}

function LocationPicker({
    onPick,
}: {
    onPick: (lat: number, lng: number) => void;
}) {
    useMapEvents({
        click(e) {
            onPick(e.latlng.lat, e.latlng.lng);
        },
    });

    return null;
}

export default function MapPickerModal({
  isOpen,
  initialLat,
  initialLng,
  onClose,
  onSelect,
}: MapPickerModalProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [selected, setSelected] = useState<Coordinates>(() => ({ ...DEFAULT_CENTER }));
  const [mapProvider, setMapProvider] = useState<"google" | "osm">(
  apiKey ? "google" : "osm"
);
  const [mapError, setMapError] = useState("");
  const [searchText, setSearchText] = useState("");
const [searching, setSearching] = useState(false);
const [selectedAddress, setSelectedAddress] = useState("");
  const [googleFailed, setGoogleFailed] = useState(false);

useEffect(() => {
  if (mapError) {
    setMapProvider("osm");
  }
}, [mapError]);
  

  const updateSelectedPosition = (position: Coordinates, panMap = true) => {
    setSelected(position);
    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else if (mapRef.current && window.google?.maps) {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        draggable: true,
      });
      markerRef.current.addListener("dragend", (event: any) => {
        if (!event.latLng) return;
        setSelected({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
    }
    if (panMap && mapRef.current) mapRef.current.panTo(position);
  };

  useEffect(() => {
    if (!isOpen) return;

    const lat = toCoordinate(initialLat);
    const lng = toCoordinate(initialLng);
    const initialPosition = lat !== undefined && lng !== undefined ? { lat, lng } : { ...DEFAULT_CENTER };
    setSelected(initialPosition);
    setMapError("");

    if (!apiKey) {
      setMapError("Chưa cấu hình VITE_GOOGLE_MAPS_API_KEY. Bạn vẫn có thể nhập tọa độ hoặc mở Google Maps bên ngoài.");
      return;
    }

    let disposed = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (disposed || !mapElementRef.current) return;
        const map = new window.google.maps.Map(mapElementRef.current, {
          center: initialPosition,
          zoom: 17,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        <div className="flex items-center gap-2 rounded-lg border bg-slate-50 p-2">

    <button
        type="button"
        onClick={() => {
            setGoogleFailed(false);
            setMapProvider("osm");
        }}
        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
            mapProvider === "osm"
                ? "bg-green-600 text-white"
                : "bg-white hover:bg-slate-100"
        }`}
    >
        🌍 OpenStreetMap
    </button>

    <button
        type="button"
        onClick={() => {
            setGoogleFailed(false);
            setMapProvider("google");
        }}
        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
            mapProvider === "google"
                ? "bg-blue-600 text-white"
                : "bg-white hover:bg-slate-100"
        }`}
    >
        🗺 Google
    </button>

</div>
        markerRef.current = new window.google.maps.Marker({ map, position: initialPosition, draggable: true });
        markerRef.current.addListener("dragend", (event: any) => {
          if (event.latLng) setSelected({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });
        map.addListener("click", (event: any) => {
          if (!event.latLng) return;
          const position = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          setSelected(position);
          markerRef.current.setPosition(position);
        });
      })
      .catch((error: Error) => {

    if (disposed) return;

    setMapError(error.message);

    setGoogleFailed(true);

});

    return () => {
      disposed = true;
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, initialLat, initialLng, isOpen]);

const loadAddress = async (lat: number, lng: number) => {

    try {

        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );

        const result = await response.json();

        setSelectedAddress(result.display_name ?? "");

    } catch {

        setSelectedAddress("");

    }

};

const searchAddress = async () => {

    if (!searchText.trim()) return;

    try {

        setSearching(true);

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}`
        );

        const result = await response.json();

        if (!result.length) {

            alert("Không tìm thấy địa chỉ.");

            return;

        }

        const location = result[0];

        const newPosition = {
            lat: Number(location.lat),
            lng: Number(location.lon),
        };

        setSelected(newPosition);

        loadAddress(newPosition.lat, newPosition.lng);

        if (mapRef.current && mapProvider === "google") {
            mapRef.current.panTo(newPosition);
        }

        if (markerRef.current && mapProvider === "google") {
            markerRef.current.setPosition(newPosition);
        }

    } catch {

        alert("Không thể tìm kiếm địa chỉ.");

    } finally {

        setSearching(false);

    }

};

if (!isOpen) return null;

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`;
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );

        const result = await response.json();

        setSelectedAddress(result.display_name ?? "");

    } catch {

        setSelectedAddress("");

    }

};

setSelected(newPosition);
loadAddress(newPosition.lat, newPosition.lng);

if (mapRef.current && mapProvider === "google") {

    mapRef.current.panTo(newPosition);

}

if (markerRef.current && mapProvider === "google") {

    markerRef.current.setPosition(newPosition);

}

    } catch {

        alert("Không thể tìm kiếm địa chỉ.");

    } finally {

        setSearching(false);

    }

};

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`;

return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-blue-700 px-5 py-4 text-white">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-5 w-5" /> Chọn vị trí trên Google Maps</h3>
            <p className="mt-0.5 text-[11px] text-blue-100">Bấm vào bản đồ hoặc kéo ghim đến đúng vị trí nhà.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-blue-100 hover:bg-blue-600 hover:text-white" aria-label="Đóng bản đồ">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {mapProvider === "google" ? (
  <div
    ref={mapElementRef}
    className="h-[360px] w-full rounded-xl border border-slate-200 bg-slate-100"
  />
) : (
  <MapContainer
    center={[selected.lat, selected.lng]}
    zoom={17}
    className="h-[360px] w-full rounded-xl"
  >
    <TileLayer
      attribution="&copy; OpenStreetMap contributors"
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />

    <Marker
    position={[selected.lat, selected.lng]}
    draggable={true}
    eventHandlers={{
        dragend(e) {

            const marker = e.target;

            const p = marker.getLatLng();

            setSelected({
    lat: p.lat,
    lng: p.lng,
});

loadAddress(p.lat, p.lng);

        },
    }}
/>

    <FlyTo position={selected} />
    <LocationPicker
      onPick={(lat, lng) => {

    setSelected({ lat, lng });

    loadAddress(lat, lng);

}}
    />
  </MapContainer>
)}

          <div className="flex gap-2">

    <button
        type="button"
        onClick={() => {
            ...
        }}
        className="rounded-lg bg-green-600 ..."
    >
        📍 Vị trí hiện tại
    </button>

</div>

{/* THÊM ĐOẠN NÀY */}
<div className="mt-3 flex gap-2">

    <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Nhập địa chỉ hoặc tên địa điểm..."
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        onKeyDown={(e) => {
            if (e.key === "Enter") {
                searchAddress();
            }
        }}
    />

    <button
        type="button"
        onClick={searchAddress}
        disabled={searching}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
    >
        {searching ? "Đang tìm..." : "🔍 Tìm"}
    </button>

</div>

{selectedAddress && (

    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">

        <div className="font-semibold text-slate-700">

            📍 Địa chỉ

        </div>

        <div className="mt-1 text-slate-600">

            {selectedAddress}

        </div>

    </div>

)}
<div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Vĩ độ
              <input
                type="number"
                step="any"
                value={selected.lat}
                onChange={(event) => {
                  const lat = Number.parseFloat(event.target.value);
                  if (Number.isFinite(lat)) updateSelectedPosition({ ...selected, lat });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 focus:outline-blue-600"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Kinh độ
              <input
                type="number"
                step="any"
                value={selected.lng}
                onChange={(event) => {
                  const lng = Number.parseFloat(event.target.value);
                  if (Number.isFinite(lng)) updateSelectedPosition({ ...selected, lng });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 focus:outline-blue-600"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800">
            <ExternalLink className="h-3.5 w-3.5" /> Mở Google Maps
          </a>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">Hủy</button>
            <button type="button" onClick={() => onSelect(selected)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
              <Crosshair className="h-3.5 w-3.5" /> Dùng vị trí này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
