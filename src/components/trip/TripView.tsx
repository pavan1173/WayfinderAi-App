import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Share2, Edit2, Map as MapIcon, List, Clock, Navigation, Info, X, Star, Globe, Phone, MapPin, Music, Sparkles, Save, Check, Zap, Plus, ExternalLink, Utensils, Landmark, Camera, Tent, ShoppingBag, Coffee, Calendar } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useToast } from '../../store/ToastContext';
import { Spot, Trip, geminiService } from '../../services/geminiService';
import { cn } from '../../lib/utils';
import { MapView } from './MapView';
import ReactMarkdown from 'react-markdown';

export const TripView = ({ trip, onClose }: { trip: Trip, onClose: () => void }) => {
  const { addTrip, trips, setCurrentTrip } = useApp();
  const currentTrip = trip;
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'discover'>('overview');
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDestination, setEditedDestination] = useState('');
  const [editedDates, setEditedDates] = useState('');
  const [editedDuration, setEditedDuration] = useState(1);
  const [spotDetails, setSpotDetails] = useState<Partial<Spot>>({});
  const [nearbySpots, setNearbySpots] = useState<Spot[]>([]);
  const [isGettingNearby, setIsGettingNearby] = useState(false);
  const [spotPlan, setSpotPlan] = useState<string | null>(null);
  const [isGettingSpotPlan, setIsGettingSpotPlan] = useState(false);
  const [savedSpotDetails, setSavedSpotDetails] = useState<{ shortDescription: string, keywords: string[], newThings: string, upcomingEvents: string } | null>(null);
  const [isGettingSavedSpotDetails, setIsGettingSavedSpotDetails] = useState(false);
  const [fastInfo, setFastInfo] = useState<string | null>(null);
  const [isGettingFastInfo, setIsGettingFastInfo] = useState(false);
  const [discoverInfo, setDiscoverInfo] = useState<string | null>(null);
  const [isGettingDiscoverInfo, setIsGettingDiscoverInfo] = useState(false);
  const [promptModal, setPromptModal] = useState<{ isOpen: boolean, title: string, onSubmit: (val: string) => void, onCancel: () => void }>({ isOpen: false, title: '', onSubmit: () => {}, onCancel: () => {} });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (currentTrip) {
      setEditedDestination(currentTrip.destination);
      setEditedDates(currentTrip.dates || '');
      setEditedDuration(currentTrip.duration);
    }
    if (currentTrip && trips.find(t => t.id === currentTrip.id)) {
      setIsSaved(true);
    } else {
      setIsSaved(false);
    }
  }, [currentTrip, trips]);

  React.useEffect(() => {
    if (activeTab === 'discover' && !discoverInfo && !isGettingDiscoverInfo && currentTrip) {
      setIsGettingDiscoverInfo(true);
      geminiService.getDiscoverInfo(currentTrip.destination).then(info => {
        setDiscoverInfo(info);
        setIsGettingDiscoverInfo(false);
      }).catch(err => {
        console.error(err);
        setDiscoverInfo("Failed to load discover info.");
        setIsGettingDiscoverInfo(false);
      });
    }
  }, [activeTab, discoverInfo, isGettingDiscoverInfo, currentTrip]);

  const handleToggleEdit = () => {
    if (isEditing && currentTrip) {
      // Save changes
      const updatedTrip = {
        ...currentTrip,
        destination: editedDestination,
        dates: editedDates,
        duration: editedDuration
      };
      setCurrentTrip(updatedTrip);
      // If it's already in the saved trips, update it there too
      if (trips.find(t => t.id === currentTrip.id)) {
        addTrip(updatedTrip); // addTrip handles updates if ID matches (though current implementation might need check)
      }
    }
    setIsEditing(!isEditing);
  };

  const handleSaveTrip = () => {
    if (currentTrip) {
      addTrip(currentTrip);
      setIsSaved(true);
    }
  };

  const scrollToDay = (dayNumber: number) => {
    const element = document.getElementById(`day-${dayNumber}`);
    if (element && scrollContainerRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleReadItinerary = async () => {
    if (!currentTrip) return;
    setIsReading(true);
    const text = currentTrip.itinerary.map(day => 
      `Day ${day.day}: ${day.spots.map(s => s.name).join(', ')}`
    ).join('. ');
    
    try {
      const base64Audio = await geminiService.generateSpeech(text);
      if (base64Audio) {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audio.onended = () => setIsReading(false);
        audio.play();
      } else {
        setIsReading(false);
      }
    } catch (e) {
      setIsReading(false);
      showToast("Failed to generate speech.");
    }
  };

  const handleSpotClick = async (spot: Spot) => {
    setSelectedSpot(spot);
    setSpotDetails({});
    setFastInfo(null);
    setSpotPlan(null);
    setSavedSpotDetails(null);
    setIsGettingFastInfo(true);
    setIsGettingSpotPlan(true);
    setIsGettingSavedSpotDetails(true);
    
    // Get fast info first
    geminiService.getFastSpotInfo(spot.name).then(info => {
      setFastInfo(info);
      setIsGettingFastInfo(false);
    }).catch(() => setIsGettingFastInfo(false));

    // Get spot plan
    if (currentTrip) {
      geminiService.getSpotPlan(spot.name, currentTrip.destination).then(plan => {
        setSpotPlan(plan);
        setIsGettingSpotPlan(false);
      }).catch(() => setIsGettingSpotPlan(false));
    }

    // Get saved spot details (basic details, new things, upcoming events)
    geminiService.getSavedSpotDetails(spot.name).then(details => {
      setSavedSpotDetails(details);
      setIsGettingSavedSpotDetails(false);
    }).catch(() => setIsGettingSavedSpotDetails(false));

    // Then get full maps details
    try {
      const details = await geminiService.getSpotDetailsWithMaps(spot.name);
      setSpotDetails(details);
      setSelectedSpot(prev => prev ? { ...prev, ...details } : prev);

      // Fetch nearby spots
      if (details.lat && details.lng) {
        setIsGettingNearby(true);
        try {
          const nearby = await geminiService.getNearbySpots(details.lat, details.lng);
          setNearbySpots(nearby);
        } catch (e) {
          console.error("Failed to get nearby spots", e);
        } finally {
          setIsGettingNearby(false);
        }
      }
    } catch (e) {
      console.error("Failed to get spot details", e);
    }
  };

  const handleAddNearbySpot = (spot: Spot) => {
    if (!currentTrip) return;
    
    // Create a new spot object with a guaranteed unique ID for this trip
    const newSpot = {
      ...spot,
      id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4)
    };

    const updatedTrip = {
      ...currentTrip,
      spots: [...currentTrip.spots, newSpot],
      itinerary: currentTrip.itinerary.map(day => ({ ...day, spots: [...day.spots] }))
    };
    
    // Add to the last day by default, or create day 1 if empty
    if (updatedTrip.itinerary.length > 0) {
      updatedTrip.itinerary[updatedTrip.itinerary.length - 1].spots.push(newSpot);
    } else {
      updatedTrip.itinerary.push({ day: 1, spots: [newSpot] });
    }
    
    setCurrentTrip(updatedTrip);
    if (trips.find(t => t.id === currentTrip.id)) {
      addTrip(updatedTrip);
    }
    showToast(`Added ${spot.name} to your trip!`);
  };

  const handleShare = async () => {
    if (!currentTrip) return;
    
    const shareText = `Check out my ${currentTrip.duration}-day trip to ${currentTrip.destination} planned with Wayfinder Ai!\n\n` + 
      currentTrip.itinerary.map(day => 
        `Day ${day.day}:\n${day.spots.map(s => `- ${s.name}`).join('\n')}`
      ).join('\n\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentTrip.destination} Trip Itinerary`,
          text: shareText,
          url: window.location.href
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        showToast('Itinerary copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleAddPlace = async () => {
    setPromptModal({
      isOpen: true,
      title: "Enter the name of the place you want to add:",
      onSubmit: async (name) => {
        setPromptModal(prev => ({ ...prev, isOpen: false }));
        if (!name || !currentTrip) return;
        
        const tempId = `temp-${Date.now()}`;
        const tempSpot: Spot = {
          id: tempId,
          name: name,
          description: "Loading details...",
          category: "...",
          imageUrl: `https://picsum.photos/seed/${name.replace(/\s/g, '')}/400/300`
        };

        // Optimistic update
        const optimisticTrip = {
          ...currentTrip,
          spots: [...currentTrip.spots, tempSpot],
          itinerary: [...currentTrip.itinerary]
        };
        optimisticTrip.itinerary[optimisticTrip.itinerary.length - 1].spots.push(tempSpot);
        setCurrentTrip(optimisticTrip);
        
        try {
          const spots = await geminiService.extractSpotsFromText(name);
          if (spots.length > 0) {
            const newSpot = spots[0];
            const updatedTrip = {
              ...optimisticTrip,
              spots: optimisticTrip.spots.map(s => s.id === tempId ? newSpot : s),
              itinerary: optimisticTrip.itinerary.map(day => ({
                ...day,
                spots: day.spots.map(s => s.id === tempId ? newSpot : s)
              }))
            };
            setCurrentTrip(updatedTrip);
            if (trips.find(t => t.id === updatedTrip.id)) {
              addTrip(updatedTrip);
            }
          } else {
            // Revert optimistic update
            setCurrentTrip(currentTrip);
            showToast("Could not find that place.");
          }
        } catch (error) {
          console.error("Error adding place:", error);
          // Revert optimistic update
          setCurrentTrip(currentTrip);
          showToast("Failed to add place.");
        }
      },
      onCancel: () => setPromptModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleAddSpotToDay = async (dayIndex: number) => {
    setPromptModal({
      isOpen: true,
      title: `Enter a spot to add to Day ${dayIndex + 1}:`,
      onSubmit: async (name) => {
        setPromptModal(prev => ({ ...prev, isOpen: false }));
        if (!name || !currentTrip) return;

        const tempId = `temp-${Date.now()}`;
        const tempSpot: Spot = {
          id: tempId,
          name: name,
          description: "Loading details...",
          category: "...",
          imageUrl: `https://picsum.photos/seed/${name.replace(/\s/g, '')}/400/300`
        };

        // Optimistic update
        const optimisticItinerary = [...currentTrip.itinerary];
        optimisticItinerary[dayIndex].spots = [...optimisticItinerary[dayIndex].spots, tempSpot];
        
        const optimisticTrip = {
          ...currentTrip,
          spots: [...currentTrip.spots, tempSpot],
          itinerary: optimisticItinerary
        };
        setCurrentTrip(optimisticTrip);

        try {
          const spots = await geminiService.extractSpotsFromText(name);
          if (spots.length > 0) {
            const newSpot = spots[0];
            const updatedTrip = {
              ...optimisticTrip,
              spots: optimisticTrip.spots.map(s => s.id === tempId ? newSpot : s),
              itinerary: optimisticTrip.itinerary.map(day => ({
                ...day,
                spots: day.spots.map(s => s.id === tempId ? newSpot : s)
              }))
            };
            setCurrentTrip(updatedTrip);
            if (trips.find(t => t.id === updatedTrip.id)) {
              addTrip(updatedTrip);
            }
          } else {
            // Revert optimistic update
            setCurrentTrip(currentTrip);
            showToast("Could not find that place.");
          }
        } catch (error) {
          console.error("Error adding spot:", error);
          // Revert optimistic update
          setCurrentTrip(currentTrip);
          showToast("Failed to add spot.");
        }
      },
      onCancel: () => setPromptModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleOptimize = async () => {
    if (!currentTrip) return;
    setIsReading(true);
    try {
      const { itinerary: optimizedItinerary, budget, hotels } = await geminiService.planItinerary(currentTrip.destination, currentTrip.duration, currentTrip.spots);
      const updatedTrip = {
        ...currentTrip,
        itinerary: optimizedItinerary,
        budget: budget || currentTrip.budget,
        hotels: hotels || currentTrip.hotels
      };
      setCurrentTrip(updatedTrip);
      if (trips.find(t => t.id === currentTrip.id)) {
        addTrip(updatedTrip);
      }
      showToast('Itinerary optimized for travel time!');
    } catch (error) {
      console.error("Error optimizing:", error);
      showToast("Failed to optimize itinerary.");
    }
    setIsReading(false);
  };

  const openDirections = (spot: Spot) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(spot.name)}&destination_place_id=${spot.mapsUri?.split('place_id=')[1] || ''}`;
    window.open(url, '_blank');
  };

  const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('restaurant') || c.includes('food')) return <Utensils size={14} className="text-orange-400" />;
    if (c.includes('attraction') || c.includes('landmark')) return <Landmark size={14} className="text-blue-400" />;
    if (c.includes('photo') || c.includes('view')) return <Camera size={14} className="text-purple-400" />;
    if (c.includes('park') || c.includes('nature')) return <Tent size={14} className="text-green-400" />;
    if (c.includes('shop')) return <ShoppingBag size={14} className="text-pink-400" />;
    if (c.includes('cafe')) return <Coffee size={14} className="text-yellow-600" />;
    return <MapPin size={14} className="text-slate-400" />;
  };

  if (!currentTrip) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 bg-white z-40 flex flex-col md:flex-row"
    >
      {/* Map Area */}
      <div className="relative h-[35vh] md:h-screen md:w-1/2 lg:w-3/5 bg-slate-200 overflow-hidden order-1 md:order-2">
        <MapView 
          spots={currentTrip.spots} 
          activeSpot={selectedSpot} 
          showRoute={true}
          orderedSpots={currentTrip.itinerary.flatMap(day => day.spots)}
          nearbySpots={nearbySpots}
          onSpotClick={handleSpotClick}
          onAddNearbySpot={handleAddNearbySpot}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-12 left-6 right-6 flex items-center justify-between z-[1000]">
          <button onClick={onClose} className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
            <ChevronLeft size={24} />
          </button>
          <div className="flex gap-2">
            <button 
              onClick={handleToggleEdit}
              className={cn(
                "px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-bold text-sm transition-colors",
                isEditing ? "bg-brand text-white" : "bg-white text-slate-900"
              )}
            >
              {isEditing ? <Check size={16} /> : <Edit2 size={16} />}
              {isEditing ? 'Save' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 md:w-1/2 lg:w-2/5 bg-white -mt-8 md:mt-0 rounded-t-[2.5rem] md:rounded-none shadow-2xl overflow-hidden flex flex-col order-2 md:order-1 z-10">
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between mb-2">
            {isEditing ? (
              <div className="flex items-center flex-1 mr-4">
                <input 
                  type="text"
                  value={editedDestination}
                  onChange={(e) => setEditedDestination(e.target.value)}
                  className="text-2xl font-display font-bold text-slate-900 bg-slate-50 border-none focus:ring-2 focus:ring-brand rounded-lg px-2 py-1 w-full"
                  autoFocus
                />
                <span className="text-2xl font-display font-bold text-slate-900 ml-2">Trip</span>
              </div>
            ) : (
              <h1 className="text-2xl font-display font-bold text-slate-900">{currentTrip.destination} Trip</h1>
            )}
            <div className="flex gap-2">
              <button 
                onClick={handleSaveTrip}
                disabled={isSaved}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isSaved ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-600"
                )}
              >
                {isSaved ? <Check size={20} /> : <Save size={20} />}
              </button>
              <button 
                onClick={handleReadItinerary}
                disabled={isReading}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isReading ? "bg-brand text-white animate-pulse" : "bg-slate-50 text-slate-600"
                )}
              >
                <Music size={20} />
              </button>
              <button 
                onClick={handleShare}
                className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"
              >
                <Share2 size={20} className="text-slate-600" />
              </button>
            </div>
          </div>
          <div className="text-sm text-slate-500 mb-6">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  min="1"
                  max="30"
                  value={editedDuration}
                  onChange={(e) => setEditedDuration(parseInt(e.target.value) || 1)}
                  className="bg-slate-50 border-none focus:ring-1 focus:ring-brand rounded px-2 py-0.5 text-sm w-16"
                />
                <span>days • {currentTrip.spots.length} spots • </span>
                <input 
                  type="text"
                  value={editedDates}
                  onChange={(e) => setEditedDates(e.target.value)}
                  placeholder="e.g. Mar 12 - 15"
                  className="bg-slate-50 border-none focus:ring-1 focus:ring-brand rounded px-2 py-0.5 text-sm"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{currentTrip.duration} days • {currentTrip.spots.length} spots • {currentTrip.dates || 'Choose dates'}</span>
                {currentTrip.budget && <span className="text-emerald-600 font-medium ml-2">• {currentTrip.budget}</span>}
                <button onClick={handleToggleEdit} className="text-brand hover:text-brand-dark transition-colors">
                  <Edit2 size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button 
              onClick={() => setActiveTab('overview')}
              className={cn(
                "flex-1 py-3 font-bold text-sm transition-colors relative",
                activeTab === 'overview' ? "text-slate-900" : "text-slate-400"
              )}
            >
              Overview
              {activeTab === 'overview' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
            </button>
            <button 
              onClick={() => setActiveTab('itinerary')}
              className={cn(
                "flex-1 py-3 font-bold text-sm transition-colors relative",
                activeTab === 'itinerary' ? "text-slate-900" : "text-slate-400"
              )}
            >
              Itinerary
              {activeTab === 'itinerary' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
            </button>
            <button 
              onClick={() => setActiveTab('discover')}
              className={cn(
                "flex-1 py-3 font-bold text-sm transition-colors relative",
                activeTab === 'discover' ? "text-slate-900" : "text-slate-400"
              )}
            >
              Discover
              {activeTab === 'discover' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
            </button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar px-6 pb-8 scroll-smooth">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' ? (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {currentTrip.hotels && currentTrip.hotels.length > 0 && (
                  <div className="space-y-4 mb-8">
                    <h3 className="text-lg font-bold text-slate-800">Recommended Hotels</h3>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
                      {currentTrip.hotels.map((hotel, i) => (
                        <div key={i} className="flex-shrink-0 w-64 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                          <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-32 object-cover" referrerPolicy="no-referrer" />
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-slate-800 line-clamp-1">{hotel.name}</h4>
                              <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                                <Star size={12} fill="currentColor" />
                                {hotel.rating}
                              </div>
                            </div>
                            <div className="text-brand font-bold text-sm mb-2">{hotel.pricePerNight}</div>
                            <p className="text-xs text-slate-500 line-clamp-2">{hotel.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentTrip.itinerary.map((day, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-800">Day {day.day}</h3>
                      {isEditing && (
                        <button 
                          onClick={() => handleAddSpotToDay(i)}
                          className="text-xs text-brand font-bold flex items-center gap-1"
                        >
                          <Plus size={12} />
                          Add Spot
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Itinerary Overview</div>
                      <div className="text-sm text-slate-600 leading-relaxed">
                        {day.spots.map((s, idx) => (
                          <span key={`${s.id}-${idx}`} className="inline-flex items-center group">
                            {s.name}
                            {isEditing && (
                              <button 
                                onClick={() => {
                                  const newItinerary = [...currentTrip.itinerary];
                                  newItinerary[i].spots = newItinerary[i].spots.filter((_, spotIdx) => spotIdx !== idx);
                                  setCurrentTrip({ ...currentTrip, itinerary: newItinerary });
                                }}
                                className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            )}
                            {idx < day.spots.length - 1 && <span className="mx-2">•</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="itinerary"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Day Quick Selector */}
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md py-4 -mx-6 px-6 border-b border-slate-50 flex gap-3 overflow-x-auto no-scrollbar">
                  {currentTrip.itinerary.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToDay(day.day)}
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs hover:bg-brand hover:text-white transition-colors"
                    >
                      Day {day.day}
                    </button>
                  ))}
                </div>

                {currentTrip.itinerary.map((day, i) => (
                  <div key={i} id={`day-${day.day}`} className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-slate-800">Day {day.day}</h3>
                      <button 
                        onClick={handleOptimize}
                        className="text-brand text-xs font-bold flex items-center gap-1 bg-brand/5 px-3 py-1.5 rounded-full"
                      >
                        <Zap size={14} />
                        Optimize
                      </button>
                    </div>
                    <div className="space-y-4">
                      {day.spots.map((spot, j) => (
                        <motion.div 
                          key={j}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSpotClick(spot)}
                          className="flex items-center gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all"
                        >
                          <div className="text-slate-400 font-bold text-lg w-6 text-right">{j + 1}.</div>
                          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
                            <img src={spot.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <Sparkles size={16} className="text-cyan-400 fill-cyan-400" />
                              <div className="font-bold text-slate-800 truncate text-lg">{spot.name}</div>
                            </div>
                            <div className="mt-2 inline-flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
                              {getCategoryIcon(spot.category)}
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{spot.category}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {isEditing && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newItinerary = [...currentTrip.itinerary];
                                  newItinerary[i].spots = newItinerary[i].spots.filter((_, spotIdx) => spotIdx !== j);
                                  setCurrentTrip({ ...currentTrip, itinerary: newItinerary });
                                }}
                                className="p-2 bg-red-50 rounded-xl text-red-500 hover:bg-red-100 transition-colors"
                              >
                                <X size={16} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openDirections(spot);
                              }}
                              className="p-2 bg-slate-50 rounded-xl text-brand"
                            >
                              <Navigation size={18} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                      <button 
                        onClick={handleAddPlace}
                        className="w-full py-4 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold hover:bg-slate-50 transition-colors"
                      >
                        <Plus size={16} />
                        Add a place
                      </button>
                    </div>
                  </div>
                ))}
                
                <div className="pt-8 pb-4 flex justify-center">
                  <button 
                    onClick={onClose}
                    className="bg-white px-10 py-4 rounded-full shadow-xl border border-slate-100 font-bold text-slate-800 flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <div className="w-4 h-4 bg-black rounded-sm" />
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
            {activeTab === 'discover' && (
              <motion.div 
                key="discover"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-brand/5 rounded-3xl p-6 border border-brand/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center text-white">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">Discover {currentTrip.destination}</h3>
                      <p className="text-sm text-slate-500">AI-curated insights and recommendations</p>
                    </div>
                  </div>
                  
                  {isGettingDiscoverInfo ? (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="h-6 bg-slate-200 rounded-lg w-1/3 animate-pulse" />
                        <div className="h-4 bg-slate-100 rounded-lg w-full animate-pulse" />
                        <div className="h-4 bg-slate-100 rounded-lg w-5/6 animate-pulse" />
                        <div className="h-4 bg-slate-100 rounded-lg w-4/5 animate-pulse" />
                      </div>
                      <div className="space-y-3">
                        <div className="h-6 bg-slate-200 rounded-lg w-1/4 animate-pulse" />
                        <div className="h-4 bg-slate-100 rounded-lg w-full animate-pulse" />
                        <div className="h-4 bg-slate-100 rounded-lg w-11/12 animate-pulse" />
                      </div>
                      <div className="space-y-3">
                        <div className="h-6 bg-slate-200 rounded-lg w-1/3 animate-pulse" />
                        <div className="h-4 bg-slate-100 rounded-lg w-full animate-pulse" />
                        <div className="h-4 bg-slate-100 rounded-lg w-4/5 animate-pulse" />
                      </div>
                    </div>
                  ) : discoverInfo ? (
                    <div className="prose prose-sm max-w-none prose-headings:font-display prose-headings:font-bold prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-a:text-brand">
                      <ReactMarkdown>{discoverInfo}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      Could not load discover info.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Spot Detail Modal */}
      <AnimatePresence>
        {selectedSpot && (
          <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-6">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-lg bg-white rounded-t-[2.5rem] md:rounded-3xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="relative h-64">
                <img src={selectedSpot.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button 
                  onClick={() => setSelectedSpot(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-8">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-3xl font-display font-bold text-slate-900">{selectedSpot.name}</h2>
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-1">
                    <Star size={16} className="fill-amber-400 text-amber-400" />
                    <span className="font-bold text-slate-800">4.2</span>
                    <span className="text-slate-400 text-sm">(38,144)</span>
                  </div>
                  <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {selectedSpot.category}
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Fast AI Info Section */}
                  <section className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Music size={64} />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-brand rounded-full flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                      </div>
                      <h4 className="font-bold text-sm uppercase tracking-widest text-brand-light">Fast AI Insight</h4>
                    </div>
                    {isGettingFastInfo ? (
                      <div className="space-y-2">
                        <div className="h-4 bg-slate-800 rounded w-full animate-pulse" />
                        <div className="h-4 bg-slate-800 rounded w-5/6 animate-pulse" />
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed font-medium">
                        {fastInfo || "Analyzing this spot for you..."}
                      </p>
                    )}
                  </section>

                    {/* Saved Spot Details Section */}
                    {isGettingSavedSpotDetails ? (
                      <div className="space-y-8">
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse" />
                            <div className="h-6 bg-slate-200 rounded-lg w-1/3 animate-pulse" />
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
                            <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
                            <div className="h-4 bg-slate-100 rounded w-4/5 animate-pulse" />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="w-16 h-6 bg-slate-100 rounded-full animate-pulse" />
                            <div className="w-20 h-6 bg-slate-100 rounded-full animate-pulse" />
                            <div className="w-14 h-6 bg-slate-100 rounded-full animate-pulse" />
                          </div>
                        </section>
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse" />
                            <div className="h-6 bg-slate-200 rounded-lg w-1/2 animate-pulse" />
                          </div>
                          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                            <div className="space-y-2">
                              <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
                              <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
                            </div>
                          </div>
                        </section>
                      </div>
                    ) : savedSpotDetails ? (
                      <>
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white shadow-sm">
                              <Info size={16} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">About this place</h3>
                          </div>
                          <div className="prose prose-sm max-w-none prose-p:text-slate-600 prose-p:leading-relaxed mb-4">
                            <ReactMarkdown>{savedSpotDetails.shortDescription}</ReactMarkdown>
                          </div>
                          {savedSpotDetails.keywords && savedSpotDetails.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {savedSpotDetails.keywords.map((keyword, idx) => (
                                <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full border border-slate-200 shadow-sm">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </section>

                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-sm">
                              <Sparkles size={16} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">What's New & Hidden Gems</h3>
                          </div>
                          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100/50 shadow-sm">
                            <div className="prose prose-sm max-w-none prose-headings:text-amber-900 prose-headings:font-bold prose-headings:text-base prose-headings:mb-2 prose-p:text-amber-800/80 prose-p:leading-snug prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-li:text-amber-800/80 prose-strong:text-amber-900">
                              <ReactMarkdown>{savedSpotDetails.newThings}</ReactMarkdown>
                            </div>
                          </div>
                        </section>

                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-sm">
                              <Calendar size={16} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Upcoming Events</h3>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-2xl p-5 border border-purple-100/50 shadow-sm">
                            <div className="prose prose-sm max-w-none prose-headings:text-purple-900 prose-headings:font-bold prose-headings:text-base prose-headings:mb-2 prose-p:text-purple-800/80 prose-p:leading-snug prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-li:text-purple-800/80 prose-strong:text-purple-900">
                              <ReactMarkdown>{savedSpotDetails.upcomingEvents}</ReactMarkdown>
                            </div>
                          </div>
                        </section>
                      </>
                    ) : (
                      <section>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">About this place</h3>
                        <p className="text-slate-600 leading-relaxed">{spotDetails.description || selectedSpot.description}</p>
                      </section>
                    )}

                    {/* The Plan Section */}
                    <section className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-sm">
                          <MapPin size={16} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">The Plan</h3>
                      </div>
                      
                      {isGettingSpotPlan ? (
                        <div className="space-y-3">
                          <div className="h-3 bg-blue-100 rounded w-3/4 animate-pulse" />
                          <div className="h-3 bg-blue-100 rounded w-full animate-pulse" />
                          <div className="h-3 bg-blue-100 rounded w-5/6 animate-pulse" />
                        </div>
                      ) : spotPlan ? (
                        <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-headings:font-bold prose-headings:text-base prose-headings:mb-2 prose-p:text-slate-600 prose-p:leading-snug prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-li:text-slate-600">
                          <ReactMarkdown>{spotPlan}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Could not generate a plan for this spot.</p>
                      )}
                    </section>

                    {/* Nearby Places Section */}
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Nearby Places</h3>
                        {isGettingNearby && <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />}
                      </div>
                      <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-8 px-8">
                        {isGettingNearby ? (
                          [1, 2, 3].map(i => (
                            <div key={i} className="flex-shrink-0 w-48 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-pulse">
                              <div className="w-full h-24 bg-slate-200" />
                              <div className="p-3 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-3/4" />
                                <div className="h-3 bg-slate-100 rounded w-1/2" />
                                <div className="h-8 bg-slate-50 rounded-lg w-full mt-3" />
                              </div>
                            </div>
                          ))
                        ) : (
                          nearbySpots.map((spot) => (
                            <div 
                              key={spot.id}
                              className="flex-shrink-0 w-48 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                            >
                              <img src={spot.imageUrl} className="w-full h-24 object-cover" referrerPolicy="no-referrer" />
                              <div className="p-3">
                                <div className="font-bold text-sm text-slate-800 truncate">{spot.name}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">{spot.category}</div>
                                <button 
                                  onClick={() => handleAddNearbySpot(spot)}
                                  className="mt-3 w-full py-1.5 bg-slate-50 text-brand text-[10px] font-bold rounded-lg hover:bg-brand hover:text-white transition-colors flex items-center justify-center gap-1"
                                >
                                  <Plus size={10} />
                                  Add to Trip
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        {nearbySpots.length === 0 && !isGettingNearby && (
                          <div className="text-sm text-slate-400 italic py-4">Select a spot to see nearby places.</div>
                        )}
                      </div>
                    </section>

                    {/* Community Notes */}
                  <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={18} className="text-amber-600" />
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-widest">Community Notes</h4>
                    </div>
                    <ul className="space-y-3">
                      {(spotDetails.reviewSnippets || [
                        "Highly recommended by locals for authentic experience.",
                        "Best visited early in the morning to avoid crowds.",
                        "Don't forget to try their signature dish!"
                      ]).slice(0, 3).map((note, i) => (
                        <li key={i} className="text-sm text-amber-800 flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                          {note}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => showToast("Showing sources")} className="mt-4 text-xs font-bold text-amber-700 flex items-center gap-1">
                      Show sources
                      <ChevronLeft size={12} className="rotate-180" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-100">
                    {spotDetails.mapsUri && (
                      <a 
                        href={spotDetails.mapsUri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand">
                          <MapPin size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-800">Open in Google Maps</div>
                          <div className="text-xs text-slate-500 truncate">{spotDetails.mapsUri}</div>
                        </div>
                      </a>
                    )}

                    {spotDetails.website && (
                      <a 
                        href={spotDetails.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-500">
                          <Globe size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-800">Official Website</div>
                          <div className="text-xs text-slate-500 truncate">{spotDetails.website}</div>
                        </div>
                      </a>
                    )}

                    {spotDetails.phone && (
                      <a 
                        href={`tel:${spotDetails.phone}`}
                        className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-500">
                          <Phone size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-800">Call Business</div>
                          <div className="text-xs text-slate-500 truncate">{spotDetails.phone}</div>
                        </div>
                      </a>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                        <Clock size={20} />
                      </div>
                      <div className="text-sm text-slate-600">Open • Closes at 1 AM</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Prompt Modal */}
      <AnimatePresence>
        {promptModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="font-bold text-lg mb-4">{promptModal.title}</h3>
              <input
                type="text"
                autoFocus
                className="w-full bg-slate-100 border-none rounded-xl p-4 mb-4 focus:ring-2 focus:ring-brand outline-none"
                placeholder="Type here..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    promptModal.onSubmit(e.currentTarget.value);
                  }
                }}
                id="prompt-input"
              />
              <div className="flex gap-3">
                <button
                  onClick={promptModal.onCancel}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const input = document.getElementById('prompt-input') as HTMLInputElement;
                    promptModal.onSubmit(input?.value || '');
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-brand hover:bg-brand/90"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
