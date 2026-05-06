import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { signOut, deleteUser } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useApp } from '../../store/AppContext';
import { useToast } from '../../store/ToastContext';
import { ReelsFeed } from '../ReelsFeed';
import { MapPin, Calendar, Plus, Compass, Heart, User, ChevronRight, Sparkles, X, Trash2, Mail, MessageCircle, Star as StarIcon, Share, Shield, FileText as FileIcon, LogOut, Instagram, Video, Info, Pencil, Bookmark, Download, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { geminiService } from '../../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Spot, Trip } from '../../services/geminiService';
import { ImportHistoryModal } from '../import/ImportHistoryModal';
import { ProfileView } from '../profile/ProfileView';

export const Dashboard = ({ onAddClick, onPlanTrip }: { onAddClick: () => void, onPlanTrip: (destination?: string, spots?: Spot[], duration?: number) => void }) => {
  const { trips, savedSpots, user, setCurrentTrip, deleteTrip, addTrip, addSearch, searchHistory } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('home');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isImportHistoryOpen, setIsImportHistoryOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedSavedSpot, setSelectedSavedSpot] = useState<Spot | null>(null);
  const [savedSpotDetails, setSavedSpotDetails] = useState<{ shortDescription: string, keywords: string[], newThings: string, upcomingEvents: string } | null>(null);
  const [isGettingSpotDetails, setIsGettingSpotDetails] = useState(false);
  const [isReelsOpen, setIsReelsOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{destination: string, dates: string, duration: number} | null>(null);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [showAllGuides, setShowAllGuides] = useState(false);
  const [showAllSocial, setShowAllSocial] = useState(false);
  const [selectedSpots, setSelectedSpots] = useState<Spot[]>([]);
  const [isPlanningFromSaved, setIsPlanningFromSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [tripFilter, setTripFilter] = useState('');
  const [tripSort, setTripSort] = useState<'name' | 'date'>('date');
  const [spotFilter, setSpotFilter] = useState('');
  const [spotSort, setSpotSort] = useState<'name' | 'category'>('name');
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [isDeleteAccountConfirmOpen, setIsDeleteAccountConfirmOpen] = useState(false);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    handlePlanTrip(searchQuery);
    setSearchQuery('');
  };

  // Filter and sort trips
  const filteredTrips = React.useMemo(() => trips
    .filter(trip => trip.destination.toLowerCase().includes(tripFilter.toLowerCase()))
    .sort((a, b) => {
      if (tripSort === 'name') return a.destination.localeCompare(b.destination);
      return (b.dates || '').localeCompare(a.dates || ''); // Simple date sort
    }), [trips, tripFilter, tripSort]);

  // Filter and sort savedSpots
  const filteredSpots = React.useMemo(() => savedSpots
    .filter(spot => spot.category.toLowerCase().includes(spotFilter.toLowerCase()))
    .sort((a, b) => {
      if (spotSort === 'name') return a.name.localeCompare(b.name);
      return a.category.localeCompare(b.category);
    }), [savedSpots, spotFilter, spotSort]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const startY = React.useRef(0);
  const { setUser, currentTrip } = useApp();
  
  const toggleSpotSelection = (spot: Spot) => {
    setSelectedSpots(prev => 
      prev.find(s => s.id === spot.id) 
        ? prev.filter(s => s.id !== spot.id)
        : [...prev, spot]
    );
  };

  const handlePlanTripFromSavedSpots = async () => {
    const spotsToPlan = selectedSpots.length > 0 ? selectedSpots : savedSpots;
    if (spotsToPlan.length === 0) return;
    setIsPlanningFromSaved(true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setIsPlanningFromSaved(false);
    handlePlanTrip(undefined, spotsToPlan);
    setSelectedSpots([]); // Clear selection after planning
  };
  
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current > 0) {
      const y = e.touches[0].clientY;
      const dy = y - startY.current;
      if (dy > 0 && scrollRef.current && scrollRef.current.scrollTop === 0) {
        setPullY(Math.min(dy * 0.5, 80));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullY > 50) {
      setIsRefreshing(true);
      
      // Simulate data refresh
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsRefreshing(false);
      showToast("Dashboard refreshed!");
    }
    setPullY(0);
    startY.current = 0;
  };

  const handleExportTrip = (trip: Trip) => {
    const content = `Trip to ${trip.destination}\nDuration: ${trip.duration} days\n\nSpots:\n${trip.spots.map((s: Spot) => `- ${s.name}: ${s.description}`).join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.destination}_itinerary.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Trip exported successfully");
  };

  const handlePlanTrip = (destination?: string, spots?: Spot[], duration?: number) => {
    if (destination) {
      addSearch(destination);
    }
    onPlanTrip(destination, spots, duration);
  };

  const handleEditTrip = (trip: Trip) => {
    setEditingTripId(trip.id);
    setEditValues({ destination: trip.destination, dates: trip.dates || '', duration: trip.duration });
  };

  const handleSaveEdit = (trip: Trip) => {
    if (!editValues) return;
    addTrip({ ...trip, ...editValues });
    setEditingTripId(null);
    setEditValues(null);
  };

  const handleCancelEdit = () => {
    setEditingTripId(null);
    setEditValues(null);
  };

  const handleChat = async () => {
    if (!chatQuery) return;
    setIsThinking(true);
    setChatResponse('');
    try {
      const response = await geminiService.complexTripAdvice(chatQuery, currentTrip);
      setChatResponse(response);
    } catch (e) {
      setChatResponse("Sorry, I encountered an error while thinking. Please try again.");
    } finally {
      setIsThinking(false);
    }
  };

  const handleSavedSpotClick = async (spot: Spot) => {
    setSelectedSavedSpot(spot);
    setSavedSpotDetails(null);
    setIsGettingSpotDetails(true);
    try {
      const details = await geminiService.getSpotDetails(spot.name, 'the destination'); // Need a destination
      setSavedSpotDetails({
        shortDescription: details.insights,
        keywords: [],
        newThings: details.openingHours,
        upcomingEvents: details.reviews.join(', ')
      });
    } catch (e) {
      showToast("Failed to load spot details.");
    } finally {
      setIsGettingSpotDetails(false);
    }
  };

  const handlePlanTripFromSpot = () => {
    if (selectedSavedSpot) {
      const dest = selectedSavedSpot.name;
      setSelectedSavedSpot(null);
      handlePlanTrip(dest);
      showToast(`Planning trip to ${dest}`);
    }
  };

  const guides = [
    { id: '1', title: '3-Day Taj Mahal & Agra', destination: 'Agra, India', spots: 8, image: 'https://loremflickr.com/600/400/Agra,India' },
    { id: '2', title: '4-Day Jaipur Royal Trip', destination: 'Jaipur, India', spots: 12, image: 'https://loremflickr.com/600/400/Jaipur,India' },
    { id: '3', title: '5-Day Goa Beaches', destination: 'Goa, India', spots: 15, image: 'https://loremflickr.com/600/400/Goa,India,beach' },
    { id: '4', title: '4-Day Kerala Backwaters', destination: 'Kerala, India', spots: 10, image: 'https://loremflickr.com/600/400/Kerala,India,backwaters' },
    { id: '5', title: '3-Day Varanasi Spiritual', destination: 'Varanasi, India', spots: 9, image: 'https://loremflickr.com/600/400/Varanasi,India' },
    { id: '6', title: '6-Day Ladakh Adventure', destination: 'Ladakh, India', spots: 14, image: 'https://loremflickr.com/600/400/Ladakh,India' },
    { id: '7', title: '3-Day Rishikesh Yoga', destination: 'Rishikesh, India', spots: 8, image: 'https://loremflickr.com/600/400/Rishikesh,India' },
    { id: '8', title: '2-Day Hampi Ruins', destination: 'Hampi, India', spots: 11, image: 'https://loremflickr.com/600/400/Hampi,India' },
    { id: '9', title: '4-Day Darjeeling Tea', destination: 'Darjeeling, India', spots: 10, image: 'https://loremflickr.com/600/400/Darjeeling,India' },
    { id: '10', title: '5-Day Andaman Islands', destination: 'Andaman Islands, India', spots: 12, image: 'https://loremflickr.com/600/400/Andaman,Islands,India' },
  ];

  const [nearbySpots, setNearbySpots] = useState<Spot[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showNearby, setShowNearby] = useState(false);

  useEffect(() => {
    if (navigator.geolocation && user) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (error) => {
          console.error("Geolocation error, using fallback location", error);
          setUserLocation({ lat: 40.7128, lng: -74.0060 });
        }
      );
    } else if (user) {
      setUserLocation({ lat: 40.7128, lng: -74.0060 });
    }
  }, [user]);

  const fetchNearby = async (lat: number, lng: number) => {
    try {
      setIsLoadingNearby(true);
      const nearby = await geminiService.getNearbySpots(lat, lng);
      setNearbySpots(nearby);
      setShowNearby(true);
    } catch (e) {
      console.error("Failed to load nearby spots", e);
    } finally {
      setIsLoadingNearby(false);
    }
  };

  const handleNearbyClick = async () => {
    if (navigator.geolocation) {
      showToast("Updating nearby places...");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          await fetchNearby(lat, lng);
          setShowNearby(true);
        },
        (error) => {
          console.error("Error getting location", error);
          showToast("Could not get your location. Please enable location services.");
        }
      );
    } else {
      showToast("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col w-72 bg-white border-r border-stone-100 h-full p-8 z-20">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
            <Compass size={24} />
          </div>
          <h1 className="text-2xl font-display font-bold text-brand tracking-tighter">Wayfinder</h1>
        </div>
        
        <div className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('home')} 
            className={cn(
              "flex items-center gap-3 w-full p-4 rounded-2xl transition-all duration-200 group", 
              activeTab === 'home' 
                ? "bg-slate-50 text-brand font-bold" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium"
            )}
          >
            <Compass size={20} className={cn("transition-colors", activeTab === 'home' ? "text-brand" : "text-slate-400 group-hover:text-slate-600")} />
            Explore
          </button>
          <button 
            onClick={() => setActiveTab('saved')} 
            className={cn(
              "flex items-center gap-3 w-full p-4 rounded-2xl transition-all duration-200 group", 
              activeTab === 'saved' 
                ? "bg-slate-50 text-brand font-bold" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium"
            )}
          >
            <Heart size={20} className={cn("transition-colors", activeTab === 'saved' ? "text-brand" : "text-slate-400 group-hover:text-slate-600")} />
            Saved
          </button>
          <button 
            onClick={() => setActiveTab('profile')} 
            className={cn(
              "flex items-center gap-3 w-full p-4 rounded-2xl transition-all duration-200 group", 
              activeTab === 'profile' 
                ? "bg-slate-50 text-brand font-bold" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium"
            )}
          >
            <User size={20} className={cn("transition-colors", activeTab === 'profile' ? "text-brand" : "text-slate-400 group-hover:text-slate-600")} />
            Profile
          </button>
        </div>

        <button 
          onClick={onAddClick} 
          className="w-full bg-brand text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[var(--shadow-brand)] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          <Plus size={20} />
          Create Trip
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header (Mobile) */}
        <div className="md:hidden px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white">
              <Compass size={18} />
            </div>
            <h1 className="text-xl font-display font-bold text-brand tracking-tight">Wayfinder</h1>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-brand font-bold border border-slate-200">
            {user?.name?.[0] || 'D'}
          </div>
        </div>

        {/* Top Header (Desktop) */}
        <div className="hidden md:flex px-8 py-6 items-center justify-between z-10 sticky top-0 bg-[#FAFBFC]/80 backdrop-blur-md">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-4 py-1.5 bg-slate-100 rounded-full">
            Journey Planner
          </h2>
          <div className="flex items-center gap-4">
            <button className="p-2.5 text-slate-400 hover:text-brand hover:bg-white hover:shadow-sm rounded-xl transition-all">
              <Bookmark size={20} />
            </button>
            <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold shadow-lg shadow-brand/10 border-2 border-white">
              {user?.name?.[0] || 'D'}
            </div>
          </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto no-scrollbar px-6 md:px-12 pb-32 md:pb-12 relative"
          ref={scrollRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Pull to refresh indicator */}
          <div 
            className="absolute left-0 right-0 flex justify-center items-center overflow-hidden transition-all duration-200"
            style={{ height: `${pullY}px`, opacity: pullY / 80 }}
          >
            <div className={cn(
              "w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-brand transition-transform",
              isRefreshing ? "animate-spin" : "rotate-0 shadow-brand/10"
            )}>
              <Sparkles size={16} />
            </div>
          </div>
          
          <div style={{ transform: `translateY(${isRefreshing ? 60 : pullY}px)`, transition: isRefreshing ? 'transform 0.3s ease' : 'none' }}>
            <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="max-w-5xl mx-auto"
              >
            {/* Hero Section */}
            <motion.section variants={itemVariants} className="mt-4 mb-12">
              <h3 className="text-4xl md:text-5xl font-display font-bold text-slate-900 mb-4 leading-[1.1]">
                Where will your <br/> next story <span className="text-brand">unfold?</span>
              </h3>
              <p className="text-slate-500 text-lg max-w-md leading-relaxed">
                Plan unique itineraries and discover hidden gems powered by the world's most advanced travel AI.
              </p>
            </motion.section>

            {/* Search Bar */}
            <motion.section variants={itemVariants} className="mt-8">
              <div className="relative group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors">
                  <Search size={22} />
                </div>
                <input
                  type="text"
                  placeholder="Try '7 days in Bali' or 'Weekend in Kyoto'..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-white border border-slate-100 shadow-[var(--shadow-lg)] rounded-3xl py-6 pl-16 pr-32 text-lg font-medium focus:outline-none focus:ring-4 focus:ring-brand/5 transition-all outline-none placeholder:text-slate-300"
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-3 top-3 bottom-3 bg-brand text-white px-8 rounded-2xl font-bold text-base hover:bg-brand-dark transition-all shadow-lg shadow-brand/20 active:scale-95"
                >
                  Explore
                </button>
              </div>
            </motion.section>

            {/* AI Travel Concierge */}
            <motion.section variants={itemVariants} className="mb-12 mt-4">
              <button 
                onClick={() => setIsChatOpen(true)}
                className="w-full bg-slate-900 text-white p-6 rounded-[var(--radius-card)] flex items-center justify-between shadow-xl shadow-slate-200 group overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand/20 blur-3xl -mr-16 -mt-16 group-hover:bg-brand/30 transition-colors" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                    <Sparkles className="text-brand" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg">AI Travel Concierge</div>
                    <div className="text-xs text-white/50">Ask anything about your destination</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-white/40 group-hover:text-white transition-colors" />
              </button>
            </motion.section>

            {/* Travel Guides */}
            <motion.section variants={itemVariants} className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-slate-900">Featured Collections</h2>
                <button onClick={() => setShowAllGuides(!showAllGuides)} className="text-brand text-sm font-bold hover:underline">
                  {showAllGuides ? "Show less" : "View all"}
                </button>
              </div>
              <div className={cn("gap-6 pb-6", showAllGuides ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "flex overflow-x-auto no-scrollbar -mx-6 px-6")}>
                {guides.map(guide => (
                  <motion.div 
                    key={guide.id}
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const durationMatch = guide.title.match(/(\d+)-Day/);
                      const duration = durationMatch ? parseInt(durationMatch[1]) : 3;
                      handlePlanTrip(guide.destination, undefined, duration);
                    }}
                    className={cn("group relative bg-white rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-md)] transition-all cursor-pointer border border-slate-100", showAllGuides ? "w-full" : "flex-shrink-0 w-64")}
                  >
                    <div className="aspect-[4/5] overflow-hidden relative">
                      <img 
                        src={guide.image} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(guide.title)}/600/800`; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
                        <h4 className="text-lg font-display font-bold text-white mb-1 group-hover:text-brand transition-colors">{guide.title}</h4>
                        <div className="flex items-center gap-2 text-white/70 text-xs font-medium">
                          <MapPin size={12} /> {guide.destination}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            {/* Explore Nearby */}
            <motion.section variants={itemVariants} className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-slate-900">Explore Nearby</h2>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNearbyClick}
                  className="bg-brand text-white px-5 py-2.5 rounded-full shadow-lg shadow-brand/10 font-bold text-sm flex items-center gap-2 transition-all"
                >
                  <MapPin size={16} /> 
                  Places Near Me
                  {isLoadingNearby && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                </motion.button>
              </div>
              
              <AnimatePresence>
                {showNearby && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex overflow-x-auto no-scrollbar -mx-6 px-6 gap-6 pb-6 pt-2"
                  >
                    {nearbySpots.map((spot, index) => (
                      <motion.div 
                        key={spot.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => handleSavedSpotClick(spot)}
                        className="flex-shrink-0 w-48 bg-white rounded-3xl overflow-hidden shadow-[var(--shadow-md)] border border-slate-50 cursor-pointer group"
                      >
                        <div className="h-32 overflow-hidden relative">
                          <img 
                            src={spot.imageUrl} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                        <div className="p-4">
                          <h5 className="font-bold text-slate-800 text-sm line-clamp-1 mb-1">{spot.name}</h5>
                          <span className="text-[10px] font-bold text-brand uppercase tracking-wider">{spot.category}</span>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

              {/* My Collections */}
              <motion.section variants={itemVariants} className="mb-24">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-display font-bold text-slate-900">Your Journeys</h2>
                  <div className="flex items-center gap-3">
                    <select value={tripSort} onChange={(e) => setTripSort(e.target.value as 'name' | 'date')} className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 outline-none hover:bg-slate-50 transition-colors shadow-sm">
                      <option value="date">Latest First</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </div>
                  {trips.length > 3 && (
                    <button 
                      onClick={() => setShowAllTrips(!showAllTrips)} 
                      className="text-brand text-sm font-semibold"
                    >
                      {showAllTrips ? "Show less" : "See all"}
                    </button>
                  )}
                </div>
                
                {filteredTrips.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(showAllTrips ? filteredTrips : filteredTrips.slice(0, 4)).map(trip => (
                      <motion.div 
                        key={trip.id}
                        whileHover={{ y: -4 }}
                        className="bg-white p-5 rounded-[var(--radius-card)] border border-slate-100 shadow-[var(--shadow-md)] transition-all cursor-pointer group"
                        onClick={() => setCurrentTrip(trip)}
                      >
                        <div className="flex gap-5">
                          <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 relative">
                            <img 
                              src={trip.spots?.[0]?.imageUrl || `https://loremflickr.com/400/400/${encodeURIComponent(trip.destination)}`} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              referrerPolicy="no-referrer" 
                            />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                          </div>
                        
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h4 className="font-display font-bold text-slate-900 text-lg group-hover:text-brand transition-colors truncate">
                                  {trip.destination}
                                </h4>
                                <span className="flex-shrink-0 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full uppercase tracking-tighter">
                                  {trip.duration}d
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic">
                                Features {trip.spots.length} unique spots in {trip.destination}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-end gap-1 mt-4">
                              <button onClick={(e) => { e.stopPropagation(); handleEditTrip(trip); }} className="p-2 text-slate-400 hover:text-brand transition-colors"><Pencil size={16} /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleExportTrip(trip); }} className="p-2 text-slate-400 hover:text-brand transition-colors"><Download size={16} /></button>
                              <button onClick={(e) => { e.stopPropagation(); setTripToDelete(trip.id); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Plus className="text-slate-300" size={32} />
                  </div>
                  <div className="font-bold text-slate-800">No trips planned yet. Ready?</div>
                  <button onClick={onAddClick} className="mt-4 bg-brand text-white px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2">
                    <Plus size={16} />
                    Plan Trip
                  </button>
                </div>
              )}
            </motion.section>

            {/* Search History */}
            <motion.section 
              className="mt-8 mb-24"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-display font-bold text-slate-900">Recent Explorations</h2>
              </div>
              {searchHistory.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {searchHistory.map((destination, index) => (
                    <motion.button 
                      key={index}
                      whileHover={{ y: -2, backgroundColor: "var(--brand-light)", color: "var(--brand)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePlanTrip(destination)}
                      className="bg-white border border-slate-100 text-slate-600 px-5 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm"
                    >
                      {destination}
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-xs font-medium italic">No recent searches.</div>
              )}
            </motion.section>
            </motion.div>
          )}

          {activeTab === 'saved' && (
            <motion.div 
              key="saved"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="mt-8 md:mt-0 max-w-6xl mx-auto pb-24"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Saved Spots</h2>
                <div className="flex gap-2">
                  <input type="text" placeholder="Filter by category" value={spotFilter} onChange={(e) => setSpotFilter(e.target.value)} className="border rounded-lg px-2 py-1 text-xs" />
                  <select value={spotSort} onChange={(e) => setSpotSort(e.target.value as 'name' | 'category')} className="border rounded-lg px-2 py-1 text-xs">
                    <option value="name">Sort by Name</option>
                    <option value="category">Sort by Category</option>
                  </select>
                </div>
                {savedSpots.length > 0 && (
                  <button 
                    onClick={handlePlanTripFromSavedSpots}
                    disabled={isPlanningFromSaved}
                    className="bg-brand text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all disabled:opacity-70"
                  >
                    {isPlanningFromSaved ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Plan Trip {selectedSpots.length > 0 ? `(${selectedSpots.length})` : 'from Saved'}
                      </>
                    )}
                  </button>
                )}
              </div>
              {filteredSpots.length > 0 ? (
                <motion.div 
                  className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.1 } }
                  }}
                >
                  {filteredSpots.map(spot => {
                    const isSelected = selectedSpots.some(s => s.id === spot.id);
                    return (
                      <motion.div 
                        key={spot.id} 
                        variants={{
                          hidden: { opacity: 0, y: 20 },
                          visible: { opacity: 1, y: 0 }
                        }}
                        onClick={() => toggleSpotSelection(spot)}
                        className={cn(
                          "bg-white p-3 rounded-2xl shadow-sm border transition-all cursor-pointer relative",
                          isSelected ? "border-brand ring-2 ring-brand/20" : "border-slate-100 hover:shadow-md"
                        )}
                      >
                        <div className="aspect-square rounded-xl overflow-hidden mb-2 relative">
                          <img 
                            src={spot.imageUrl} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(spot.name)}/400/400`;
                            }}
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-brand/30 flex items-center justify-center backdrop-blur-[2px]">
                              <div className="bg-white text-brand rounded-full p-1.5 shadow-lg">
                                <Sparkles size={18} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-sm truncate">{spot.name}</div>
                        <div className="text-[10px] text-slate-500">{spot.category}</div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
              <div className="text-center py-20 text-slate-400">
                <Heart size={48} className="mx-auto mb-4 opacity-20" />
                <p>No saved spots yet</p>
              </div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ProfileView />
            </motion.div>
          )}
          </AnimatePresence>
          </div>
        </div>

        {/* Floating Action Button (Mobile) */}
        <div className="md:hidden fixed bottom-24 right-6 z-30">
          <button 
            onClick={onAddClick}
            className="w-14 h-14 bg-brand rounded-full shadow-lg shadow-brand/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        </div>

        {/* Bottom Nav (Mobile) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex items-center justify-around z-20 pb-safe">
          <button onClick={() => setActiveTab('home')} className={cn("flex flex-col items-center gap-1", activeTab === 'home' ? "text-brand" : "text-slate-400")}>
            <Compass size={24} />
            <span className="text-[10px] font-medium">Explore</span>
          </button>
          <button onClick={() => setActiveTab('saved')} className={cn("flex flex-col items-center gap-1", activeTab === 'saved' ? "text-brand" : "text-slate-400")}>
            <Heart size={24} />
            <span className="text-[10px] font-medium">Saved</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={cn("flex flex-col items-center gap-1", activeTab === 'profile' ? "text-brand" : "text-slate-400")}>
            <User size={24} />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </div>

      {/* Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-100"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Chat with Wayfinder Ai</h2>
              <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatQuery && (
                <div className="flex justify-end">
                  <div className="bg-brand text-white p-4 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">
                    {chatQuery}
                  </div>
                </div>
              )}
              {chatResponse ? (
                <div className="flex justify-start">
                  <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none text-slate-800 leading-relaxed max-w-[85%] shadow-sm">
                    <ReactMarkdown>{chatResponse}</ReactMarkdown>
                  </div>
                </div>
              ) : isThinking ? (
                <div className="flex justify-start">
                  <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none text-slate-500 font-medium italic">
                    Wayfinder is thinking...
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  Ask me anything about your travels!
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100">
              <div className="flex gap-2">
                <input 
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder="Ask for advice..."
                  className="flex-1 bg-slate-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-brand/20"
                />
                <button 
                  onClick={handleChat}
                  disabled={isThinking || !chatQuery}
                  className="w-14 h-14 bg-brand text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20 disabled:opacity-50"
                >
                  <Sparkles size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Spot Detail Modal */}
      <AnimatePresence>
        {selectedSavedSpot && (
          <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-6">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-2xl bg-white rounded-t-[2.5rem] md:rounded-3xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="relative h-64 md:h-80">
                <img src={selectedSavedSpot.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button 
                  onClick={() => setSelectedSavedSpot(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40 transition-colors"
                >
                  <X size={24} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-brand/90 text-white rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                      {selectedSavedSpot.category}
                    </span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">{selectedSavedSpot.name}</h2>
                </div>
              </div>
              
              <div className="p-8 space-y-8">
                {isGettingSpotDetails ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500 font-medium animate-pulse">Gathering the latest insights...</p>
                  </div>
                ) : savedSpotDetails ? (
                  <>
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center text-brand">
                          <Info size={16} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">About this place</h3>
                      </div>
                      <div className="prose prose-sm max-w-none prose-p:text-slate-600 prose-p:leading-relaxed mb-4">
                        <ReactMarkdown>{savedSpotDetails.shortDescription}</ReactMarkdown>
                      </div>
                      {savedSpotDetails.keywords && savedSpotDetails.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {savedSpotDetails.keywords.map((keyword, idx) => (
                            <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={handlePlanTripFromSpot}
                        className="w-full mt-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
                      >
                        <Plus size={18} />
                        Add to Trip
                      </button>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                          <Sparkles size={16} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">What's New & Hidden Gems</h3>
                      </div>
                      <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-100/50">
                        <div className="prose prose-sm max-w-none prose-p:text-slate-700 prose-p:leading-relaxed">
                          <ReactMarkdown>{savedSpotDetails.newThings}</ReactMarkdown>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                          <Calendar size={16} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Upcoming Events</h3>
                      </div>
                      <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-100/50">
                        <div className="prose prose-sm max-w-none prose-p:text-slate-700 prose-p:leading-relaxed">
                          <ReactMarkdown>{savedSpotDetails.upcomingEvents}</ReactMarkdown>
                        </div>
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    Could not load details.
                  </div>
                )}

                <div className="pt-6 border-t border-slate-100">
                  <button 
                    onClick={handlePlanTripFromSpot}
                    className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <MapPin size={20} />
                    Plan a trip here
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {tripToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTripToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-4 mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Delete Trip?</h3>
              <p className="text-slate-500 text-center mb-6">
                Are you sure you want to delete this trip? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTripToDelete(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    deleteTrip(tripToDelete);
                    setTripToDelete(null);
                    showToast("Trip deleted successfully");
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {isReelsOpen && (
        <ReelsFeed 
          posts={[
            {
              id: '1',
              platform: 'instagram',
              author: 'travel_guru',
              image: 'https://picsum.photos/seed/travel1/600/800',
              caption: 'Exploring the hidden gems of Bali! 🌴✨',
              likes: '12.4K',
              location: 'Bali, Indonesia',
              comments: '342',
              isLiked: false
            },
            {
              id: '2',
              platform: 'instagram',
              author: 'wanderlust_life',
              image: 'https://picsum.photos/seed/travel2/600/800',
              caption: 'Sunset views in Santorini are unmatched. 🌅',
              likes: '45.1K',
              location: 'Santorini, Greece',
              comments: '1.2K',
              isLiked: true
            }
          ]}
          onClose={() => setIsReelsOpen(false)}
        />
      )}
    </div>
  );
};
