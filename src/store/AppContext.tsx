import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Spot, Trip } from '../services/geminiService';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useToast } from './ToastContext';

interface AppContextType {
  onboarded: boolean;
  user: { 
    name: string; 
    avatar: string; 
    bio?: string; 
    uid: string;
    preferences?: {
      travelStyle: string;
      budget: string;
      interests: string[];
    }
  } | null;
  trips: Trip[];
  savedSpots: Spot[];
  savedReels: string[];
  importHistory: { id: string; destination: string; timestamp: number }[];
  currentTrip: Trip | null;
  setOnboarded: (val: boolean) => void;
  setUser: (user: { name: string; avatar: string; bio?: string; uid: string; preferences?: any } | null) => void;
  updateUser: (data: Partial<AppContextType['user']>) => Promise<void>;
  addTrip: (trip: Trip) => void;
  deleteTrip: (id: string) => void;
  addSavedSpots: (spots: Spot[]) => void;
  toggleSavedReel: (id: string) => void;
  addImportHistory: (destination: string) => void;
  setCurrentTrip: (trip: Trip | null) => void;
  searchHistory: string[];
  addSearch: (destination: string) => void;
  isAuthReady: boolean;
  showToast: (message: string) => void;
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Track subscriptions to prevent memory leaks
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const authUnsubscribeRef = useRef<(() => void) | null>(null);

