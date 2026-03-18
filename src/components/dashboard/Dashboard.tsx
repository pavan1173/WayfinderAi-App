import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../store/AppContext';
import { useToast } from '../../store/ToastContext';
import { MapPin, Calendar, Plus, Compass, Heart, User, ChevronRight, Sparkles, X, Trash2, Mail, MessageCircle, Star as StarIcon, Share, Shield, FileText as FileIcon, LogOut, Instagram, Video, Info, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';
import { geminiService } from '../../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Spot } from '../../services/geminiService';

export const Dashboard = ({ onAddClick, onPlanTrip }: { onAddClick: () => void, onPlanTrip: (destination?: string, spots?: Spot[], duration?: number) => void }) => {
  const { trips, savedSpots, user, setCurrentTrip, deleteTrip } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('home');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedSavedSpot, setSelectedSavedSpot] = useState<Spot | null>(null);
  const [savedSpotDetails, setSavedSpotDetails] = useState<{ shortDescription: string, keywords: string[], newThings: string, upcomingEvents: string } | null>(null);
  const [isGettingSpotDetails, setIsGettingSpotDetails] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || 'DURGA VENKATA PRASAD CHITIKINA');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [isPlanningFromSaved, setIsPlanningFromSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const startY = React.useRef(0);
  const { setUser } = useApp();

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
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsRefreshing(false);
    }
    setPullY(0);
    startY.current = 0;
  };

  const handleSaveProfile = () => {
    setUser({ ...user, name: editName, bio: editBio, avatar: user?.avatar || '' });
    setIsEditingProfile(false);
    showToast("Profile updated successfully");
  };

  const handleChat = async () => {
    if (!chatQuery) return;
    setIsThinking(true);
    setChatResponse('');
    try {
      const response = await geminiService.complexTripAdvice(chatQuery);
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
      const details = await geminiService.getSavedSpotDetails(spot.name);
      setSavedSpotDetails(details);
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
      onPlanTrip(dest);
      showToast(`Planning trip to ${dest}`);
    }
  };

  const handlePlanTripFromSavedSpots = async () => {
    if (savedSpots.length === 0) return;
    setIsPlanningFromSaved(true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setIsPlanningFromSaved(false);
    onPlanTrip(undefined, savedSpots);
  };

  const guides = [
    { id: '1', title: '3-Day Taj Mahal & Agra', destination: 'Agra, India', spots: 8, image: 'https://picsum.photos/seed/agra/400/600' },
    { id: '2', title: '4-Day Jaipur Royal Trip', destination: 'Jaipur, India', spots: 12, image: 'https://picsum.photos/seed/jaipur/400/600' },
    { id: '3', title: '5-Day Goa Beaches', destination: 'Goa, India', spots: 15, image: 'https://picsum.photos/seed/goa/400/600' },
    { id: '4', title: '4-Day Kerala Backwaters', destination: 'Kerala, India', spots: 10, image: 'https://picsum.photos/seed/kerala/400/600' },
    { id: '5', title: '3-Day Varanasi Spiritual', destination: 'Varanasi, India', spots: 9, image: 'https://picsum.photos/seed/varanasi/400/600' },
    { id: '6', title: '6-Day Ladakh Adventure', destination: 'Ladakh, India', spots: 14, image: 'https://picsum.photos/seed/ladakh/400/600' },
    { id: '7', title: '3-Day Rishikesh Yoga', destination: 'Rishikesh, India', spots: 8, image: 'https://picsum.photos/seed/rishikesh/400/600' },
    { id: '8', title: '2-Day Hampi Ruins', destination: 'Hampi, India', spots: 11, image: 'https://picsum.photos/seed/hampi/400/600' },
    { id: '9', title: '4-Day Darjeeling Tea', destination: 'Darjeeling, India', spots: 10, image: 'https://picsum.photos/seed/darjeeling/400/600' },
    { id: '10', title: '5-Day Andaman Islands', destination: 'Andaman Islands, India', spots: 12, image: 'https://picsum.photos/seed/andaman/400/600' },
  ];

  const [socialFeed, setSocialFeed] = useState([
    { id: 's1', platform: 'Instagram', author: '@wanderlust_daily', image: 'https://picsum.photos/seed/kyoto/400/600', caption: 'Hidden temples in Kyoto 🌸 #japan #travel', likes: '12.4k', location: 'Kyoto' },
    { id: 's2', platform: 'TikTok', author: '@travelhacks', image: 'https://picsum.photos/seed/amalfi/400/600', caption: 'How to do Amalfi Coast on a budget 🍋 #italy', likes: '89k', location: 'Amalfi Coast' },
    { id: 's3', platform: 'Instagram', author: '@foodie_explorer', image: 'https://picsum.photos/seed/bangkok/400/600', caption: 'Best street food in Bangkok 🍜 You must try this!', likes: '5.2k', location: 'Bangkok' },
    { id: 's4', platform: 'TikTok', author: '@scenic_routes', image: 'https://picsum.photos/seed/swiss/400/600', caption: 'Taking the Glacier Express through Switzerland 🏔️', likes: '210k', location: 'Switzerland' },
  ]);
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      setIsLoadingSocial(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const posts = await geminiService.getLocalSocialInspiration(position.coords.latitude, position.coords.longitude);
            if (posts && posts.length > 0) {
              setSocialFeed(posts.map((p, i) => ({
                id: `local-${i}`,
                platform: i % 2 === 0 ? 'Instagram' : 'TikTok',
                author: p.author,
                image: p.image,
                caption: p.caption,
                likes: p.likes,
                location: p.location
              })));
            }
          } catch (e) {
            console.error("Failed to load local social inspiration", e);
          } finally {
            setIsLoadingSocial(false);
          }
        },
        (error) => {
          console.error("Geolocation error", error);
          setIsLoadingSocial(false);
        }
      );
    }
  }, []);

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
        <div className="md:hidden px-6 pt-14 pb-4 bg-white flex items-center justify-between z-10">
          <h1 className="text-3xl font-display font-bold text-brand">Wayfinder Ai</h1>
          <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand font-bold border-2 border-white shadow-sm">
            {user?.name?.[0] || 'D'}
          </div>
        </div>

        {/* Header (Desktop) */}
        <div className="hidden md:flex px-8 pt-8 pb-4 items-center justify-end z-10">
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto"
            >
            {/* Chat with Wayfinder Ai */}
            <section className="mt-8">
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
            </section>

            {/* Travel Guides */}
            <section className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">Top 10 Places in India</h2>
                <button onClick={() => showToast("Viewing all travel guides")} className="text-brand text-sm font-semibold">View all</button>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
                {guides.map(guide => (
                  <motion.div 
                    key={guide.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      showToast(`Planning ${guide.title}`);
                      const durationMatch = guide.title.match(/(\d+)-Day/);
                      const duration = durationMatch ? parseInt(durationMatch[1]) : 3;
                      onPlanTrip(guide.destination, undefined, duration);
                    }}
                    className="flex-shrink-0 w-40 h-56 relative rounded-2xl overflow-hidden shadow-md cursor-pointer"
                  >
                    <img src={guide.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end">
                      <div className="text-white font-bold text-sm leading-tight">{guide.title}</div>
                      <div className="text-white/70 text-[10px] mt-1">{guide.spots} Spots</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Social Inspiration Feed */}
            <section className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  Social Inspiration
                  {isLoadingSocial && <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />}
                </h2>
                <button onClick={() => showToast("Viewing all social inspiration")} className="text-brand text-sm font-semibold">View all</button>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
                {socialFeed.map(post => (
                  <motion.div 
                    key={post.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      showToast(`Planning trip inspired by ${post.author}`);
                      onPlanTrip(post.location);
                    }}
                    className="flex-shrink-0 w-48 h-72 relative rounded-3xl overflow-hidden shadow-md group cursor-pointer"
                  >
                    <img src={post.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                      <div className="flex justify-end">
                        <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                          {post.platform === 'Instagram' ? <Instagram size={16} /> : <Video size={16} />}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author}`} alt="avatar" />
                          </div>
                          <div className="text-white text-[10px] font-bold">{post.author}</div>
                        </div>
                        <div className="text-white/90 text-xs line-clamp-2 leading-tight mb-2">{post.caption}</div>
                        <div className="text-white/60 text-[10px] font-medium flex items-center gap-1">
                          <Heart size={10} className="fill-white/60" /> {post.likes}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

              {/* My Trips */}
              <section className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-800">My Trips</h2>
                  {trips.length > 3 && (
                    <button 
                      onClick={() => setShowAllTrips(!showAllTrips)} 
                      className="text-brand text-sm font-semibold"
                    >
                      {showAllTrips ? "Show less" : "See all"}
                    </button>
                  )}
                </div>
                
                {trips.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {(showAllTrips ? trips : trips.slice(0, 3)).map(trip => (
                      <motion.div 
                        key={trip.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCurrentTrip(trip)}
                        className="bg-slate-200 p-2 rounded-3xl flex items-center gap-3 cursor-pointer hover:bg-slate-300 transition-colors"
                      >
                      <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                        <img src={`https://picsum.photos/seed/${trip.destination}/200/200`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 bg-white rounded-2xl p-3 flex items-center justify-between">
                        <div className="flex flex-col justify-center">
                          <div className="font-bold text-slate-800 text-sm leading-tight">{trip.duration}-Day {trip.destination}<br/>Trip</div>
                          <div className="text-xs text-slate-500 mt-0.5">{trip.spots.length} Spots</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTripToDelete(trip.id);
                            }}
                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center">
                            <ChevronRight size={14} className="text-slate-400" />
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
            </section>
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
                        Plan Trip from Saved
                      </>
                    )}
                  </button>
                )}
              </div>
              {savedSpots.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {savedSpots.map(spot => (
                    <div key={spot.id} onClick={() => handleSavedSpotClick(spot)} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="aspect-square rounded-xl overflow-hidden mb-2">
                        <img src={spot.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="font-bold text-sm truncate">{spot.name}</div>
                      <div className="text-[10px] text-slate-500">{spot.category}</div>
                    </div>
                  ))}
                </div>
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
                        className="text-slate-400 hover:text-brand transition-colors p-2 opacity-0 group-hover:opacity-100"
                      >
                        <Pencil size={16} />
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
              <button onClick={() => showToast("Viewing import history")} className="w-full bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100">
                    <img src="https://picsum.photos/seed/history/100/100" className="w-full h-full object-cover" alt="History" />
                  </div>
                  <span className="font-bold text-slate-700">Import History</span>
                </div>
                <ChevronRight size={20} className="text-slate-400" />
              </button>
            
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <button onClick={() => window.location.href = 'mailto:support@wayfinder.ai'} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <Mail size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Email Us</span>
                </button>
                <button onClick={() => showToast("Joining community")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <MessageCircle size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Join Community</span>
                </button>
                <button onClick={() => showToast("Leaving a review")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <StarIcon size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Leave a Review</span>
                </button>
                <button onClick={() => showToast("Sharing Wayfinder")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <Share size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Share Wayfinder</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <button onClick={() => showToast("Viewing Privacy Policy")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <Shield size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Privacy Policy</span>
                </button>
                <button onClick={() => showToast("Viewing Terms of Use")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <FileIcon size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Terms of Use</span>
                </button>
                <button onClick={() => showToast("Signing out")} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <LogOut size={20} className="text-slate-400" />
                  <span className="font-medium text-slate-700">Sign Out</span>
                </button>
                <button onClick={() => { showToast('Account deletion requested'); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-red-500">
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
          <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-6">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-lg bg-white rounded-t-[2.5rem] md:rounded-3xl p-6 pb-12 md:pb-6 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Chat with Wayfinder Ai</h2>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-6">
                {chatResponse ? (
                  <div className="bg-slate-50 p-4 rounded-2xl text-slate-700 leading-relaxed">
                    <ReactMarkdown>{chatResponse}</ReactMarkdown>
                  </div>
                ) : isThinking ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                    <div className="text-slate-500 font-medium italic">Wayfinder is thinking...</div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    Ask me anything about your travels!
                  </div>
                )}
              </div>

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
            </motion.div>
          </div>
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
    </div>
  );
};
