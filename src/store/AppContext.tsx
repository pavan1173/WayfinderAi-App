import React, { createContext, useContext, useState, useEffect } from 'react';
import { Spot, Trip } from '../services/geminiService';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';

interface AppContextType {
  onboarded: boolean;
  user: { name: string; avatar: string; bio?: string; uid: string } | null;
  trips: Trip[];
  savedSpots: Spot[];
  savedReels: string[];
  importHistory: { id: string; destination: string; timestamp: number }[];
  currentTrip: Trip | null;
  setOnboarded: (val: boolean) => void;
  setUser: (user: { name: string; avatar: string; bio?: string; uid: string } | null) => void;
  addTrip: (trip: Trip) => void;
  deleteTrip: (id: string) => void;
  addSavedSpots: (spots: Spot[]) => void;
  toggleSavedReel: (id: string) => void;
  addImportHistory: (destination: string) => void;
  setCurrentTrip: (trip: Trip | null) => void;
  searchHistory: string[];
  addSearch: (destination: string) => void;
  isAuthReady: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [onboarded, setOnboarded] = useState(false);
  const [user, setUser] = useState<AppContextType['user']>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [savedSpots, setSavedSpots] = useState<Spot[]>([]);
  const [savedReels, setSavedReels] = useState<string[]>([]);
  const [importHistory, setImportHistory] = useState<{ id: string; destination: string; timestamp: number }[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({ name: userData.name || firebaseUser.displayName || 'User', avatar: userData.avatar || firebaseUser.photoURL || '', bio: userData.bio || '', uid: firebaseUser.uid });
          setTrips(userData.trips || []);
          setSavedSpots(userData.savedSpots || []);
          setSavedReels(userData.savedReels || []);
          setImportHistory(userData.importHistory || []);
          setSearchHistory(userData.searchHistory || []);
        } else {
          const newUser = { name: firebaseUser.displayName || 'User', avatar: firebaseUser.photoURL || '', bio: '', uid: firebaseUser.uid, trips: [], savedSpots: [], savedReels: [], importHistory: [], searchHistory: [] };
          await setDoc(userDocRef, newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
        setTrips([]);
        setSavedSpots([]);
        setSavedReels([]);
        setImportHistory([]);
        setSearchHistory([]);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setTrips(data.trips || []);
          setSavedSpots(data.savedSpots || []);
          setSavedReels(data.savedReels || []);
          setImportHistory(data.importHistory || []);
          setSearchHistory(data.searchHistory || []);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const updateUserDoc = async (data: Partial<AppContextType['user'] & { trips: Trip[], savedSpots: Spot[], savedReels: string[], importHistory: any[], searchHistory: string[] }>) => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), data);
    }
  };

  const addTrip = (trip: Trip) => {
    const newTrips = [...trips];
    const index = newTrips.findIndex(t => t.id === trip.id);
    if (index !== -1) newTrips[index] = trip;
    else newTrips.push(trip);
    setTrips(newTrips);
    updateUserDoc({ trips: newTrips });
  };
  const deleteTrip = (id: string) => {
    const newTrips = trips.filter(t => t.id !== id);
    setTrips(newTrips);
    updateUserDoc({ trips: newTrips });
  };
  const addSavedSpots = (spots: Spot[]) => {
    const newSpots = [...savedSpots, ...spots.filter(s => !savedSpots.some(p => p.id === s.id))];
    setSavedSpots(newSpots);
    updateUserDoc({ savedSpots: newSpots });
  };
  const addImportHistory = (destination: string) => {
    const newHistory = [{ id: Date.now().toString(), destination, timestamp: Date.now() }, ...importHistory];
    setImportHistory(newHistory);
    updateUserDoc({ importHistory: newHistory });
  };
  const toggleSavedReel = (id: string) => {
    const newReels = savedReels.includes(id) ? savedReels.filter(r => r !== id) : [...savedReels, id];
    setSavedReels(newReels);
    updateUserDoc({ savedReels: newReels });
  };
  const addSearch = (destination: string) => {
    const newHistory = [destination, ...searchHistory.filter(s => s !== destination)].slice(0, 10);
    setSearchHistory(newHistory);
    updateUserDoc({ searchHistory: newHistory });
  };

  return (
    <AppContext.Provider value={{
      onboarded, user, trips, savedSpots, savedReels, importHistory, searchHistory, currentTrip,
      setOnboarded, setUser, addTrip, deleteTrip, addSavedSpots, toggleSavedReel, addImportHistory, setCurrentTrip, addSearch, isAuthReady
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
