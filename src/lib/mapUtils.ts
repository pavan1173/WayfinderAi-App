import L from 'leaflet';

export const createNumberedIcon = (number: number, color: string = '#3B82F6', isNearby: boolean = false, isActive: boolean = false, customIconUrl?: string) => {
  if (customIconUrl) {
    return L.icon({
      iconUrl: customIconUrl,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }
  return L.divIcon({
    className: `custom-numbered-marker ${isActive ? 'active-marker-pulse' : ''}`,
    html: `<div style="
      background-color: ${isNearby ? '#F59E0B' : color};
      width: ${isActive ? '48px' : '36px'};
      height: ${isActive ? '48px' : '36px'};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: ${isActive ? '20px' : '16px'};
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      ${isNearby ? '★' : number}
    </div>`,
    iconSize: isActive ? [48, 48] : [36, 36],
    iconAnchor: isActive ? [24, 24] : [18, 18],
  });
};
