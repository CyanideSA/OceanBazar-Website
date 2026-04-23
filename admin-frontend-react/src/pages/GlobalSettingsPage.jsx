import React, { useEffect, useState, useMemo } from "react";
import { 
  FiSettings, FiGlobe, FiLayout, FiCreditCard, FiShield, FiSave, 
  FiRefreshCw, FiMail, FiPhone, FiFacebook, FiTwitter, FiInstagram, 
  FiYoutube, FiImage, FiGrid, FiClock, FiStar, FiTruck, FiZap, FiAward, FiLock
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { hasPermission } from "../auth/permissionMatrix";
import { useToast } from "../components/ToastProvider";
import { HeroSlidesRowEditor, TestimonialsRowEditor } from "../components/SiteContentRowEditors";

const TABS = [
  { key: "general", label: "General & Contact", icon: FiGlobe },
  { key: "content", label: "Site Content", icon: FiLayout },
  { key: "products", label: "Storefront Lists", icon: FiGrid },
  { key: "gateways", label: "Integrations", icon: FiCreditCard },
];

export default function GlobalSettingsPage() {
  const toast = useToast();
  const role = String(getAdminUser()?.role || "STAFF").toUpperCase();
  const canEdit = hasPermission(role, "settings", "edit");

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supportEmail: "", supportPhone: "", facebookUrl: "", 
    twitterUrl: "", instagramUrl: "", youtubeUrl: "",
    logoDarkUrl: "", logoLightUrl: ""
  });
  const [logoUploading, setLogoUploading] = useState(null);
  const [sf, setSf] = useState({
    heroSlidesJson: "[]", featuredProductIds: "", bestDealsProductIds: "", 
    newArrivalsProductIds: "", testimonialsJson: "[]", trustBadgesJson: "[]",
    defaultBannerRotationMs: 6000, testimonialCarouselMs: 6000
  });
  const [gw, setGw] = useState({
    sslcommerzStoreId: "", sslcommerzStorePassword: "", 
    pathaoClientId: "", pathaoClientSecret: "",
    steadfastApiKey: "", redxApiKey: ""
  });

  const loadSettings = async () => {
    setLoading(true);
    try {
      const d = await adminApi.globalSettings();
      setForm({
        supportEmail: d.supportEmail || "", supportPhone: d.supportPhone || "",
        facebookUrl: d.facebookUrl || "", twitterUrl: d.twitterUrl || "",
        instagramUrl: d.instagramUrl || "", youtubeUrl: d.youtubeUrl || "",
        logoDarkUrl: d.logoDarkUrl || "", logoLightUrl: d.logoLightUrl || ""
      });
      setSf({
        heroSlidesJson: JSON.stringify(d.heroSlides || [], null, 2),
        featuredProductIds: Array.isArray(d.featuredProductIds) ? d.featuredProductIds.join(", ") : "",
        bestDealsProductIds: Array.isArray(d.bestDealsProductIds) ? d.bestDealsProductIds.join(", ") : "",
        newArrivalsProductIds: Array.isArray(d.newArrivalsProductIds) ? d.newArrivalsProductIds.join(", ") : "",
        testimonialsJson: JSON.stringify(d.testimonials || [], null, 2),
        trustBadgesJson: JSON.stringify(d.trustBadges || [], null, 2),
        defaultBannerRotationMs: Number(d.defaultBannerRotationMs) || 6000,
        testimonialCarouselMs: Number(d.testimonialCarouselMs) || 0
      });
      setGw({
        sslcommerzStoreId: d.sslcommerzStoreId || "",
        sslcommerzStorePassword: d.sslcommerzStorePassword || "",
        pathaoClientId: d.pathaoClientId || "",
        pathaoClientSecret: d.pathaoClientSecret || "",
        steadfastApiKey: d.steadfastApiKey || "",
        redxApiKey: d.redxApiKey || ""
      });
    } catch (err) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const splitIds = (txt) => String(txt).split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      await adminApi.updateGlobalSettings({
        ...form,
        ...sf,
        heroSlides: JSON.parse(sf.heroSlidesJson),
        testimonials: JSON.parse(sf.testimonialsJson),
        trustBadges: JSON.parse(sf.trustBadgesJson),
        featuredProductIds: splitIds(sf.featuredProductIds),
        bestDealsProductIds: splitIds(sf.bestDealsProductIds),
        newArrivalsProductIds: splitIds(sf.newArrivalsProductIds),
        ...gw
      });
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all font-medium text-sm ${
        activeTab === id 
          ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
          : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-text-dim">
            <FiSettings size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Global Configurations</h2>
            <p className="text-crm-text-dim text-sm">System-wide settings, storefront content, and API gateways</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadSettings} className="crm-btn" disabled={loading}>
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={handleSave} 
            disabled={!canEdit || saving || loading}
            className="crm-btn crm-btn-primary"
          >
            <FiSave /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {TABS.map(tab => <TabButton key={tab.key} {...tab} id={tab.key} />)}
      </div>

      <div className="crm-card rounded-t-none border-t-0 p-8 min-h-[600px]">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-crm-primary"></div>
          </div>
        ) : (
          <form className="space-y-10 animate-fade-in">
            {activeTab === "general" && (
              <div className="space-y-10">
                {/* Logo Upload */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-2">
                    <FiImage /> Brand Logos
                  </h3>
                  <p className="text-xs text-crm-text-dim">Upload or drag & drop your logo images. These appear across the storefront header, footer, emails, and invoices.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      {key: "logoLightUrl", label: "Light Theme Logo", desc: "Shown on light backgrounds (header)", bg: "bg-white", textColor: "text-gray-400"},
                      {key: "logoDarkUrl", label: "Dark Theme Logo", desc: "Shown on dark backgrounds (header + footer)", bg: "bg-gray-900", textColor: "text-gray-500"}
                    ].map(({key, label, desc, bg, textColor}) => (
                      <div key={key} className="space-y-3">
                        <div>
                          <label className="text-xs font-bold text-crm-text-dim uppercase">{label}</label>
                          <p className="text-2xs text-crm-text-muted mt-0.5">{desc}</p>
                        </div>
                        <div
                          className={`${bg} rounded-xl p-6 flex flex-col items-center justify-center min-h-[120px] border-2 border-dashed border-crm-border hover:border-crm-primary/50 transition-colors cursor-pointer relative group`}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={async (e) => {
                            e.preventDefault(); e.stopPropagation();
                            const file = e.dataTransfer.files?.[0];
                            if (!file || !file.type.startsWith("image/")) return;
                            setLogoUploading(key);
                            try {
                              const res = await adminApi.uploadMedia(file, "logos");
                              const url = res?.url || res?.secure_url || res?.data?.url;
                              if (url) setForm(f => ({...f, [key]: url}));
                              toast.success(`${label} uploaded`);
                            } catch { toast.error("Upload failed"); }
                            finally { setLogoUploading(null); }
                          }}
                          onClick={() => document.getElementById(`logo-input-${key}`)?.click()}
                        >
                          {logoUploading === key && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl z-10">
                              <FiRefreshCw className="animate-spin text-white" size={24} />
                            </div>
                          )}
                          {form[key] ? (
                            <img src={form[key]} alt={label} className="h-16 w-auto object-contain max-w-full" />
                          ) : (
                            <div className="text-center">
                              <FiImage className={`mx-auto mb-2 ${textColor}`} size={28} />
                              <span className={`text-xs ${textColor}`}>Click or drag image here</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            className="crm-input flex-1 text-xs font-mono"
                            value={form[key]}
                            onChange={e => setForm({...form, [key]: e.target.value})}
                            placeholder="https://res.cloudinary.com/..."
                          />
                          <input id={`logo-input-${key}`} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setLogoUploading(key);
                            try {
                              const res = await adminApi.uploadMedia(file, "logos");
                              const url = res?.url || res?.secure_url || res?.data?.url;
                              if (url) setForm(f => ({...f, [key]: url}));
                              toast.success(`${label} uploaded`);
                            } catch { toast.error("Upload failed"); }
                            finally { setLogoUploading(null); e.target.value = ""; }
                          }} />
                          {form[key] && (
                            <button type="button" onClick={() => setForm(f => ({...f, [key]: ""}))} className="crm-btn text-xs text-red-400 hover:text-red-300" title="Remove logo">
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-2">
                    <FiMail /> Contact Details
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Support Email</label>
                      <input className="crm-input" value={form.supportEmail} onChange={e => setForm({...form, supportEmail: e.target.value})} placeholder="support@oceanbazar.com" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Support Phone</label>
                      <input className="crm-input" value={form.supportPhone} onChange={e => setForm({...form, supportPhone: e.target.value})} placeholder="+880 1XXX-XXXXXX" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-2">
                    <FiFacebook /> Social Presence
                  </h3>
                  <div className="space-y-4">
                    <div className="relative">
                      <FiFacebook className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                      <input className="crm-input pl-10" value={form.facebookUrl} onChange={e => setForm({...form, facebookUrl: e.target.value})} placeholder="Facebook Page URL" />
                    </div>
                    <div className="relative">
                      <FiInstagram className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                      <input className="crm-input pl-10" value={form.instagramUrl} onChange={e => setForm({...form, instagramUrl: e.target.value})} placeholder="Instagram Profile" />
                    </div>
                    <div className="relative">
                      <FiYoutube className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                      <input className="crm-input pl-10" value={form.youtubeUrl} onChange={e => setForm({...form, youtubeUrl: e.target.value})} placeholder="YouTube Channel" />
                    </div>
                  </div>
                </div>
              </div>

                {/* Webhook URLs (read-only info) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-2">
                    <FiZap /> Courier Webhook URLs
                  </h3>
                  <p className="text-xs text-crm-text-dim">Register these URLs with each courier provider to receive delivery status updates.</p>
                  <div className="space-y-3">
                    {[
                      {label: "Paperfly", url: `${window.location.protocol}//${window.location.hostname}:4000/api/webhooks/paperfly`},
                      {label: "Pathao", url: `${window.location.protocol}//${window.location.hostname}:4000/api/webhooks/pathao`},
                      {label: "Steadfast", url: `${window.location.protocol}//${window.location.hostname}:4000/api/webhooks/steadfast`}
                    ].map(w => (
                      <div key={w.label} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-crm-text-dim w-20">{w.label}</span>
                        <code className="crm-input flex-1 text-xs font-mono bg-crm-bg select-all cursor-text">{w.url}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "content" && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-2">
                    <FiImage /> Homepage Hero Slides
                  </h3>
                  <HeroSlidesRowEditor 
                    jsonString={sf.heroSlidesJson} 
                    onJsonChange={next => setSf({...sf, heroSlidesJson: next})} 
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-2">
                    <FiStar /> Customer Testimonials
                  </h3>
                  <TestimonialsRowEditor 
                    jsonString={sf.testimonialsJson} 
                    onJsonChange={next => setSf({...sf, testimonialsJson: next})} 
                  />
                </div>
              </div>
            )}

            {activeTab === "products" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Curated Lists</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Featured Products (IDs)</label>
                      <textarea className="crm-input min-h-[80px]" value={sf.featuredProductIds} onChange={e => setSf({...sf, featuredProductIds: e.target.value})} placeholder="65e..., 65f..." />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Best Deals (IDs)</label>
                      <textarea className="crm-input min-h-[80px]" value={sf.bestDealsProductIds} onChange={e => setSf({...sf, bestDealsProductIds: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Animation Settings</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase flex items-center gap-2"><FiClock /> Banner Rotation (ms)</label>
                      <input type="number" step="500" className="crm-input" value={sf.defaultBannerRotationMs} onChange={e => setSf({...sf, defaultBannerRotationMs: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase flex items-center gap-2"><FiClock /> Testimonial Delay (ms)</label>
                      <input type="number" step="500" className="crm-input" value={sf.testimonialCarouselMs} onChange={e => setSf({...sf, testimonialCarouselMs: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "gateways" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-2">
                    <FiCreditCard /> Payment Gateway (SSLCommerz)
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Store ID</label>
                      <input className="crm-input font-mono text-xs" value={gw.sslcommerzStoreId} onChange={e => setGw({...gw, sslcommerzStoreId: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Store Password</label>
                      <input type="password" title="Secure entry" className="crm-input font-mono text-xs" value={gw.sslcommerzStorePassword} onChange={e => setGw({...gw, sslcommerzStorePassword: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-2">
                    <FiTruck /> Courier Integrations
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Pathao Client ID</label>
                      <input className="crm-input font-mono text-xs" value={gw.pathaoClientId} onChange={e => setGw({...gw, pathaoClientId: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">RedX API Key</label>
                      <input type="password" title="Secure entry" className="crm-input font-mono text-xs" value={gw.redxApiKey} onChange={e => setGw({...gw, redxApiKey: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}