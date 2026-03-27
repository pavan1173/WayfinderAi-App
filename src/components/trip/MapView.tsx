import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMap, Polyline, Circle, LayersControl, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Spot, geminiService } from '../../services/geminiService';
import { ArrowUp, X } from 'lucide-react';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Numbered Icon Generator
const createNumberedIcon = (number: number, color: string = '#3B82F6', isNearby: boolean = false, isActive: boolean = false) => {
  return L.divIcon({
    className: `custom-numbered-marker ${isActive ? 'active-marker-pulse' : ''}`,
    html: `<div style="
      background-color: ${isNearby ? '#F59E0B' : color};
      width: ${isNearby ? '28px' : (isActive ? '48px' : '36px')};
      height: ${isNearby ? '28px' : (isActive ? '48px' : '36px')};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: ${isNearby ? '14px' : (isActive ? '18px' : '16px')};
      border: ${isActive ? '3px' : '2px'} solid white;
      box-shadow: 0 ${isActive ? '8px 16px' : '4px 6px'} rgba(0,0,0,0.${isActive ? '4' : '2'});
      transition: all 0.3s ease;
      transform-origin: center center;
    ">
      ${isNearby ? '★' : number}
    </div>`,
    iconSize: isActive ? [48, 48] : [36, 36],
    iconAnchor: isActive ? [24, 24] : [18, 18],
  });
};

interface MapViewProps {
  spots: Spot[];
  activeSpot?: Spot | null;
  showRoute?: boolean;
  orderedSpots?: Spot[];
  nearbySpots?: Spot[];
  currentDay?: number;
  onSpotClick?: (spot: Spot) => void;
  onAddNearbySpot?: (spot: Spot) => void;
  isSidebarOpen?: boolean;
}

