import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, api } from '../lib/api';
import { 
  FiStar, FiSearch, FiFilter, FiTrendingUp, FiCheckCircle, 
  FiArrowRight, FiDollarSign, FiPlus, FiMinus, FiAward
} from "react-icons/fi";
import { useToast } from "../components/ToastProvider";
import { motion, AnimatePresence } from "framer-motion";

const TIER_CONFIG = {
  Bronze: { class: 'border-crm-warning/30 text-crm-warning bg-crm-warning-dim' },
  Silver: { class: 'border-crm-border text-crm-text-dim bg-crm-bg-hover' },
  Gold: { class: 'border-crm-primary/30 text-crm-primary bg-crm-primary-dim' },
};

export default function OBPointsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ points: '', note: '' });
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ob-points'],
    queryFn: () => api.get('/api/admin/ob-points').then(r => r.data),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ userId, points, note }) =>
      api.put('/api/admin/ob-points/adjust', { userId, points: Number(points), note }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ob-points'] });
      setAdjustModal(null);
      setAdjustForm({ points: '', note: '' });
      toast.success("Points adjusted successfully");
    },
    onError: () => {
      toast.error("Failed to adjust points");
    }
  });

  const users = Array.isArray(data?.users) ? data.users : [];
  
  const filteredUsers = users.filter(u => 
    !search || `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
            <FiAward size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">OB Points & Rewards</h2>
            <p className="text-crm-text-dim text-sm">Manage customer loyalty points and tier assignments</p>
          </div>
        </div>
      </div>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['Bronze', 'Silver', 'Gold'].map(tier => {
          const count = users.filter(u => u.tier === tier).length;
          const config = TIER_CONFIG[tier];
          return (
            <div key={tier} className={`crm-card border-l-4 border-l-current ${config.class}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1">{tier} Members</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
                <FiStar size={20} className="opacity-50" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search by name, email, phone..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="crm-btn">
          <FiFilter /> Filter Tiers
        </button>
      </div>

      <div className="crm-table-container">
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Status Tier</th>
                <th>Points Balance</th>
                <th>Lifetime Spend</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-crm-text-dim">No records found</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-crm-bg-hover flex items-center justify-center text-crm-primary font-bold">
                          {user.name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="font-medium text-crm-text-bright">{user.name}</p>
                          <p className="text-[10px] text-crm-text-dim font-mono">{user.email || user.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`crm-badge border ${TIER_CONFIG[user.tier]?.class || TIER_CONFIG.Bronze.class}`}>
                        {user.tier}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <FiStar className="text-crm-primary" size={14} />
                        <span className="font-bold tabular-nums text-crm-text-bright">{user.balance.toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-medium tabular-nums text-crm-text-dim">৳{Number(user.lifetimeSpend).toLocaleString()}</span>
                    </td>
                    <td>
                      <button 
                        onClick={() => setAdjustModal(user)}
                        className="text-xs font-bold text-crm-primary hover:underline uppercase tracking-wider"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Adjust Modal */}
      <AnimatePresence>
        {adjustModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setAdjustModal(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-crm-bg-alt border border-crm-border rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-6"
            >
              <div>
                <h3 className="text-xl font-bold text-crm-text-bright mb-1">Points Adjustment</h3>
                <p className="text-sm text-crm-text-dim">Editing balance for <span className="text-crm-primary font-bold">{adjustModal.name}</span></p>
              </div>

              <div className="crm-card bg-crm-bg border-none flex justify-between items-center py-3">
                <span className="text-xs text-crm-text-dim uppercase font-bold">Current Balance</span>
                <span className="text-lg font-bold text-crm-text-bright flex items-center gap-2">
                  <FiStar className="text-crm-primary" /> {adjustModal.balance.toLocaleString()}
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-text-dim uppercase">Adjustment Amount</label>
                  <div className="relative">
                    <FiPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                    <input
                      type="number"
                      value={adjustForm.points}
                      onChange={e => setAdjustForm(f => ({ ...f, points: e.target.value }))}
                      placeholder="e.g. 500 or -200"
                      className="crm-input pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-text-dim uppercase">Reason / Note</label>
                  <input
                    type="text"
                    value={adjustForm.note}
                    onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Enter reason for adjustment"
                    className="crm-input"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setAdjustModal(null)} 
                  className="crm-btn flex-1 py-2.5"
                >
                  Cancel
                </button>
                <button
                  disabled={!adjustForm.points || !adjustForm.note || adjustMutation.isPending}
                  onClick={() => adjustMutation.mutate({ userId: adjustModal.id, ...adjustForm })}
                  className="crm-btn crm-btn-primary flex-1 py-2.5"
                >
                  {adjustMutation.isPending ? 'Saving...' : 'Apply Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
