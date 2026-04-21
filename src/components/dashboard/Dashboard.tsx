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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isReelsOpen, setIsReelsOpen] = useState(false);
  const [editName, setEditName] = useState(user?.name || 'DURGA VENKATA PRASAD CHITIKINA');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{destination: string, dates: string, duration: number} | null>(null);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
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

  const handleSaveProfile = () => {
    if (!editName.trim()) {
      showToast("Name cannot be empty");
      return;
    }
    if (editName.length > 50) {
      showToast("Name is too long");
      return;
    }
    if (editBio.length > 200) {
      showToast("Bio is too long");
      return;
    }
    setUser({ ...user, name: editName, bio: editBio, avatar: user?.avatar || '' });
    setIsEditingProfile(false);
    showToast("Profile updated successfully");
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast("Signed out successfully");
    } catch (error) {
      console.error("Error signing out", error);
      showToast("Error signing out");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await deleteDoc(doc(db, 'users', user.uid));
        await deleteUser(user);
        showToast("Account deleted successfully");
        setShowDeleteAccountConfirm(false);
      }
    } catch (error: any) {
      console.error("Error deleting account", error);
      if (error.code === 'auth/user-token-expired') {
        showToast("For security, please sign out and sign back in before deleting your account.");
      } else {
        showToast("Error deleting account");
      }
      setShowDeleteAccountConfirm(false);
    }
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
      <div className="hidden md:flex flex-col w-64 bg-white border-r border-slate-100 h-full p-6 z-20">
        <h1 className="text-3xl font-display font-bold text-brand mb-12">Wayfinder Ai</h1>
        <div className="flex-1 space-y-4">
          <button onClick={() => setActiveTab('home')} className={cn("flex items-center gap-3 w-full p-3 rounded-xl transition-colors", activeTab === 'home' ? "bg-brand/10 text-brand font-bold" : "text-slate-500 hover:bg-slate-50 font-medium")}>
            <Compass size={24} />
            Explore
          </button>
          <button onClick={() => setActiveTab('saved')} className={cn("flex items-center gap-3 w-full p-3 rounded-xl transition-colors", activeTab === 'saved' ? "bg-brand/10 text-brand font-bold" : "text-slate-500 hover:bg-slate-50 font-medium")}>
            <Heart size={24} />
            Saved
          </button>
          <button onClick={() => setActiveTab('profile')} className={cn("flex items-center gap-3 w-full p-3 rounded-xl transition-colors", activeTab === 'profile' ? "bg-brand/10 text-brand font-bold" : "text-slate-500 hover:bg-slate-50 font-medium")}>
            <User size={24} />
            Profile
          </button>
        </div>
        <button onClick={onAddClick} className="w-full bg-brand text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-transform">
          <Plus size={20} />
          Plan Trip
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header (Mobile) */}
        <div className="md:hidden px-6 py-3 bg-white flex items-center justify-between z-10 h-[60px]">
          <h1 className="text-3xl font-display font-bold text-brand">Wayfinder Ai</h1>
          <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand font-bold border-2 border-white shadow-sm">
            {user?.name?.[0] || 'D'}
          </div>
        </div>

        {/* Header (Desktop) */}
        <div className="hidden md:flex px-8 pt-4 pb-4 items-center justify-end z-10">
          <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand font-bold border-2 border-white shadow-sm">
            {user?.name?.[0] || 'D'}
          </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto no-scrollbar px-6 md:px-8 pb-32 md:pb-8 relative"
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
              "w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-brand transition-transform",
              isRefreshing ? "animate-spin" : "rotate-0"
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
                className="max-w-6xl mx-auto"
              >
            {/* Search Bar */}
            <motion.section variants={itemVariants} className="mt-4 card p-6">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search size={20} />
                </div>
                <input
                  type="text"
                  placeholder="Where to next?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-button)] py-4 pl-12 pr-24 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-2 top-2 bottom-2 bg-brand text-white px-6 rounded-[var(--radius-button)] font-bold text-sm hover:bg-brand-dark transition-colors"
                >
                  Search
                </button>
              </div>
            </motion.section>

            {/* Chat with Wayfinder Ai */}
            <motion.section variants={itemVariants} className="mt-4">
              <button 
                onClick={() => setIsChatOpen(true)}
                className="w-full bg-slate-900 text-white p-6 rounded-3xl flex items-center justify-between shadow-xl shadow-slate-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Sparkles className="text-brand" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">Chat with Wayfinder Ai</div>
                    <div className="text-xs text-white/60">AI-powered travel advice</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-white/40" />
              </button>
            </motion.section>

            {/* Travel Guides */}
            <motion.section variants={itemVariants} className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">Top 10 Places in India</h2>
                <button onClick={() => setShowAllGuides(!showAllGuides)} className="text-brand text-sm font-semibold">
                  {showAllGuides ? "View less" : "View all"}
                </button>
              </div>
              <div className={cn("gap-4 pb-4", showAllGuides ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "flex overflow-x-auto custom-scrollbar -mx-6 px-6")}>
                {guides.map(guide => (
                  <motion.div 
                    key={guide.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      showToast(`Planning ${guide.title}`);
                      const durationMatch = guide.title.match(/(\d+)-Day/);
                      const duration = durationMatch ? parseInt(durationMatch[1]) : 3;
                      handlePlanTrip(guide.destination, undefined, duration);
                    }}
                    className={cn("relative rounded-2xl overflow-hidden shadow-md cursor-pointer", showAllGuides ? "w-full aspect-[3/4]" : "flex-shrink-0 w-40 h-56")}
                  >
                    <img 
                      src={guide.image} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(guide.title)}/400/400`; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end">
                      <div className="text-white font-bold text-sm leading-tight">{guide.title}</div>
                      <div className="text-white/70 text-[10px] mt-1">{guide.spots} Spots</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            {/* Nearby Places */}
            <motion.section variants={itemVariants} className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <motion.button 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleNearbyClick}
                  className="bg-gradient-to-r from-brand to-brand-dark text-white px-6 py-3 rounded-2xl shadow-lg font-bold flex items-center gap-2 transition-all"
                >
                  Nearby Places
                  {isLoadingNearby && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                </motion.button>
                {showNearby && nearbySpots.length > 0 && (
                  <button onClick={() => showToast("These are the places that are nearby to you.")} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                    <Info size={16} className="text-brand" />
                  </button>
                )}
              </div>
              {showNearby && (
                <div className="flex overflow-x-auto custom-scrollbar -mx-6 px-6 gap-4 pb-4">
                  {nearbySpots.map((spot, index) => (
                    <motion.div 
                      key={spot.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSavedSpotClick(spot)}
                      className="relative rounded-3xl overflow-hidden shadow-md group cursor-pointer flex-shrink-0 w-48 h-72"
                    >
                      <img 
                        src={spot.imageUrl} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(spot.name)}/400/400`; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
                        <div className="text-white font-bold text-sm line-clamp-2 leading-tight">{spot.name}</div>
                        <div className="text-white/70 text-[10px] mt-1">{spot.category}</div>
                      </div>
                    </motion.div>
                  ))}
                  {isLoadingNearby && nearbySpots.length === 0 && (
                    [1, 2, 3].map(i => (
                      <div key={i} className="flex-shrink-0 w-48 h-72 bg-slate-200 rounded-3xl overflow-hidden shadow-md animate-pulse">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.section>

              {/* My Trips */}
              <motion.section 
                variants={itemVariants}
                className="mt-8"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-800">My Trips</h2>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Filter by destination" value={tripFilter} onChange={(e) => setTripFilter(e.target.value)} className="border rounded-lg px-2 py-1 text-xs" />
                    <select value={tripSort} onChange={(e) => setTripSort(e.target.value as 'name' | 'date')} className="border rounded-lg px-2 py-1 text-xs">
                      <option value="date">Sort by Date</option>
                      <option value="name">Sort by Name</option>
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
                  <div className="flex flex-col gap-4">
                    {(showAllTrips ? filteredTrips : filteredTrips.slice(0, 3)).map(trip => (
                      <motion.div 
                        key={trip.id}
                        whileHover={{ scale: 1.01, backgroundColor: "#f8fafc" }}
                        whileTap={{ scale: 0.99 }}
                        className="bg-white p-4 rounded-[var(--radius-card)] flex items-center gap-4 cursor-pointer border border-slate-200 shadow-sm transition-all"
                        onClick={() => setCurrentTrip(trip)}
                      >
                        <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                          <img 
                            src={trip.spots?.[0]?.imageUrl || `https://loremflickr.com/600/400/${encodeURIComponent(trip.destination.split(' ').join(','))}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(trip.destination)}/600/400`; }}
                          />
                        </div>
                        
                        <div className="flex-1 flex items-center justify-between">
                          {editingTripId === trip.id ? (
                            <div className="flex flex-col gap-2 w-full">
                              <input type="text" value={editValues?.destination} onChange={(e) => setEditValues(prev => prev ? {...prev, destination: e.target.value} : null)} className="border rounded p-1 text-sm" />
                              <input type="text" value={editValues?.dates} onChange={(e) => setEditValues(prev => prev ? {...prev, dates: e.target.value} : null)} className="border rounded p-1 text-sm" />
                              <input type="number" value={editValues?.duration} onChange={(e) => setEditValues(prev => prev ? {...prev, duration: parseInt(e.target.value)} : null)} className="border rounded p-1 text-sm" />
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveEdit(trip)} className="bg-brand text-white px-2 py-1 rounded text-xs">Save</button>
                                <button onClick={handleCancelEdit} className="bg-slate-200 px-2 py-1 rounded text-xs">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col justify-center">
                                <div className="font-bold text-slate-900 text-sm leading-tight">{trip.duration}-Day {trip.destination}<br/>Trip</div>
                                <div className="text-xs text-slate-500 mt-0.5">{trip.spots.length} Spots</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handleEditTrip(trip); }} className="p-2 text-slate-400 hover:text-brand transition-colors"><Pencil size={18} /></button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExportTrip(trip);
                                  }}
                                  className="p-2 text-slate-400 hover:text-brand transition-colors"
                                >
                                  <Download size={18} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTripToDelete(trip.id);
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                                  <ChevronRight size={18} className="text-slate-400" />
                                </div>
                              </div>
                            </>
                          )}
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
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">Search History</h2>
              </div>
              {searchHistory.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((destination, index) => (
                    <motion.button 
                      key={index}
                      whileHover={{ scale: 1.02, boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePlanTrip(destination)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-full text-sm font-medium transition-colors"
                    >
                      {destination}
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-sm italic">No recent searches.</div>
              )}
            </motion.section>
            </motion.div>
          )}

          {activeTab === 'saved' && (
            <motion.div 
              key="saved"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="mt-8 md:mt-0 space-y-6 max-w-2xl mx-auto pb-24"
            >
              <div className="flex items-center gap-4 relative group">
                <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-sm flex-shrink-0">
                  {user?.name?.[0] || 'D'}
                </div>
                <div className="flex-1">
                  {isEditingProfile ? (
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-brand"
                        placeholder="Your Name"
                      />
                      <textarea 
                        value={editBio} 
                        onChange={(e) => setEditBio(e.target.value)} 
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                        placeholder="Add a short bio"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveProfile} className="bg-brand text-white px-4 py-1.5 rounded-lg text-xs font-bold">Save</button>
                        <button onClick={() => setIsEditingProfile(false)} className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-slate-800 uppercase leading-tight">
                          {user?.name || 'DURGA VENKATA PRASAD CHITIKINA'}
                        </h2>
                        {user?.bio ? (
                          <p className="text-sm text-slate-600 mt-1">{user.bio}</p>
                        ) : (
                          <button onClick={() => setIsEditingProfile(true)} className="text-xs text-slate-400 mt-1 hover:text-slate-600 transition-colors">
                            Add a short bio
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setEditName(user?.name || 'DURGA VENKATA PRASAD CHITIKINA');
                          setEditBio(user?.bio || '');
                          setIsEditingProfile(true);
                        }} 
                        className="text-xs font-bold text-brand hover:text-brand-dark transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 text-center shadow-sm">
                  <div className="text-2xl font-bold text-slate-800">{savedSpots.length}</div>
                  <div className="text-xs text-slate-500 mt-1">Saved</div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 text-center shadow-sm">
                  <div className="text-2xl font-bold text-slate-800">{trips.length}</div>
                  <div className="text-xs text-slate-500 mt-1">Trips</div>
                </div>
              </div>

              {/* Import History */}
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => setIsImportHistoryOpen(true)} className="w-full bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100">
                    <img src="https://loremflickr.com/100/100/history,travel" className="w-full h-full object-cover" alt="History" />
                  </div>
                  <span className="font-bold text-slate-700">Import History</span>
                </div>
                <ChevronRight size={20} className="text-slate-400" />
              </motion.button>
              
              <ImportHistoryModal isOpen={isImportHistoryOpen} onClose={() => setIsImportHistoryOpen(false)} />
            
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => window.location.href = 'mailto:support@wayfinder.ai'} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <Mail size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Email Us</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => showToast("Joining community")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <MessageCircle size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Join Community</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => showToast("Leaving a review")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <StarIcon size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Leave a Review</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => showToast("Sharing Wayfinder")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <Share size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Share Wayfinder</span>
                </motion.button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <button onClick={() => showToast("Preferences opened")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <Bookmark size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Preferences</span>
                </button>
                <button onClick={() => showToast("Viewing Privacy Policy")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <Shield size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Privacy Policy</span>
                </button>
                <button onClick={() => showToast("Viewing Terms of Use")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <FileIcon size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Terms of Use</span>
                </button>
                <button onClick={handleSignOut} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <LogOut size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Sign Out</span>
                </button>
                <button onClick={() => setShowDeleteAccountConfirm(true)} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-red-500">
                  <Trash2 size={20} />
                  <span className="font-medium">Delete Account</span>
                </button>
              </div>
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

        {/* Confirmation Modal */}
        <AnimatePresence>
          {showDeleteAccountConfirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full"
              >
                <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Account</h3>
                <p className="text-slate-600 mb-6">Are you sure you want to delete your account? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteAccountConfirm(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">Cancel</button>
                  <button onClick={handleDeleteAccount} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold">Delete</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
