import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../../store/AppContext';
import { useToast } from '../../store/ToastContext';
import { signOut, deleteUser } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { User, Mail, Shield, Trash2, LogOut, Camera, Save, X, Sparkles, Globe, CreditCard, Heart } from 'lucide-react';
import { cn } from '../../lib/utils';

export const ProfileView = () => {
  const { user, updateUser, showToast } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
    preferences: user?.preferences || {
      travelStyle: 'Adventurous',
      budget: 'Moderate',
      interests: ['Nature', 'Food']
    }
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    try {
      await updateUser(editData);
      setIsEditing(false);
    } catch (error) {
      console.error('Update failed', error);
      showToast('Failed to update profile');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('Logged out successfully');
    } catch (e) {
      showToast('Error signing out');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await deleteDoc(doc(db, 'users', currentUser.uid));
        await deleteUser(currentUser);
        showToast('Account deleted');
      }
    } catch (e) {
      showToast('Failed to delete account. You may need to re-authenticate.');
    }
  };

  const toggleInterest = (interest: string) => {
    const interests = editData.preferences.interests.includes(interest)
      ? editData.preferences.interests.filter(i => i !== interest)
      : [...editData.preferences.interests, interest];
    
    setEditData({
      ...editData,
      preferences: { ...editData.preferences, interests }
    });
  };

  const styles = ['Adventurous', 'Relaxing', 'Cultural', 'Luxury', 'Budget'];
  const budgets = ['Budget', 'Moderate', 'Luxury'];
  const interests = ['Nature', 'Food', 'History', 'Art', 'Shopping', 'Hiking', 'Nightlife', 'Museums'];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Profile Info */}
        <div className="card p-8 w-full md:w-1/3">
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-100">
                {editData.avatar || user?.avatar ? (
                  <img src={editData.avatar || user?.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <User size={64} />
                  </div>
                )}
              </div>
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="text-white" />
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4 w-full">
                <input
                  type="text"
                  value={editData.name}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-brand outline-none"
                  placeholder="Name"
                />
                <textarea
                  value={editData.bio}
                  onChange={e => setEditData({ ...editData, bio: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand outline-none resize-none"
                  placeholder="Tell us about yourself"
                  rows={3}
                />
                <input
                  type="text"
                  value={editData.avatar}
                  onChange={e => setEditData({ ...editData, avatar: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand outline-none"
                  placeholder="Avatar URL"
                />
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-display font-bold text-slate-900">{user?.name || 'Anonymous Voyager'}</h2>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">{user?.bio || 'No bio yet. Start your journey with Wayfinder AI.'}</p>
              </>
            )}

            <div className="mt-8 flex gap-2 w-full">
              {isEditing ? (
                <>
                  <button onClick={handleSave} className="flex-1 bg-brand text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                    <Save size={16} /> Save
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditData({ ...editData, name: user?.name || '', bio: user?.bio || '', avatar: user?.avatar || '' }); }} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                    <X size={16} /> Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)} className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold">
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="flex-1 space-y-6 w-full">
          <div className="card p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Sparkles className="text-brand" size={20} />
              Travel Preferences
            </h3>
            
            <div className="space-y-8">
              <section>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">Travel Style</label>
                <div className="flex flex-wrap gap-2">
                  {styles.map(style => (
                    <button
                      key={style}
                      disabled={!isEditing}
                      onClick={() => setEditData({ ...editData, preferences: { ...editData.preferences, travelStyle: style } })}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                        editData.preferences.travelStyle === style 
                          ? "bg-brand text-white shadow-lg shadow-brand/20" 
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">Preferred Budget</label>
                <div className="flex flex-wrap gap-2">
                  {budgets.map(budget => (
                    <button
                      key={budget}
                      disabled={!isEditing}
                      onClick={() => setEditData({ ...editData, preferences: { ...editData.preferences, budget: budget } })}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                        editData.preferences.budget === budget 
                          ? "bg-brand text-white shadow-lg shadow-brand/20" 
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {budget}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">Interests</label>
                <div className="flex flex-wrap gap-2">
                  {interests.map(interest => (
                    <button
                      key={interest}
                      disabled={!isEditing}
                      onClick={() => toggleInterest(interest)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                        editData.preferences.interests.includes(interest)
                          ? "bg-brand/10 text-brand border-2 border-brand" 
                          : "bg-slate-50 text-slate-500 border-2 border-transparent hover:bg-slate-100"
                      )}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>

          {/* Dangerous Zone */}
          <div className="card p-8 bg-red-50/30 border-red-100">
            <h3 className="text-lg font-bold text-red-900 mb-6 flex items-center gap-2">
              <LogOut size={20} />
              Account Actions
            </h3>
            <div className="flex flex-wrap gap-4">
              <button onClick={handleSignOut} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                <LogOut size={18} /> Sign Out
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-600 transition-colors">
                <Trash2 size={18} /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card max-w-sm w-full p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Delete Account?</h4>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">This action is permanent and will delete all your saved trips and spots. Are you sure?</p>
            <div className="flex gap-4">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancel</button>
              <button onClick={handleDeleteAccount} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-sm">Yes, Delete</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