const MapController = ({ 
  activeSpot, 
  spots 
}: { 
  activeSpot: Spot | null | undefined, 
  spots: Spot[] 
}) => {
  const map = useMap();
  
  useEffect(() => {
    if (activeSpot && activeSpot.lat !== undefined && activeSpot.lng !== undefined) {
      // Zoom to specific spot
      map.flyTo([activeSpot.lat, activeSpot.lng], 17, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    } else if (spots.length > 0) {
      if (spots.length === 1) {
        map.flyTo([spots[0].lat!, spots[0].lng!], 14, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      } else {
        // Fit all spots in view
        const bounds = L.latLngBounds(spots.map(s => [s.lat!, s.lng!]));
        map.flyToBounds(bounds, { 
          padding: [80, 80], 
          duration: 1.5,
          maxZoom: 14
        });
      }
    }
  }, [activeSpot, spots, map]);
  
  return null;
};

const ResizeHandler = ({ isSidebarOpen }: { isSidebarOpen?: boolean }) => {
  const map = useMap();
  useEffect(() => {
    // Trigger resize during the transition
    const timeout = setTimeout(() => {
      map.invalidateSize({ animate: true });
    }, 300); // Wait for transition to finish
    return () => clearTimeout(timeout);
  }, [isSidebarOpen, map]);
  return null;
};

export const MapView: React.FC<MapViewProps> = ({ spots, activeSpot: externalActiveSpot, showRoute, orderedSpots, nearbySpots = [], currentDay, onSpotClick, onAddNearbySpot, isSidebarOpen }) => {
  const [localActiveSpot, setLocalActiveSpot] = React.useState<Spot | null>(null);
  const [spotDetails, setSpotDetails] = React.useState<{ openingHours: string, reviews: string[], insights: string } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);
  const activeSpot = externalActiveSpot || localActiveSpot;

  const handleSpotClick = async (spot: Spot) => {
    setLocalActiveSpot(spot);
    if (onSpotClick) {
      onSpotClick(spot);
    }
    setIsLoadingDetails(true);
    setSpotDetails(null);
    try {
      const details = await geminiService.getSpotRichDetails(spot.name, { lat: spot.lat!, lng: spot.lng! });
      setSpotDetails(details);
    } catch (e) {
      console.error("Failed to fetch spot details", e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const validSpots = spots.filter(s => s.lat !== undefined && s.lng !== undefined);
  
  if (validSpots.length === 0) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 font-medium">
        No location data available for these spots
      </div>
    );
  }

  const center: [number, number] = activeSpot && activeSpot.lat !== undefined && activeSpot.lng !== undefined
    ? [activeSpot.lat, activeSpot.lng]
    : [validSpots[0].lat!, validSpots[0].lng!];

  const routePositions: [number, number][] = orderedSpots 
    ? orderedSpots
        .map(os => spots.find(s => s.id === os.id) || os)
        .filter(s => s.lat !== undefined && s.lng !== undefined)
        .map(s => [s.lat!, s.lng!])
    : validSpots.map(s => [s.lat!, s.lng!]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-100 relative">
      <style>
        {`
          .animated-route {
            stroke-dasharray: 15;
            animation: dash 30s linear infinite;
          }
          @keyframes dash {
            to {
              stroke-dashoffset: -1000;
            }
          }
          .active-marker-pulse {
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
            z-index: 1000 !important;
          }
          @keyframes pulse-ring {
            0% {
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.3);
            }
            100% {
              transform: scale(0.95);
              box-shadow: 0 0 0 20px rgba(245, 158, 11, 0);
            }
          }
          .custom-numbered-marker {
            animation: markerDrop 0.5s cubic-bezier(0.25, 1.5, 0.5, 1) backwards;
          }
          @keyframes markerDrop {
            0% { transform: translateY(-20px) scale(0.5); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          .leaflet-marker-icon {
            border: none;
            background: transparent;
          }
        `}
      </style>
      
      {/* Floating UI Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-white/20">
          <div className="flex items-center gap-1 text-slate-600">
            <ArrowUp size={16} />
            <span className="font-bold text-slate-800">{validSpots.length}</span>
          </div>
          <div className="w-1.5 h-1.5 bg-brand rounded-full" />
          <span className="text-[10px] font-bold text-slate-500">SPOTS</span>
        </div>
      </div>

      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        scrollWheelZoom={true}
      >
        <ResizeHandler isSidebarOpen={isSidebarOpen} />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Standard">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {showRoute && routePositions.length > 1 && (
          <>
            {/* Solid background line for better visibility */}
            <Polyline 
              positions={routePositions} 
              pathOptions={{
                color: "#3B82F6",
                weight: 6,
                opacity: 0.4,
                lineCap: "round",
                lineJoin: "round"
              }}
            />
            {/* Animated dashed line on top */}
            <Polyline 
              positions={routePositions} 
              pathOptions={{
                color: "#1E3A8A",
                weight: 4,
                opacity: 1,
                dashArray: "10, 15",
                className: "animated-route",
                lineCap: "round",
                lineJoin: "round"
              }}
            />
          </>
        )}
        
        {/* Nearby Spots Visualization */}
        {activeSpot && activeSpot.lat && activeSpot.lng && (
          <Circle 
            center={[activeSpot.lat, activeSpot.lng]} 
            radius={1500} 
            pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.08, weight: 2, dashArray: '6 6' }} 
          />
        )}

        {/* Main Trip Spots */}
        <MarkerClusterGroup>
          {validSpots.map((spot, index) => {
            let color = '#3B82F6'; // Blue
            if (index === 0) color = '#10B981'; // Green for start
            else if (index === validSpots.length - 1) color = '#EF4444'; // Red for end
            else if (index % 3 === 1) color = '#8B5CF6'; // Purple
            else if (index % 3 === 2) color = '#F59E0B'; // Amber

            return (
              <Marker 
                key={`trip-spot-${spot.id}-${index}`} 
                position={[spot.lat!, spot.lng!]}
                icon={createNumberedIcon(index + 1, activeSpot?.id === spot.id ? '#F59E0B' : color, false, activeSpot?.id === spot.id)}
                draggable={true}
                eventHandlers={{
                  click: () => handleSpotClick(spot),
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    console.log('New position:', position);
                  }
                }}
                zIndexOffset={activeSpot?.id === spot.id ? 1000 : 0}
              >
                <Popup className="custom-popup">
                  <div className="flex flex-col gap-1 p-2">
                    <div className="font-bold text-lg">{spot.name}</div>
                    <div className="text-sm text-slate-600">{spot.category}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {/* Nearby Spots */}
        <MarkerClusterGroup>
          {nearbySpots.map((spot, index) => (
            <Marker 
              key={`nearby-spot-${spot.id}-${index}`} 
              position={[spot.lat!, spot.lng!]}
              icon={createNumberedIcon(0, '#F59E0B', true, activeSpot?.id === spot.id)}
              draggable={true}
              eventHandlers={{
                click: () => handleSpotClick(spot),
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  console.log('New position:', position);
                }
              }}
              zIndexOffset={activeSpot?.id === spot.id ? 1000 : -100}
            >
              <Popup className="custom-popup">
                <div className="flex flex-col gap-2 min-w-[150px] p-2">
                  <div className="font-bold text-lg">{spot.name}</div>
                  <div className="text-sm text-slate-600">{spot.category}</div>
                  {onAddNearbySpot && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddNearbySpot(spot);
                      }}
                      className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors w-full text-center"
                    >
                      Add to {currentDay ? `Day ${currentDay}` : 'Current Day'}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        <MapController activeSpot={activeSpot} spots={validSpots} />
      </MapContainer>

      {/* Detail Panel */}
      <AnimatePresence>
        {activeSpot && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute top-4 right-4 z-[1001] w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-6 max-h-[calc(100%-32px)] overflow-y-auto"
          >
            <button onClick={() => setLocalActiveSpot(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{activeSpot.name}</h2>
            <p className="text-sm text-slate-500 mb-4">{activeSpot.category}</p>
            
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : spotDetails ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Opening Hours</h4>
                  <p className="text-sm text-slate-600">{spotDetails.openingHours}</p>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">AI Insights</h4>
                  <p className="text-sm text-slate-600">{spotDetails.insights}</p>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Reviews</h4>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {spotDetails.reviews.slice(0, 3).map((review, i) => (
                      <li key={i} className="line-clamp-2">{review}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Details not available.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
