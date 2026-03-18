import React, { createContext, useContext, useState, useEffect } from 'react';
import { Spot, Trip } from '../services/geminiService';

interface AppContextType {
  onboarded: boolean;
  user: { name: string; avatar: string; bio?: string } | null;
  trips: Trip[];
  savedSpots: Spot[];
  currentTrip: Trip | null;
  setOnboarded: (val: boolean) => void;
  setUser: (user: { name: string; avatar: string; bio?: string } | null) => void;
  addTrip: (trip: Trip) => void;
  deleteTrip: (id: string) => void;
  addSavedSpots: (spots: Spot[]) => void;
  setCurrentTrip: (trip: Trip | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [onboarded, setOnboarded] = useState(() => {
    const saved = localStorage.getItem('roamy_onboarded');
    return saved ? JSON.parse(saved) : false;
  });
  const [user, setUser] = useState<{ name: string; avatar: string; bio?: string } | null>(() => {
    const saved = localStorage.getItem('roamy_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [trips, setTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('roamy_trips');
    return saved ? JSON.parse(saved) : [];
  });
  const [savedSpots, setSavedSpots] = useState<Spot[]>(() => {
    const saved = localStorage.getItem('roamy_spots');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);

  useEffect(() => {
    localStorage.setItem('roamy_onboarded', JSON.stringify(onboarded));
  }, [onboarded]);

  useEffect(() => {
    localStorage.setItem('roamy_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('roamy_trips', JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    localStorage.setItem('roamy_spots', JSON.stringify(savedSpots));
  }, [savedSpots]);

  const addTrip = (trip: Trip) => {
    setTrips(prev => {
      const index = prev.findIndex(t => t.id === trip.id);
      if (index !== -1) {
        const newTrips = [...prev];
        newTrips[index] = trip;
        return newTrips;
      }
      return [...prev, trip];
    });
  };
  const deleteTrip = (id: string) => {
    setTrips(prev => prev.filter(t => t.id !== id));
  };
  const addSavedSpots = (spots: Spot[]) => setSavedSpots(prev => [...prev, ...spots]);

  return (
    <AppContext.Provider value={{
      onboarded, user, trips, savedSpots, currentTrip,
      setOnboarded, setUser, addTrip, deleteTrip, addSavedSpots, setCurrentTrip
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
