import React, { useMemo } from "react";
import {
    GoogleMap,
    Marker,
    InfoWindow,
    useJsApiLoader
} from "@react-google-maps/api";

import { Household } from "../types";

interface Props {
    households: Household[];
    selectedHouse: Household | null;
    onSelectHouse: (house: Household) => void;
}

const containerStyle = {
    width: "100%",
    height: "100%"
};

export default function GoogleGISMap({
    households,
    selectedHouse,
    onSelectHouse
}: Props) {

    const { isLoaded } = useJsApiLoader({
        id: "google-map",
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });

    const center = useMemo(() => {

        const valid = households.filter(
            h => h.gpsLat && h.gpsLng
        );

        if (valid.length === 0) {
            return {
                lat: 11.345,
                lng: 106.125
            };
        }

        return {
            lat:
                valid.reduce((s, h) => s + h.gpsLat!, 0) /
                valid.length,

            lng:
                valid.reduce((s, h) => s + h.gpsLng!, 0) /
                valid.length
        };

    }, [households]);

    if (!isLoaded) {

        return (
            <div className="flex items-center justify-center h-full">
                Đang tải Google Maps...
            </div>
        );

    }

    return (

        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={16}
            options={{
                mapTypeId: "hybrid",
                streetViewControl: true,
                fullscreenControl: true,
                mapTypeControl: true,
                zoomControl: true
            }}
        >

            {households.map(h => {

                if (!h.gpsLat || !h.gpsLng) return null;

                return (

                    <Marker
                        key={h.id}
                        position={{
                            lat: h.gpsLat,
                            lng: h.gpsLng
                        }}
                        onClick={() => onSelectHouse(h)}
                    />

                );

            })}

            {selectedHouse && (

                <InfoWindow
                    position={{
                        lat: selectedHouse.gpsLat!,
                        lng: selectedHouse.gpsLng!
                    }}
                    onCloseClick={() => {}}
                >

                    <div>

                        <b>{selectedHouse.ownerName}</b>

                        <br />

                        {selectedHouse.address}

                    </div>

                </InfoWindow>

            )}

        </GoogleMap>

    );

}