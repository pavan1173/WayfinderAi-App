# Design Document: Trip Planner App

## Architecture
- **Framework:** React 18+ with TypeScript.
- **Styling:** Tailwind CSS.
- **State Management:** React Context (`AppContext`, `ToastContext`), Local State.
- **External Services:** Google Maps API, Gemini API.
- **Animations:** Framer Motion (`motion/react`).

## Folder Structure
- `/src/components`: Reusable UI components (Dashboard, TripView, MapView, ReelsFeed, ImportModal).
- `/src/services`: API interaction logic (Gemini, Google Maps).
- `/src/store`: React Context providers.
- `/src/lib`: Utility functions (`cn`).

## Data Schemas
- **Trip:** `{ id: string, destination: string, duration: number, dates: string, spots: Spot[], itinerary: Day[], hotels: Hotel[] }`
- **Spot:** `{ id: string, name: string, category: string, imageUrl: string, ... }`
- **Day:** `{ day: number, spots: Spot[] }`

## UI/UX
- **Collapsible Sidebar:** Implemented in `TripView.tsx`.
- **Animations:** Global button click animations using `whileTap`.
- **Responsive Design:** Mobile-first approach with Tailwind CSS.

