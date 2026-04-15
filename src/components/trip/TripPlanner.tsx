import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronLeft, Calendar, Check, Sparkles, MapPin, Clock, Info, Zap } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useToast } from '../../store/ToastContext';
import { geminiService, Spot, Trip } from '../../services/geminiService';
import { cn } from '../../lib/utils';

const PREFERENCES = [
  { id: 'popular', label: 'Popular', icon: '📌' },
  { id: 'museum', label: 'Museum', icon: '🏛️' },
  { id: 'nature', label: 'Nature', icon: '🌿' },
  { id: 'foodie', label: 'Foodie', icon: '🍕' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
];

export const TripPlanner = ({ onClose, initialDestination = '', initialSpots, initialDuration = 3 }: { onClose: () => void, initialDestination?: string, initialSpots?: Spot[], initialDuration?: number }) => {
  const { showToast } = useToast();
  const [step, setStep] = useState<'destination' | 'preferences' | 'duration' | 'budget' | 'spots' | 'planning'>(
    (initialSpots && initialSpots.length > 0) || initialDestination ? 'preferences' : 'destination'
  );
  const [budget, setBudget] = useState(1000);
  const [destination, setDestination] = useState(initialDestination);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [duration, setDuration] = useState(initialDuration);
  const [isFlexible, setIsFlexible] = useState(true);
  const [availableSpots, setAvailableSpots] = useState<Spot[]>(initialSpots || []);
  const [selectedSpots, setSelectedSpots] = useState<string[]>(initialSpots ? initialSpots.map(s => s.id) : []);
  const { addTrip, setCurrentTrip } = useApp();

  const handleDestinationSubmit = async () => {
    setStep('preferences');
  };

  const handlePreferencesSubmit = () => {
    setStep('duration');
  };

  const handleDurationSubmit = async () => {
    setStep('budget');
  };

  const handleBudgetSubmit = async () => {
    if (initialSpots && initialSpots.length > 0) {
      // If we have initial spots (like saved spots), we skip fetching and go straight to spots selection
      setStep('spots');
      return;
    }
    setStep('planning');
    try {
      // Simulate finding spots based on destination and preferences
      const spots = await geminiService.extractSpotsFromText(`Best ${selectedPrefs.join(', ')} places to visit in ${destination}`);
      setAvailableSpots(spots);
      setSelectedSpots(spots.map(s => s.id));
      setStep('spots');
    } catch (e) {
      showToast("Failed to find spots. Please try again.");
      setStep('budget');
    }
  };

  const handlePlanTrip = async () => {
    const spotsToPlan = availableSpots.filter(s => selectedSpots.includes(s.id));
    
    if (spotsToPlan.length === 0) {
      showToast("Please select at least one spot.");
      return;
    }

    setStep('planning');
    
    if (initialSpots && initialSpots.length > 0) {
      try {
        const trip = await geminiService.planTripFromSavedSpots(spotsToPlan, duration, selectedPrefs);
        addTrip(trip);
        setCurrentTrip(trip);
        onClose();
        return;
      } catch (e) {
        showToast("Failed to plan trip from saved spots.");
        setStep('spots');
        return;
      }
    }

    // Check if we should suggest more spots
    if (spotsToPlan.length < duration * 2) {
      // Use a simpler flow since we can't use confirm in iframe
      showToast("Adding some hidden gems to fill your days!");
      setStep('planning');
      try {
        // In a real app, we'd fetch more spots here
        const extraSpots = await geminiService.extractSpotsFromText(`More hidden gems and must-visit places in ${destination}`);
        const combinedSpots = [...spotsToPlan, ...extraSpots.slice(0, 3)];
        const { itinerary, budget, hotels } = await geminiService.planItinerary(destination, duration, combinedSpots);
        
        const newTrip: Trip = {
          id: Math.random().toString(36).substr(2, 9),
          destination,
          duration,
          budget,
          hotels,
          spots: combinedSpots,
          itinerary
        };

        addTrip(newTrip);
        setCurrentTrip(newTrip);
        onClose();
        return;
      } catch (e) {
        showToast("Failed to plan trip. Please try again.");
        setStep('spots');
        return;
      }
    }

    setStep('planning');
    try {
      const { itinerary, budget, hotels } = await geminiService.planItinerary(destination, duration, spotsToPlan);
      
      const newTrip: Trip = {
        id: Math.random().toString(36).substr(2, 9),
        destination,
        duration,
        budget,
        hotels,
        spots: spotsToPlan,
        itinerary
      };

      addTrip(newTrip);
      setCurrentTrip(newTrip);
      onClose();
    } catch (e) {
      showToast("Failed to plan trip. Please try again.");
      setStep('spots');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 bg-white z-[9999] flex flex-col items-center"
    >
      <div className="w-full max-w-3xl flex flex-col h-full relative">
        {/* Header */}
        <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: "20%" }}
              animate={{ 
                width: step === 'destination' ? "20%" : 
                       step === 'preferences' ? "40%" : 
                       step === 'duration' ? "60%" : 
                       step === 'spots' ? "80%" : "100%" 
              }}
              className="h-full bg-brand"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-32">
        <AnimatePresence mode="wait">
          {step === 'destination' && (
            <motion.div 
              key="destination"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-display font-bold text-slate-900">Where are we going?</h2>
                <p className="text-slate-500">Search for your destination</p>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  autoFocus
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && destination && handleDestinationSubmit()}
                  placeholder="Search for spots"
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-lg focus:ring-2 focus:ring-brand/20"
                />
              </div>
              {destination && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleDestinationSubmit}
                  className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                >
                  Let's go to {destination}!
                  <ChevronLeft size={20} className="rotate-180" />
                </motion.button>
              )}
            </motion.div>
          )}

          {step === 'preferences' && (
            <motion.div 
              key="preferences"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-display font-bold text-slate-900">Trip Preferences</h2>
                <p className="text-slate-500">What should your trip be about?</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {PREFERENCES.map(pref => (
                  <button 
                    key={pref.id}
                    onClick={() => setSelectedPrefs(prev => 
                      prev.includes(pref.id) ? prev.filter(p => p !== pref.id) : [...prev, pref.id]
                    )}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex items-center gap-3",
                      selectedPrefs.includes(pref.id) 
                        ? "bg-brand-light border-brand text-brand" 
                        : "bg-white border-slate-100 text-slate-600"
                    )}
                  >
                    <span className="text-xl">{pref.icon}</span>
                    <span className="font-bold text-sm">{pref.label}</span>
                  </button>
                ))}
              </div>
              <button 
                onClick={handlePreferencesSubmit}
                className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand/20"
              >
                Continue
              </button>
            </motion.div>
          )}

              {step === 'duration' && (
                <motion.div 
                  key="duration"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-8 space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-display font-bold text-slate-900">Trip Duration</h2>
                    <p className="text-slate-500">How many days?</p>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button 
                      onClick={() => setIsFlexible(false)}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                        !isFlexible ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      )}
                    >
                      Dates
                    </button>
                    <button 
                      onClick={() => setIsFlexible(true)}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                        isFlexible ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      )}
                    >
                      Flexible
                    </button>
                  </div>

                  <div className="flex flex-col items-center gap-8">
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={() => setDuration(Math.max(1, duration - 1))}
                        className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center text-2xl font-bold text-slate-400"
                      >
                        -
                      </button>
                      <div className="text-6xl font-display font-bold text-slate-900">{duration}</div>
                      <button 
                        onClick={() => setDuration(duration + 1)}
                        className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center text-2xl font-bold text-slate-400"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-slate-400 font-medium">Days</div>
                  </div>
                  <button 
                    onClick={handleDurationSubmit}
                    className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand/20"
                  >
                    Continue
                  </button>
                </motion.div>
              )}

              {step === 'budget' && (
                <motion.div 
                  key="budget"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-8 space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-display font-bold text-slate-900">Trip Budget</h2>
                    <p className="text-slate-500">What is your estimated budget?</p>
                  </div>

                  <div className="flex flex-col items-center gap-8">
                    <div className="text-6xl font-display font-bold text-slate-900">${budget}</div>
                    <input 
                      type="range"
                      min="100"
                      max="10000"
                      step="100"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand"
                    />
                  </div>
                  <button 
                    onClick={handleBudgetSubmit}
                    className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand/20"
                  >
                    {initialSpots && initialSpots.length > 0 ? 'Review Spots' : 'Find Spots'}
                  </button>
                </motion.div>
              )}

          {step === 'planning' && (
            <motion.div key="planning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-2 w-full">
                  <div className="h-8 bg-slate-200 rounded-lg w-1/2 animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded-lg w-3/4 animate-pulse" />
                </div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="p-3 rounded-2xl border-2 border-slate-100 bg-white flex gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-slate-100 rounded w-1/4 animate-pulse" />
                      <div className="h-3 bg-slate-100 rounded w-full animate-pulse" />
                    </div>
                    <div className="flex items-center pr-2">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-100 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-xl border-t border-slate-100">
                <div className="w-full h-14 bg-slate-200 rounded-2xl animate-pulse" />
              </div>
            </motion.div>
          )}

          {step === 'spots' && (
            <motion.div 
              key="spots"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-3xl font-display font-bold text-slate-900">Choose spots</h2>
                  <p className="text-slate-500">Select the places you'd like to visit</p>
                </div>
                <button 
                  onClick={() => showToast("AI Enhancement active! Finding hidden gems...")}
                  className="flex items-center gap-1.5 text-brand text-xs font-bold bg-brand/10 px-3 py-1.5 rounded-full"
                >
                  <Zap size={14} />
                  Enhance
                </button>
              </div>
              <div className="space-y-4">
                {availableSpots.map(spot => (
                  <motion.div 
                    key={spot.id}
                    onClick={() => setSelectedSpots(prev => 
                      prev.includes(spot.id) ? prev.filter(id => id !== spot.id) : [...prev, spot.id]
                    )}
                    className={cn(
                      "p-3 rounded-2xl border-2 transition-all flex gap-4 cursor-pointer",
                      selectedSpots.includes(spot.id) ? "bg-brand-light border-brand" : "bg-white border-slate-100"
                    )}
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={spot.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{spot.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">{spot.category}</div>
                      <div className="text-xs text-slate-500 line-clamp-1 mt-1">{spot.description}</div>
                    </div>
                    <div className="flex items-center pr-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                        selectedSpots.includes(spot.id) ? "bg-brand border-brand text-white" : "border-slate-200"
                      )}>
                        {selectedSpots.includes(spot.id) && <Check size={14} strokeWidth={3} />}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-xl border-t border-slate-100">
                <button 
                  onClick={handlePlanTrip}
                  className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} />
                  Plan {selectedSpots.length} spots
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </motion.div>
  );
};