  // Auth state listener
  useEffect(() => {
    const handleAuthChange = async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const newUser = {
              name: userData.name || firebaseUser.displayName || 'User',
              avatar: userData.avatar || firebaseUser.photoURL || '',
              bio: userData.bio || '',
              uid: firebaseUser.uid,
              preferences: userData.preferences
            };
            setUser(newUser);
            setTrips(userData.trips || []);
            setSavedSpots(userData.savedSpots || []);
            setSavedReels(userData.savedReels || []);
            setImportHistory(userData.importHistory || []);
            setSearchHistory(userData.searchHistory || []);
            setOnboarded(true);
            setError(null);
          } else {
            // New user creation
            const newUser = {
              name: firebaseUser.displayName || 'User',
              avatar: firebaseUser.photoURL || '',
              bio: '',
              uid: firebaseUser.uid,
              trips: [],
              savedSpots: [],
              savedReels: [],
              importHistory: [],
              searchHistory: []
            };
            await setDoc(userDocRef, newUser);
            setUser(newUser);
            setTrips([]);
            setSavedSpots([]);
            setSavedReels([]);
            setImportHistory([]);
            setSearchHistory([]);
            setOnboarded(false); // Let user go through onboarding
            setError(null);
          }
        } else {
          // User logged out
          setUser(null);
          setTrips([]);
          setSavedSpots([]);
          setSavedReels([]);
          setImportHistory([]);
          setSearchHistory([]);
          setOnboarded(false);
          setError(null);

          // Clean up snapshot subscription
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error during auth change';
        console.error('Auth state change error:', errorMsg);
        setError(errorMsg);
        showToast('Authentication error: ' + errorMsg);
      } finally {
        setIsAuthReady(true);
      }
    };

    // Subscribe to auth changes
    authUnsubscribeRef.current = onAuthStateChanged(auth, handleAuthChange);

    return () => {
      if (authUnsubscribeRef.current) {
        authUnsubscribeRef.current();
      }
    };
  }, [showToast]);

  // Firestore snapshot listener (only when user is logged in)
  useEffect(() => {
    if (!user?.uid) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      unsubscribeRef.current = onSnapshot(
        userDocRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setTrips(data.trips || []);
            setSavedSpots(data.savedSpots || []);
            setSavedReels(data.savedReels || []);
            setImportHistory(data.importHistory || []);
            setSearchHistory(data.searchHistory || []);
          }
        },
        (err) => {
          console.error('Firestore snapshot error:', err);
          setError(err.message);
          showToast('Failed to sync data: ' + err.message);
        }
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Firestore subscription error:', errorMsg);
      setError(errorMsg);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.uid, showToast]);

  // Helper to update user document with error handling
  const updateUserDoc = async (
    data: Partial<
      AppContextType['user'] & {
        trips: Trip[];
        savedSpots: Spot[];
        savedReels: string[];
        importHistory: any[];
        searchHistory: string[];
      }
    >
  ) => {
    if (!user?.uid) {
      console.warn('Cannot update user doc: No user uid');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to update user document:', errorMsg);
      setError(errorMsg);
      showToast('Failed to save changes: ' + errorMsg);
      throw err; // Re-throw for caller to handle
    }
  };

  const updateUser = async (data: Partial<AppContextType['user']>) => {
    if (!user) {
      console.warn('Cannot update user: No user logged in');
      return;
    }

    try {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      await updateUserDoc(data);
      showToast('Profile updated successfully');
      setError(null);
    } catch (err) {
      // Error already handled in updateUserDoc
      setUser(user); // Revert state on error
    }
  };

  const addTrip = (trip: Trip) => {
    setTrips((prevTrips) => {
      const newTrips = [...prevTrips];
      const index = newTrips.findIndex((t) => t.id === trip.id);
      if (index !== -1) {
        newTrips[index] = trip;
      } else {
        newTrips.push(trip);
      }
      updateUserDoc({ trips: newTrips }).catch((err) => {
        console.error('Failed to add trip:', err);
        showToast('Failed to save trip');
      });
      return newTrips;
    });
  };

  const deleteTrip = (id: string) => {
    setTrips((prevTrips) => {
      const newTrips = prevTrips.filter((t) => t.id !== id);
      updateUserDoc({ trips: newTrips }).catch((err) => {
        console.error('Failed to delete trip:', err);
        showToast('Failed to delete trip');
      });
      return newTrips;
    });
  };

  const addSavedSpots = (spots: Spot[]) => {
    setSavedSpots((prevSpots) => {
      const newSpots = [
        ...prevSpots,
        ...spots.filter((s) => !prevSpots.some((p) => p.id === s.id))
      ];
      updateUserDoc({ savedSpots: newSpots }).catch((err) => {
        console.error('Failed to add saved spots:', err);
        showToast('Failed to save spots');
      });
      return newSpots;
    });
  };

  const addImportHistory = (destination: string) => {
    setImportHistory((prevHistory) => {
      // Limit history to 50 entries to prevent unbounded growth
      const newHistory = [
        { id: Date.now().toString(), destination, timestamp: Date.now() },
        ...prevHistory
      ].slice(0, 50);
      updateUserDoc({ importHistory: newHistory }).catch((err) => {
        console.error('Failed to add import history:', err);
        showToast('Failed to save import history');
      });
      return newHistory;
    });
  };

  const toggleSavedReel = (id: string) => {
    setSavedReels((prevReels) => {
      const newReels = prevReels.includes(id)
        ? prevReels.filter((r) => r !== id)
        : [...prevReels, id];
      updateUserDoc({ savedReels: newReels }).catch((err) => {
        console.error('Failed to toggle saved reel:', err);
        showToast('Failed to save reel');
      });
      return newReels;
    });
  };

  const addSearch = (destination: string) => {
    setSearchHistory((prevHistory) => {
      const newHistory = [
        destination,
        ...prevHistory.filter((s) => s !== destination)
      ].slice(0, 10);
      updateUserDoc({ searchHistory: newHistory }).catch((err) => {
        console.error('Failed to add search history:', err);
        // Don't show toast for search history as it's not critical
      });
      return newHistory;
    });
  };

  const value: AppContextType = {
    onboarded,
    user,
    trips,
    savedSpots,
    savedReels,
    importHistory,
    searchHistory,
    currentTrip,
    setOnboarded,
    setUser,
    updateUser,
    addTrip,
    deleteTrip,
    addSavedSpots,
    toggleSavedReel,
    addImportHistory,
    setCurrentTrip,
    addSearch,
    isAuthReady,
    showToast,
    error
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
