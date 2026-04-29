import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Spot } from '../../services/geminiService';
import { createNumberedIcon } from '../../lib/mapUtils';

interface MapMarkerProps {
    spot: Spot;
    index: number;
    isActive: boolean;
    color: string;
    isNearby?: boolean;
    onDragEnd?: (spot: Spot, lat: number, lng: number) => void;
    onClick: (spot: Spot) => void;
}

export const MapMarker = React.memo(({ spot, index, isActive, color, isNearby = false, onDragEnd, onClick }: MapMarkerProps) => {
    const icon = createNumberedIcon(
        index + 1, 
        isActive ? '#F59E0B' : color, 
        isNearby, 
        isActive, 
        spot.markerIcon
    );

    return (
        <Marker
            position={[spot.lat!, spot.lng!]}
            icon={icon}
            draggable={!isNearby}
            eventHandlers={{
                click: () => onClick(spot),
                dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    if (onDragEnd) {
                        onDragEnd(spot, position.lat, position.lng);
                    }
                }
            }}
            zIndexOffset={isActive ? 1000 : 0}
        >
            <Popup className="custom-popup">
                <div className="flex flex-col gap-1 p-2">
                    <div className="font-bold text-lg">{spot.name}</div>
                    <div className="text-sm text-slate-600">{spot.category}</div>
                </div>
            </Popup>
        </Marker>
    );
});
