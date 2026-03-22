import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, MapPin } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export const ImportHistoryModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { importHistory } = useApp();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">Import History</h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {importHistory.length > 0 ? (
                importHistory.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl">
                    <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{item.destination}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(item.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">No import history yet.</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
