import React, { useState } from 'react';
import { 
  FiFolder, FiSearch, FiFilePlus, FiActivity, FiCheckCircle, 
  FiAlertCircle, FiChevronRight, FiChevronDown, FiBox, FiVideo, FiImage,
  FiTerminal, FiPlay, FiShield
} from "react-icons/fi";
import { adminApi, api } from '../lib/api';
import { useToast } from "../components/ToastProvider";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_PATH = 'C:\\Users\\akand\\Desktop\\All Categories (Demo)';

export default function FileImportPage() {
  const toast = useToast();
  const [rootPath, setRootPath] = useState(DEFAULT_PATH);
  const [scanResult, setScanResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [expandedCats, setExpandedCats] = useState({});

  async function handleScan() {
    setScanLoading(true); setError(''); setScanResult(null); setImportResult(null);
    try {
      const res = await api.post('/api/admin/file-import/scan', { rootPath });
      setScanResult(res.data);
      toast.success("Scan completed");
    } catch (e) {
      const msg = e.response?.data?.error ?? 'Scan failed';
      setError(msg);
      toast.error(msg);
    } finally { setScanLoading(false); }
  }

  async function handleImport() {
    setImporting(true); setError(''); setImportResult(null);
    try {
      const res = await api.post('/api/admin/file-import/execute', { rootPath, dryRun });
      setImportResult(res.data);
      toast.success(dryRun ? "Dry run completed" : "Import successful");
    } catch (e) {
      const msg = e.response?.data?.error ?? 'Import failed';
      setError(msg);
      toast.error(msg);
    } finally { setImporting(false); }
  }

  const toggleCat = (name) => setExpandedCats(p => ({ ...p, [name]: !p[name] }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
            <FiFilePlus size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Bulk File Import</h2>
            <p className="text-crm-text-dim text-sm">Ingest product data directly from local directory structures</p>
          </div>
        </div>
      </div>

      {/* Step 1: Configuration */}
      <div className="crm-card space-y-6">
        <div className="flex items-center gap-3 border-b border-crm-border pb-4">
          <div className="w-8 h-8 rounded-lg bg-crm-bg-hover flex items-center justify-center text-crm-primary font-bold">1</div>
          <h3 className="font-bold text-crm-text-bright">Path Configuration</h3>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-crm-text-dim uppercase">Root Directory Absolute Path</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <FiTerminal className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                <input 
                  type="text" 
                  value={rootPath}
                  onChange={e => setRootPath(e.target.value)}
                  placeholder="e.g. C:\Users\Admin\Desktop\Catalog"
                  className="crm-input pl-10 font-mono text-xs h-11"
                />
              </div>
              <button 
                onClick={handleScan}
                disabled={scanLoading || !rootPath}
                className="crm-btn crm-btn-primary px-8"
              >
                {scanLoading ? <FiRefreshCw className="animate-spin" /> : <FiSearch />}
                {scanLoading ? "Scanning..." : "Scan Directory"}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-crm-text-muted italic bg-crm-bg p-3 rounded border border-crm-border">
            Structure expectation: <span className="text-crm-primary">Category</span> → <span className="text-crm-purple">Subcategory</span> → <span className="text-crm-success">Product Folder</span> → Images/Videos
          </p>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="crm-card border-crm-danger bg-crm-danger-dim flex items-center gap-3 text-crm-danger py-3"
        >
          <FiAlertCircle className="shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {/* Step 2: Scan Results */}
      {scanResult && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Categories", count: scanResult.stats.categories, color: "text-crm-primary" },
              { label: "Subcategories", count: scanResult.stats.subcategories, color: "text-crm-purple" },
              { label: "Products", count: scanResult.stats.products, color: "text-crm-success" },
              { label: "Media Files", count: scanResult.stats.media, color: "text-crm-cyan" },
            ].map((stat, i) => (
              <div key={i} className="crm-card text-center">
                <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
              </div>
            ))}
          </div>

          <div className="crm-card p-0 overflow-hidden">
            <div className="p-4 border-b border-crm-border bg-crm-bg/30 flex items-center justify-between">
              <h3 className="text-sm font-bold text-crm-text-bright uppercase tracking-widest flex items-center gap-2">
                <FiActivity /> Detected Structure
              </h3>
              <span className="text-[10px] font-bold text-crm-text-dim">CLICK TO EXPAND</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-crm-border">
              {scanResult.categories.map(cat => (
                <div key={cat.name}>
                  <button 
                    onClick={() => toggleCat(cat.name)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-crm-bg-hover transition-colors text-left"
                  >
                    <FiFolder className={expandedCats[cat.name] ? "text-crm-warning fill-current" : "text-crm-warning"} />
                    <span className="text-sm font-bold text-crm-text-bright">{cat.name}</span>
                    <span className="text-[10px] text-crm-text-dim ml-auto uppercase font-bold">{cat.subcategories.length} sub-folders</span>
                    {expandedCats[cat.name] ? <FiChevronDown /> : <FiChevronRight />}
                  </button>
                  <AnimatePresence>
                    {expandedCats[cat.name] && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden bg-crm-bg/50"
                      >
                        {cat.subcategories.map(sub => (
                          <div key={sub.name} className="pl-8 border-t border-crm-border/30">
                            <div className="flex items-center gap-2 p-3 text-sm font-medium text-crm-text-dim">
                              <FiFolder className="text-crm-primary" />
                              <span>{sub.name}</span>
                              <span className="text-[10px] ml-auto">{sub.products.length} Items</span>
                            </div>
                            <div className="pl-6 space-y-1 pb-2">
                              {sub.products.map(prod => (
                                <div key={prod.name} className="flex items-center gap-3 p-2 text-xs text-crm-text-muted hover:bg-crm-bg-hover rounded-md transition-colors mr-3">
                                  <FiBox className="shrink-0" />
                                  <span className="flex-1 truncate">{prod.name}</span>
                                  <div className="flex gap-3 shrink-0">
                                    {prod.images.length > 0 && <span className="flex items-center gap-1"><FiImage /> {prod.images.length}</span>}
                                    {prod.videos.length > 0 && <span className="flex items-center gap-1"><FiVideo /> {prod.videos.length}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="crm-card bg-crm-primary-dim border-crm-primary/20 flex flex-col sm:flex-row items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <h4 className="font-bold text-crm-primary flex items-center gap-2"><FiShield /> Ready for Import</h4>
              <p className="text-xs text-crm-text-dim">Choose between a safe preview scan or final execution.</p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-crm-bg-hover">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={dryRun} 
                    onChange={e => setDryRun(e.target.checked)} 
                  />
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${dryRun ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm font-bold text-crm-text-bright">Dry Run Mode</span>
              </label>
              <button 
                onClick={handleImport}
                disabled={importing}
                className={`crm-btn h-11 px-10 font-bold ${dryRun ? "bg-crm-bg-card border-crm-border text-crm-text-bright" : "crm-btn-primary"}`}
              >
                {importing ? <FiRefreshCw className="animate-spin" /> : dryRun ? <FiSearch /> : <FiPlay />}
                {importing ? "Processing..." : dryRun ? "Preview Execution" : "Execute Import"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 3: Result Summary */}
      {importResult && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="crm-card space-y-6 border-l-4 border-l-crm-success"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-crm-success flex items-center gap-2">
              {importResult.dryRun ? <FiSearch /> : <FiCheckCircle />}
              {importResult.dryRun ? "Simulation Report" : "Import Successfully Executed"}
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Imported Categories", value: importResult.summary.importedCategories, color: "text-crm-primary" },
              { label: "Imported Products", value: importResult.summary.importedProducts, color: "text-crm-success" },
              { label: "Skipped (Existing)", value: importResult.summary.skipped.length, color: "text-crm-warning" },
              { label: "Failed Operations", value: importResult.summary.errors?.length || 0, color: "text-crm-danger" },
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-xl bg-crm-bg/50 border border-crm-border text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>

          {importResult.summary.errors?.length > 0 && (
            <div className="p-4 rounded-xl bg-crm-danger-dim border border-crm-danger/20">
              <h4 className="text-xs font-bold text-crm-danger uppercase tracking-widest mb-3 flex items-center gap-2">
                <FiXCircle /> Error Log
              </h4>
              <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                {importResult.summary.errors.map((e, i) => (
                  <p key={i} className="text-xs text-crm-text-dim font-mono">• {e}</p>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
