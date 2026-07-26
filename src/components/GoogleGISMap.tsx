import React from "react";
import { Household } from "../types";

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

interface Props {
    households: Household[];
    selectedHouse?: Household | null;
    onSelectHouse?: (house: Household) => void;
    center?: [number, number];
    viewZoom?: number;
    currentPosition?: [number, number] | null;
}

const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    React.useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

const DEFAULT_CENTER: [number, number] = [11.370679, 106.131640];
const DEFAULT_ZOOM = 9.68;

export default function GoogleGISMap({
    households,
    selectedHouse,
    onSelectHouse,
    center: forcedCenter,
    viewZoom,
    currentPosition
}: Props) {

    const gpsHouses = households.filter(
        h => h.gpsLat !== undefined && h.gpsLng !== undefined
    );

    const center: [number, number] =
        forcedCenter ||
        (selectedHouse?.gpsLat !== undefined && selectedHouse?.gpsLng !== undefined
            ? [selectedHouse.gpsLat, selectedHouse.gpsLng]
            : DEFAULT_CENTER);

    const zoom = viewZoom || DEFAULT_ZOOM;

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            style={{
                width: "100%",
                height: "100%",
                borderRadius: "12px"
            }}
        >
            <TileLayer
                attribution="&copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <RecenterMap center={center} zoom={zoom} />

            {currentPosition && (
                <Marker
                    key="current-position"
                    position={currentPosition}
                    icon={markerIcon}
                >
                    <Popup>Vị trí hiện tại của bạn</Popup>
                </Marker>
            )}

            {gpsHouses.map((h) => (
                <Marker
                    key={h.id}
                    icon={markerIcon}
                    position={[h.gpsLat!, h.gpsLng!]}
                    eventHandlers={{
                        click: () => onSelectHouse?.(h)
                    }}
                >
                    <Popup>
                        <strong>{h.id}</strong>
                        <br />
                        {h.ownerName}
                        <br />
                        {h.address}
                    </Popup>
                </Marker>
            ))}

            {selectedHouse && (
                <Marker
                    icon={markerIcon}
                    position={[
                        selectedHouse.gpsLat!,
                        selectedHouse.gpsLng!
                    ]}
                >
                    <Popup>
                        <b>{selectedHouse.ownerName}</b>
                        <br />
                        {selectedHouse.address}
                    </Popup>
                </Marker>
            )}
        </MapContainer>
    );
}
