import React, { useState } from "react";
import { FiLock, FiUser, FiArrowRight, FiRefreshCw } from "react-icons/fi";
import { motion } from "framer-motion";

export default function LoginPage({ onLogin, loading }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await onLogin({ username, password });
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-crm-bg p-6 relative overflow-hidden">
      {/* Background Orbs for Depth */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-crm-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-crm-purple/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] z-10"
      >
        <div className="text-center mb-8">
          <img src="/logo-dark.png" alt="OceanBazar" className="h-20 w-auto mx-auto mb-2 object-contain drop-shadow-xl" />
          <p className="text-crm-text-dim mt-2 font-medium">Administrative Command Center</p>
        </div>

        <div className="crm-card bg-crm-bg-alt/80 backdrop-blur-xl p-8 border-crm-border shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-crm-text-bright">Sign In</h2>
            <p className="text-xs text-crm-text-dim">Enter your credentials to access the backoffice</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Username</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                <input 
                  type="text"
                  required
                  placeholder="admin_id" 
                  className="crm-input pl-10 h-11" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Password</label>
              </div>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                <input 
                  type="password"
                  required
                  placeholder="••••••••" 
                  className="crm-input pl-10 h-11" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs font-bold text-crm-danger bg-crm-danger-dim p-3 rounded-lg border border-crm-danger/20"
              >
                {error}
              </motion.div>
            )}

            <button 
              type="submit" 
              className="crm-btn crm-btn-primary w-full h-11 text-sm font-bold shadow-lg shadow-crm-primary/20"
              disabled={loading}
            >
              {loading ? <FiRefreshCw className="animate-spin" /> : <FiArrowRight />}
              {loading ? "Authenticating..." : "Establish Secure Session"}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-crm-text-muted font-bold uppercase tracking-[0.2em]">
            &copy; 2026 OceanBazar Enterprise &bull; Secure Protocol 
          </p>
        </div>
      </motion.div>
    </div>
  );
}
