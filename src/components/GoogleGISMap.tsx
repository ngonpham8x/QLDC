import React from "react";
import { Household } from "../types";

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

interface Props {
    households: Household[];
    selectedHouseId?: string;
    onSelectHouse?: (id: string) => void;
}

const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize:,
    iconAnchor:,
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const containerStyle = {
    width: "100%",
    height: "100%"
};

export default function GoogleGISMap({
    households,
    selectedHouseId,
    onSelectHouse
}: Props) {

    const gpsHouses = households.filter(
        h => h.gpsLat !== undefined && h.gpsLng !== undefined
    );

    const selectedHouse = households.find(
        h => h.id === selectedHouseId
    );

    const center: [number, number] =
        selectedHouse?.gpsLat !== undefined &&
        selectedHouse?.gpsLng !== undefined
            ? [
                  selectedHouse.gpsLat,
                  selectedHouse.gpsLng
              ]
            : gpsHouses.length > 0
            ? [
                  gpsHouses[0].gpsLat!,
                  gpsHouses[0].gpsLng!
              ]
            : [11.33871, 106.11864];
    
    return (
        <MapContainer
            center={center}
            zoom={16}
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

            {gpsHouses.map((h) => (
                <Marker
                    key={h.id}
                    icon={markerIcon}
                    position={[h.gpsLat!, h.gpsLng!]}
                    eventHandlers={{
                        click: () => onSelectHouse?.(h.id)
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

            {selectedHouse && selectedHouse.gpsLat !== undefined && selectedHouse.gpsLng !== undefined && (
                <Marker
                    icon={markerIcon}
                    position={[
                        selectedHouse.gpsLat,
                        selectedHouse.gpsLng
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
