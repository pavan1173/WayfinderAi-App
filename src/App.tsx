import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppProvider, useApp } from './store/AppContext';
import { ToastProvider } from './store/ToastContext';
import { Onboarding } from './components/onboarding/Onboarding';
import { Dashboard } from './components/dashboard/Dashboard';
import { ImportModal } from './components/import/ImportModal';
import { TripPlanner } from './components/trip/TripPlanner';
import { TripView } from './components/trip/TripView';
import { Plus } from 'lucide-react';
import { Spot } from './services/geminiService';

function AppContent() {
  const { onboarded, currentTrip, setCurrentTrip } = useApp();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [plannerDestination, setPlannerDestination] = useState('');
  const [plannerInitialSpots, setPlannerInitialSpots] = useState<Spot[] | undefined>(undefined);
  const [plannerDuration, setPlannerDuration] = useState<number>(3);

  if (!onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden font-sans">
      <Dashboard 
        onAddClick={() => setIsImportOpen(true)} 
        onPlanTrip={(dest, spots, duration) => {
          setPlannerDestination(dest || '');
          setPlannerInitialSpots(spots);
          if (duration) setPlannerDuration(duration);
          setIsPlannerOpen(true);
        }}
      />
      
      <AnimatePresence>
        {isImportOpen && (
          <ImportModal 
            key="import-modal"
            isOpen={isImportOpen} 
            onClose={() => setIsImportOpen(false)} 
            onPlanManual={() => setIsPlannerOpen(true)}
          />
        )}
        
        {isPlannerOpen && (
          <TripPlanner 
            key="trip-planner"
            onClose={() => {
              setIsPlannerOpen(false);
              setPlannerDestination('');
              setPlannerInitialSpots(undefined);
              setPlannerDuration(3);
            }} 
            initialDestination={plannerDestination}
            initialSpots={plannerInitialSpots}
            initialDuration={plannerDuration}
          />
        )}

        {currentTrip && (
          <TripView 
            key="trip-view"
            trip={currentTrip}
            onClose={() => setCurrentTrip(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AppProvider>
  );
}
