import React, { useEffect, useMemo, useState } from "react";
import {
  FiSettings, FiGlobe, FiLayout, FiCreditCard, FiSave,
  FiRefreshCw, FiMail, FiFacebook, FiInstagram,
  FiYoutube, FiImage, FiGrid, FiClock, FiStar, FiTruck, FiZap, FiAward,
  FiPhone, FiChevronDown, FiChevronRight, FiLink, FiMapPin, FiBriefcase, FiUsers, FiPlus, FiTrash2,
  FiFileText,
} from "react-icons/fi";
import { SiThreads, SiX } from "react-icons/si";
import { adminApi, resolveAdminApiBase } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { hasPermission } from "../auth/permissionMatrix";
import { useToast } from "../components/ToastProvider";
import { HeroSlidesRowEditor, TestimonialsRowEditor } from "../components/SiteContentRowEditors";
import { StorefrontPopupsEditor, AppDownloadSettingsEditor } from "../components/StorefrontPopupsEditor";
import TrustBadgeCatalogEditor from "../components/TrustBadgeCatalogEditor";
import { AnimationSelect } from "../lib/storefrontMotion";
import { STOREFRONT_CONTENT_DEMOS } from "../lib/storefrontContentDemos";
import PolicyEditor from "../components/pagecontent/PolicyEditor";
import SimplePageEditor from "../components/pagecontent/SimplePageEditor";
import {
  PAGE_KEYS,
  POLICY_KEYS,
  emptyPageContent,
  normalizePageContent,
  getMessageDefaults,
  getPolicyDefaults,
} from "../components/pagecontent/pageContentUtils";

const DEFAULT_COMPANY_VISION =
  "Ocean Bazar was founded by a collaborative team of entrepreneurs with one clear ambition: to redefine modern e-commerce in Bangladesh through reliability, innovation, and uncompromising customer care. We built a digital marketplace where seamless technology meets a carefully managed supply chain—so authentic, high-quality products are accessible and delivered with care. As shared owners, we are personally invested in every step of your journey. From our digital storefront to your doorstep, we are dedicated to growing Ocean Bazar into your most trusted destination for value and excellence.";

const DEFAULT_LEADERSHIP_INTRO =
  "Our success is driven by a leadership team committed to exceptional products and a seamless shopping experience. As co-founders, each member brings a specialized focus—from our digital storefront to your doorstep. Reach out to the relevant department head for specific inquiries.";

const DEFAULT_LEADERSHIP_TEAM = [
  {
    name: "Suvo Ahmed",
    title: "Chief Technology Officer (CTO) & Head of Strategy",
    bio: "Suvo leads our digital infrastructure and business planning. He keeps Ocean Bazar’s platform secure, innovative, and user-friendly while charting the strategic roadmap for long-term growth.",
    email: "suvo-ahmed@oceanbazar.com.bd",
    phone: "",
  },
  {
    name: "Eamam Hasan Nishad",
    title: "Chief Customer Officer (CCO)",
    bio: "Eamam is the voice of our brand and the primary champion for our shoppers. He oversees customer interactions and relationship management so every query is met with dedicated support.",
    email: "nishad@oceanbazar.com.bd",
    phone: "",
  },
  {
    name: "Naeimuzzaman Akand",
    title: "Chief Financial Officer (CFO) & Director of Sales",
    bio: "Naeimuzzaman drives commercial success and financial health. By managing financial strategy and sales initiatives, he keeps operations sustainable while delivering competitive value.",
    email: "akand@oceanbazar.com.bd",
    phone: "",
  },
  {
    name: "MD Jobayer",
    title: "Chief Operating Officer (COO) & Head of Logistics",
    bio: "Jobayer powers our supply chain—inventory, restocking, and fulfillment—so every order is processed accurately and delivered with care across Bangladesh.",
    email: "md-jobayer@oceanbazar.com.bd",
    phone: "",
  },
];

const NAV = [
  { key: "general", label: "Brand & Contact", icon: FiGlobe, hint: "Logos, contact, vision, social" },
  { key: "content", label: "Site Content", icon: FiLayout, hint: "Hero, popups, app download" },
  { key: "pages", label: "Pages / Policies", icon: FiFileText, hint: "Support, policies, wholesale…" },
  { key: "products", label: "Storefront Lists", icon: FiGrid, hint: "Featured IDs & timing" },
  { key: "gateways", label: "Integrations", icon: FiCreditCard, hint: "Payments & couriers" },
];

function Accordion({ id, title, icon: Icon, count, openId, setOpenId, children }) {
  const open = openId === id;
  return (
    <div className="rounded-xl border border-crm-border overflow-hidden bg-crm-bg">
      <button
        type="button"
        onClick={() => setOpenId(open ? null : id)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-crm-bg-hover transition-colors"
      >
        <Icon className="text-crm-primary shrink-0" size={16} />
        <span className="flex-1 text-sm font-bold text-crm-text-bright">{title}</span>
        {count != null ? (
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-crm-bg-alt text-crm-text-dim border border-crm-border">
            {count}
          </span>
        ) : null}
        {open ? <FiChevronDown size={16} className="text-crm-text-dim" /> : <FiChevronRight size={16} className="text-crm-text-dim" />}
      </button>
      {open ? <div className="px-4 pb-4 pt-1 border-t border-crm-border space-y-3">{children}</div> : null}
    </div>
  );
}

function SocialField({ icon: Icon, label, value, onChange, placeholder, disabled, hint }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-crm-border last:border-0">
      <div className="mt-2 h-8 w-8 rounded-lg bg-crm-bg-alt border border-crm-border flex items-center justify-center text-crm-text-dim shrink-0">
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline gap-2">
          <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wide">{label}</label>
          {hint ? <span className="text-2xs text-crm-text-muted">{hint}</span> : null}
        </div>
        <input
          className="crm-input text-sm"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default function GlobalSettingsPage() {
  const toast = useToast();
  const role = String(getAdminUser()?.role || "STAFF").toUpperCase();
  const canEdit = hasPermission(role, "settings", "edit");
  const webhookBase = useMemo(() => resolveAdminApiBase().replace(/\/$/, ""), []);

  const [activeTab, setActiveTab] = useState("general");
  const [contentOpen, setContentOpen] = useState("social");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supportEmail: "", supportPhone: "", contactAddress: "", businessInquiryEmail: "",
    facebookUrl: "", twitterUrl: "", instagramUrl: "", youtubeUrl: "", threadsUrl: "",
    logoDarkUrl: "", logoLightUrl: "", faviconUrl: "",
    legalName: "", tradeLicenseNo: "", tinNumber: "", registeredAddress: "", managementDetails: "",
    companyVision: "", leadershipIntro: "",
    leadershipTeam: [
      { name: "", title: "", bio: "", email: "", phone: "" },
    ],
  });
  const [logoUploading, setLogoUploading] = useState(null);
  const [sf, setSf] = useState({
    heroSlidesJson: "[]", featuredProductIds: "", bestDealsProductIds: "",
    newArrivalsProductIds: "", testimonialsJson: "[]", trustBadgesJson: "[]",
    storefrontPopupsJson: "[]",
    appDownload: {
      enabled: true, androidUrl: "", iosUrl: "", windowsUrl: "", macUrl: "",
      bannerText: "Get the OceanBazar app for a faster shopping experience",
      animation: "slide-down",
    },
    defaultHeroAnimation: "fade",
    defaultBannerRotationMs: 6000, testimonialCarouselMs: 6000,
  });
  const [gw, setGw] = useState({
    sslcommerzMode: "sandbox",
    sslcommerzSandboxStoreId: "",
    sslcommerzSandboxStorePassword: "",
    sslcommerzLiveStoreId: "",
    sslcommerzLiveStorePassword: "",
    pathaoClientId: "", pathaoClientSecret: "",
    steadfastApiKey: "", redxApiKey: "",
  });
  const [sslTesting, setSslTesting] = useState(false);
  const [pageContent, setPageContent] = useState(() => emptyPageContent());
  const [pageLang, setPageLang] = useState("en");
  const [pageSub, setPageSub] = useState("support"); // PAGE_KEYS key or policy:privacy etc.

  const heroCount = useMemo(() => {
    try { const a = JSON.parse(sf.heroSlidesJson || "[]"); return Array.isArray(a) ? a.length : 0; } catch { return 0; }
  }, [sf.heroSlidesJson]);
  const testimonialCount = useMemo(() => {
    try { const a = JSON.parse(sf.testimonialsJson || "[]"); return Array.isArray(a) ? a.length : 0; } catch { return 0; }
  }, [sf.testimonialsJson]);
  const popupCount = useMemo(() => {
    try { const a = JSON.parse(sf.storefrontPopupsJson || "[]"); return Array.isArray(a) ? a.length : 0; } catch { return 0; }
  }, [sf.storefrontPopupsJson]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const d = await adminApi.globalSettings();
      setForm({
        supportEmail: d.supportEmail || "", supportPhone: d.supportPhone || "",
        contactAddress: d.contactAddress || "", businessInquiryEmail: d.businessInquiryEmail || "",
        facebookUrl: d.facebookUrl || "", twitterUrl: d.twitterUrl || "",
        instagramUrl: d.instagramUrl || "", youtubeUrl: d.youtubeUrl || "",
        threadsUrl: d.threadsUrl || "",
        logoDarkUrl: d.logoDarkUrl || "", logoLightUrl: d.logoLightUrl || "",
        faviconUrl: d.faviconUrl || "",
        legalName: d.legalName || "Ocean Bazar",
        tradeLicenseNo: d.tradeLicenseNo || "TRAD/NCC/0002285/2026",
        tinNumber: d.tinNumber || "790019137950",
        registeredAddress: d.registeredAddress || d.contactAddress || "Tatkhana L N Mills-1432, Siddhirganj, Narayanganj",
        managementDetails: d.managementDetails || "",
        companyVision: d.companyVision || DEFAULT_COMPANY_VISION,
        leadershipIntro: d.leadershipIntro || DEFAULT_LEADERSHIP_INTRO,
        leadershipTeam: Array.isArray(d.leadershipTeam) && d.leadershipTeam.length
          ? d.leadershipTeam.map((m) => ({
              name: m?.name || "",
              title: m?.title || "",
              bio: m?.bio || "",
              email: m?.email || "",
              phone: m?.phone || "",
            }))
          : DEFAULT_LEADERSHIP_TEAM.map((m) => ({ ...m })),
      });
      setSf({
        heroSlidesJson: JSON.stringify(d.heroSlides || [], null, 2),
        featuredProductIds: Array.isArray(d.featuredProductIds) ? d.featuredProductIds.join(", ") : "",
        bestDealsProductIds: Array.isArray(d.bestDealsProductIds) ? d.bestDealsProductIds.join(", ") : "",
        newArrivalsProductIds: Array.isArray(d.newArrivalsProductIds) ? d.newArrivalsProductIds.join(", ") : "",
        testimonialsJson: JSON.stringify(d.testimonials || [], null, 2),
        trustBadgesJson: JSON.stringify(d.trustBadges || [], null, 2),
        storefrontPopupsJson: JSON.stringify(d.storefrontPopups || [], null, 2),
        appDownload: {
          enabled: d.appDownload?.enabled !== false,
          androidUrl: d.appDownload?.androidUrl || "",
          iosUrl: d.appDownload?.iosUrl || "",
          windowsUrl: d.appDownload?.windowsUrl || "",
          macUrl: d.appDownload?.macUrl || "",
          bannerText: d.appDownload?.bannerText || "Get the OceanBazar app for a faster shopping experience",
          animation: d.appDownload?.animation || "slide-down",
        },
        defaultHeroAnimation: d.defaultHeroAnimation || "fade",
        defaultBannerRotationMs: Number(d.defaultBannerRotationMs) > 0 ? Number(d.defaultBannerRotationMs) : 6000,
        testimonialCarouselMs: Number(d.testimonialCarouselMs) > 0 ? Number(d.testimonialCarouselMs) : 6000,
      });
      setPageContent(normalizePageContent(d.pageContent));
      setGw({
        sslcommerzMode: d.sslcommerzMode === "live" ? "live" : "sandbox",
        sslcommerzSandboxStoreId: d.sslcommerzSandboxStoreId || d.sslcommerzStoreId || "",
        sslcommerzSandboxStorePassword: d.sslcommerzSandboxStorePassword || (d.sslcommerzMode === "live" ? "" : (d.sslcommerzStorePassword || "")),
        sslcommerzLiveStoreId: d.sslcommerzLiveStoreId || "",
        sslcommerzLiveStorePassword: d.sslcommerzLiveStorePassword || "",
        pathaoClientId: d.pathaoClientId || "",
        pathaoClientSecret: d.pathaoClientSecret || "",
        steadfastApiKey: d.steadfastApiKey || "",
        redxApiKey: d.redxApiKey || "",
      });
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    if (activeTab === "general") setContentOpen("social");
    else if (activeTab === "content") setContentOpen("hero");
    else if (activeTab === "pages") setContentOpen(null);
    else if (activeTab === "products") setContentOpen("lists");
    else if (activeTab === "gateways") setContentOpen("ssl");
  }, [activeTab]);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!canEdit) return;

    const safeJsonParse = (jsonStr, fieldLabel) => {
      try {
        return { ok: true, value: JSON.parse(jsonStr) };
      } catch {
        return { ok: false, error: `Invalid JSON in "${fieldLabel}". Fix it before saving.` };
      }
    };

    const heroResult = safeJsonParse(sf.heroSlidesJson, "Hero Slides");
    const testimonialsResult = safeJsonParse(sf.testimonialsJson, "Testimonials");
    const trustResult = safeJsonParse(sf.trustBadgesJson, "Trust Badges");
    const popupsResult = safeJsonParse(sf.storefrontPopupsJson, "Storefront Popups");
    if (!heroResult.ok) { toast.error(heroResult.error); return; }
    if (!testimonialsResult.ok) { toast.error(testimonialsResult.error); return; }
    if (!trustResult.ok) { toast.error(trustResult.error); return; }
    if (!popupsResult.ok) { toast.error(popupsResult.error); return; }

    setSaving(true);
    try {
      const splitIds = (txt) => String(txt).split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const leadershipTeam = (Array.isArray(form.leadershipTeam) ? form.leadershipTeam : [])
        .map((m) => ({
          name: String(m?.name || "").trim(),
          title: String(m?.title || "").trim(),
          bio: String(m?.bio || "").trim(),
          email: String(m?.email || "").trim(),
          phone: String(m?.phone || "").trim(),
        }))
        .filter((m) => m.name);
      const payload = {
        ...form,
        ...sf,
        companyVision: String(form.companyVision || "").trim(),
        leadershipIntro: String(form.leadershipIntro || "").trim(),
        leadershipTeam,
        pageContent,
        heroSlides: heroResult.value,
        testimonials: testimonialsResult.value,
        trustBadges: trustResult.value,
        storefrontPopups: popupsResult.value,
        appDownload: sf.appDownload,
        defaultHeroAnimation: sf.defaultHeroAnimation || "fade",
        featuredProductIds: splitIds(sf.featuredProductIds),
        bestDealsProductIds: splitIds(sf.bestDealsProductIds),
        newArrivalsProductIds: splitIds(sf.newArrivalsProductIds),
        ...gw,
      };
      await adminApi.updateGlobalSettings(payload);
      // #region agent log
      fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'078c95'},body:JSON.stringify({sessionId:'078c95',runId:'settings-e2e',hypothesisId:'A',location:'GlobalSettingsPage.jsx:handleSave',message:'settings saved',data:{logoLight:!!payload.logoLightUrl,logoDark:!!payload.logoDarkUrl,favicon:!!payload.faviconUrl,testimonials:Array.isArray(payload.testimonials)?payload.testimonials.length:0,trustBadges:Array.isArray(payload.trustBadges)?payload.trustBadges.length:0,featuredIds:Array.isArray(payload.featuredProductIds)?payload.featuredProductIds.length:0,bestDealsIds:Array.isArray(payload.bestDealsProductIds)?payload.bestDealsProductIds.length:0,newArrivalsIds:Array.isArray(payload.newArrivalsProductIds)?payload.newArrivalsProductIds.length:0,bannerMs:payload.defaultBannerRotationMs,testimonialMs:payload.testimonialCarouselMs},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.success("Settings saved — storefront cache cleared; refresh live/lite to verify");
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const loadDemos = async () => {
    if (!canEdit) return;
    const demo = STOREFRONT_CONTENT_DEMOS;
    let featured = demo.featuredProductIds;
    let bestDeals = demo.bestDealsProductIds;
    let newArrivals = demo.newArrivalsProductIds;
    try {
      const data = await adminApi.products({ page: 1, limit: 12, status: "active" });
      const list = Array.isArray(data?.products) ? data.products : Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const ids = list.map((p) => p?.id).filter(Boolean);
      if (ids.length >= 4) {
        featured = ids.slice(0, 4);
        bestDeals = ids.slice(0, 3);
        newArrivals = ids.slice(Math.max(0, ids.length - 4));
      }
    } catch { /* keep fallback demo IDs */ }

    setForm((f) => ({
      ...f,
      logoLightUrl: demo.logoLightUrl,
      logoDarkUrl: demo.logoDarkUrl,
      faviconUrl: demo.faviconUrl,
    }));
    setSf((s) => ({
      ...s,
      testimonialsJson: JSON.stringify(demo.testimonials, null, 2),
      trustBadgesJson: JSON.stringify(demo.trustBadges, null, 2),
      featuredProductIds: featured.join(", "),
      bestDealsProductIds: bestDeals.join(", "),
      newArrivalsProductIds: newArrivals.join(", "),
      defaultBannerRotationMs: demo.defaultBannerRotationMs,
      testimonialCarouselMs: demo.testimonialCarouselMs,
    }));
    setActiveTab("content");
    setContentOpen("testimonials");
    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'078c95'},body:JSON.stringify({sessionId:'078c95',runId:'settings-e2e',hypothesisId:'A',location:'GlobalSettingsPage.jsx:loadDemos',message:'demos loaded into form',data:{featuredCount:featured.length,bestDealsCount:bestDeals.length,newArrivalsCount:newArrivals.length,testimonials:demo.testimonials.length,trustBadges:demo.trustBadges.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    toast.success("Demo logos, testimonials, badges, IDs & timing loaded — click Save to publish");
  };

  const uploadLogo = async (key, file, label) => {
    if (!file || !file.type.startsWith("image/")) return;
    setLogoUploading(key);
    try {
      const res = await adminApi.uploadMedia(file, "logos");
      const url = res?.secureUrl || res?.url || res?.secure_url || res?.data?.url;
      if (url) setForm((f) => ({ ...f, [key]: url }));
      toast.success(`${label} uploaded`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setLogoUploading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-crm-bg-hover text-crm-text-dim">
            <FiSettings size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-crm-text-bright tracking-tight">Settings</h2>
            <p className="text-crm-text-dim text-xs">Storefront content, contact, social & integrations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={loadDemos} className="crm-btn" disabled={!canEdit || loading} title="Fill demo storefront content">
            Load demos
          </button>
          <button type="button" onClick={loadSettings} className="crm-btn" disabled={loading} title="Reload">
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={handleSave} disabled={!canEdit || saving || loading} className="crm-btn crm-btn-primary">
            <FiSave /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {!canEdit && !loading && (
        <div className="rounded-xl border border-crm-warning/30 bg-crm-warning-dim/20 px-4 py-3 text-sm text-crm-text-dim">
          View-only access. Ask an Admin to save changes.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start">
        <nav className="crm-card p-2 space-y-1 lg:sticky lg:top-4">
          {NAV.map(({ key, label, icon: Icon, hint }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                activeTab === key
                  ? "bg-crm-primary/15 text-crm-primary"
                  : "text-crm-text hover:bg-crm-bg-hover"
              }`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight">{label}</span>
                <span className="block text-2xs opacity-70 mt-0.5">{hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="crm-card p-4 sm:p-5 min-h-[420px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-crm-primary" />
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSave}>
              {activeTab === "general" && (
                <div className="space-y-4">
                  <Accordion id="logos" title="Brand logos" icon={FiImage} openId={contentOpen} setOpenId={setContentOpen}>
                    <p className="text-xs text-crm-text-dim">Used in live + lite header/footer. Empty → built-in OceanBazar marks.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: "logoLightUrl", label: "Light theme", desc: "Header / light backgrounds" },
                        { key: "logoDarkUrl", label: "Dark theme", desc: "Footer / dark surfaces" },
                        { key: "faviconUrl", label: "Favicon", desc: "Browser tab icon (live + lite)" },
                      ].map(({ key, label, desc }) => (
                        <div key={key} className="space-y-2">
                          <div>
                            <p className="text-xs font-bold text-crm-text-dim uppercase">{label}</p>
                            <p className="text-2xs text-crm-text-muted">{desc}</p>
                          </div>
                          <div
                            className="rounded-lg border border-dashed border-crm-border p-4 min-h-[88px] flex items-center justify-center cursor-pointer hover:border-crm-primary/50 bg-crm-bg-alt/40"
                            onClick={() => document.getElementById(`logo-input-${key}`)?.click()}
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              uploadLogo(key, e.dataTransfer.files?.[0], label);
                            }}
                          >
                            {logoUploading === key ? (
                              <FiRefreshCw className="animate-spin text-crm-primary" />
                            ) : form[key] ? (
                              <img src={form[key]} alt={label} className="h-12 w-auto object-contain max-w-full" />
                            ) : (
                              <span className="text-xs text-crm-text-muted">Click or drop image</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              className="crm-input flex-1 text-xs font-mono"
                              value={form[key]}
                              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                              disabled={!canEdit}
                              placeholder="https://…"
                            />
                            <input
                              id={`logo-input-${key}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                uploadLogo(key, e.target.files?.[0], label);
                                e.target.value = "";
                              }}
                            />
                            {form[key] ? (
                              <button type="button" className="crm-btn text-xs text-crm-danger" onClick={() => setForm((f) => ({ ...f, [key]: "" }))}>✕</button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Accordion>

                  <Accordion id="contact" title="Contact" icon={FiMail} openId={contentOpen} setOpenId={setContentOpen}>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase flex items-center gap-1.5"><FiMapPin size={12} /> Address</label>
                        <textarea
                          className="crm-input min-h-[72px] text-sm"
                          value={form.contactAddress}
                          onChange={(e) => setForm({ ...form, contactAddress: e.target.value })}
                          placeholder="Head office & warehouse address"
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-crm-text-dim uppercase flex items-center gap-1.5"><FiMail size={12} /> Contact email</label>
                          <input className="crm-input" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} placeholder="contact@oceanbazar.com.bd" disabled={!canEdit} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-crm-text-dim uppercase flex items-center gap-1.5"><FiBriefcase size={12} /> Business inquiry email</label>
                          <input className="crm-input" value={form.businessInquiryEmail} onChange={(e) => setForm({ ...form, businessInquiryEmail: e.target.value })} placeholder="business@oceanbazar.com.bd" disabled={!canEdit} />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-crm-text-dim uppercase flex items-center gap-1.5"><FiPhone size={12} /> Contact phone</label>
                          <input className="crm-input" value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} placeholder="+880 1XXX-XXXXXX" disabled={!canEdit} />
                        </div>
                      </div>
                    </div>
                    <p className="text-2xs text-crm-text-muted">Shown on Contact page, Business Inquiries, and footer mailto / tel links.</p>
                  </Accordion>

                  <Accordion id="legal" title="Legal & compliance" icon={FiBriefcase} openId={contentOpen} setOpenId={setContentOpen}>
                    <p className="text-xs text-crm-text-dim">Shown on Contact page and footer for SSLCommerz settlement compliance.</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Legal / company name</label>
                        <input className="crm-input" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="Ocean Bazar" disabled={!canEdit} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-crm-text-dim uppercase">Trade license no.</label>
                          <input className="crm-input font-mono text-xs" value={form.tradeLicenseNo} onChange={(e) => setForm({ ...form, tradeLicenseNo: e.target.value })} placeholder="TRAD/NCC/0002285/2026" disabled={!canEdit} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-crm-text-dim uppercase">TIN</label>
                          <input className="crm-input font-mono text-xs" value={form.tinNumber} onChange={(e) => setForm({ ...form, tinNumber: e.target.value })} placeholder="790019137950" disabled={!canEdit} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Registered address (trade license)</label>
                        <textarea
                          className="crm-input min-h-[72px] text-sm"
                          value={form.registeredAddress}
                          onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })}
                          placeholder="Tatkhana L N Mills-1432, Siddhirganj, Narayanganj"
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </Accordion>

                  <Accordion id="vision" title="Vision & leadership" icon={FiUsers} openId={contentOpen} setOpenId={setContentOpen} count={Array.isArray(form.leadershipTeam) ? form.leadershipTeam.filter((m) => m?.name).length : 0}>
                    <p className="text-xs text-crm-text-dim">Shown at the top of the Contact page. Edit anytime — storefront picks this up after save (cache clears automatically).</p>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Company vision</label>
                      <textarea
                        className="crm-input min-h-[120px] text-sm"
                        value={form.companyVision}
                        onChange={(e) => setForm({ ...form, companyVision: e.target.value })}
                        placeholder="Our vision for Ocean Bazar…"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Leadership intro</label>
                      <textarea
                        className="crm-input min-h-[80px] text-sm"
                        value={form.leadershipIntro}
                        onChange={(e) => setForm({ ...form, leadershipIntro: e.target.value })}
                        placeholder="Short intro above the leadership team…"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Leadership team</label>
                        {canEdit ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-2xs font-bold text-crm-primary hover:underline"
                            onClick={() => setForm((f) => ({
                              ...f,
                              leadershipTeam: [...(f.leadershipTeam || []), { name: "", title: "", bio: "", email: "", phone: "" }],
                            }))}
                          >
                            <FiPlus size={12} /> Add member
                          </button>
                        ) : null}
                      </div>
                      {(form.leadershipTeam || []).map((member, idx) => (
                        <div key={idx} className="rounded-lg border border-crm-border bg-crm-bg-alt/40 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-2xs font-bold uppercase text-crm-text-muted">Member {idx + 1}</span>
                            {canEdit && (form.leadershipTeam || []).length > 1 ? (
                              <button
                                type="button"
                                className="text-crm-text-dim hover:text-red-500"
                                aria-label="Remove member"
                                onClick={() => setForm((f) => ({
                                  ...f,
                                  leadershipTeam: (f.leadershipTeam || []).filter((_, i) => i !== idx),
                                }))}
                              >
                                <FiTrash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              className="crm-input text-sm"
                              placeholder="Full name"
                              value={member.name}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => {
                                const next = [...(f.leadershipTeam || [])];
                                next[idx] = { ...next[idx], name: e.target.value };
                                return { ...f, leadershipTeam: next };
                              })}
                            />
                            <input
                              className="crm-input text-sm"
                              placeholder="Title / role"
                              value={member.title}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => {
                                const next = [...(f.leadershipTeam || [])];
                                next[idx] = { ...next[idx], title: e.target.value };
                                return { ...f, leadershipTeam: next };
                              })}
                            />
                          </div>
                          <textarea
                            className="crm-input min-h-[64px] text-sm"
                            placeholder="Short bio"
                            value={member.bio}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => {
                              const next = [...(f.leadershipTeam || [])];
                              next[idx] = { ...next[idx], bio: e.target.value };
                              return { ...f, leadershipTeam: next };
                            })}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              className="crm-input text-sm"
                              placeholder="Email"
                              value={member.email}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => {
                                const next = [...(f.leadershipTeam || [])];
                                next[idx] = { ...next[idx], email: e.target.value };
                                return { ...f, leadershipTeam: next };
                              })}
                            />
                            <input
                              className="crm-input text-sm"
                              placeholder="Phone (optional)"
                              value={member.phone}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => {
                                const next = [...(f.leadershipTeam || [])];
                                next[idx] = { ...next[idx], phone: e.target.value };
                                return { ...f, leadershipTeam: next };
                              })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Accordion>

                  <Accordion id="social" title="Social links" icon={FiLink} openId={contentOpen} setOpenId={setContentOpen}>
                    <div className="rounded-lg border border-crm-border px-3">
                      <SocialField icon={FiFacebook} label="Facebook" value={form.facebookUrl} onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })} placeholder="https://facebook.com/…" disabled={!canEdit} />
                      <SocialField icon={FiInstagram} label="Instagram" value={form.instagramUrl} onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })} placeholder="https://instagram.com/…" disabled={!canEdit} />
                      <SocialField icon={FiYoutube} label="YouTube" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} placeholder="https://youtube.com/…" disabled={!canEdit} />
                      <SocialField icon={SiThreads} label="Threads" value={form.threadsUrl} onChange={(e) => setForm({ ...form, threadsUrl: e.target.value })} placeholder="https://www.threads.net/@…" disabled={!canEdit} />
                      <SocialField icon={SiX} label="Twitter / X" value={form.twitterUrl} onChange={(e) => setForm({ ...form, twitterUrl: e.target.value })} placeholder="https://x.com/…" disabled={!canEdit} />
                    </div>
                  </Accordion>

                  <Accordion id="webhooks" title="Courier webhook URLs" icon={FiZap} openId={contentOpen} setOpenId={setContentOpen}>
                    <p className="text-xs text-crm-text-dim">Register these with each courier for delivery status updates.</p>
                    {[
                      { label: "Paperfly", url: `${webhookBase}/api/webhooks/paperfly` },
                      { label: "Pathao", url: `${webhookBase}/api/webhooks/pathao` },
                      { label: "Steadfast", url: `${webhookBase}/api/webhooks/steadfast` },
                    ].map((w) => (
                      <div key={w.label} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-crm-text-dim w-20 shrink-0">{w.label}</span>
                        <code className="crm-input flex-1 text-2xs font-mono bg-crm-bg-alt select-all">{w.url}</code>
                      </div>
                    ))}
                  </Accordion>
                </div>
              )}

              {activeTab === "content" && (
                <div className="space-y-3">
                  <p className="text-xs text-crm-text-dim">Expand one section at a time. Hero slides open as a compact list.</p>
                  <Accordion id="hero" title="Homepage hero slides" icon={FiImage} count={heroCount} openId={contentOpen} setOpenId={setContentOpen}>
                    <HeroSlidesRowEditor
                      jsonString={sf.heroSlidesJson}
                      onJsonChange={(next) => setSf({ ...sf, heroSlidesJson: next })}
                      disabled={!canEdit}
                    />
                  </Accordion>
                  <Accordion id="testimonials" title="Customer testimonials" icon={FiStar} count={testimonialCount} openId={contentOpen} setOpenId={setContentOpen}>
                    <TestimonialsRowEditor
                      jsonString={sf.testimonialsJson}
                      onJsonChange={(next) => setSf({ ...sf, testimonialsJson: next })}
                      disabled={!canEdit}
                    />
                  </Accordion>
                  <Accordion id="trust" title="Trust badges (product catalog)" icon={FiAward} openId={contentOpen} setOpenId={setContentOpen}>
                    <TrustBadgeCatalogEditor disabled={!canEdit} />
                  </Accordion>
                  <Accordion id="popups" title="Storefront popups" icon={FiZap} count={popupCount} openId={contentOpen} setOpenId={setContentOpen}>
                    <StorefrontPopupsEditor
                      jsonString={sf.storefrontPopupsJson}
                      onJsonChange={(next) => setSf({ ...sf, storefrontPopupsJson: next })}
                      disabled={!canEdit}
                    />
                  </Accordion>
                  <Accordion id="appdl" title="App download links" icon={FiLink} openId={contentOpen} setOpenId={setContentOpen}>
                    <AppDownloadSettingsEditor
                      value={sf.appDownload}
                      onChange={(next) => setSf({ ...sf, appDownload: next })}
                      disabled={!canEdit}
                    />
                  </Accordion>
                  <Accordion id="motion" title="Default hero animation" icon={FiClock} openId={contentOpen} setOpenId={setContentOpen}>
                    <AnimationSelect
                      value={sf.defaultHeroAnimation}
                      disabled={!canEdit}
                      onChange={(v) => setSf({ ...sf, defaultHeroAnimation: v })}
                      label="Fallback animation when a slide has none set"
                    />
                  </Accordion>
                </div>
              )}

              {activeTab === "pages" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-crm-border bg-crm-bg-alt/40 px-4 py-3 text-xs text-crm-text-dim">
                    Edit every public page&apos;s copy in English and Bangla. Empty fields keep the built-in storefront defaults. Save at the top to publish — storefront cache clears automatically.
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {["en", "bn"].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setPageLang(lang)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                          pageLang === lang
                            ? "bg-crm-primary text-white border-crm-primary"
                            : "bg-crm-bg text-crm-text-dim border-crm-border hover:border-crm-primary"
                        }`}
                      >
                        {lang === "en" ? "English" : "বাংলা"}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {PAGE_KEYS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPageSub(p.key)}
                        className={`px-2.5 py-1 rounded-full text-2xs font-semibold border ${
                          pageSub === p.key
                            ? "bg-crm-primary/15 text-crm-primary border-crm-primary/40"
                            : "bg-crm-bg text-crm-text-dim border-crm-border"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    {POLICY_KEYS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPageSub(`policy:${p.key}`)}
                        className={`px-2.5 py-1 rounded-full text-2xs font-semibold border ${
                          pageSub === `policy:${p.key}`
                            ? "bg-crm-purple/15 text-crm-purple border-crm-purple/40"
                            : "bg-crm-bg text-crm-text-dim border-crm-border"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {PAGE_KEYS.some((p) => p.key === pageSub) && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-crm-text-bright">
                          {PAGE_KEYS.find((p) => p.key === pageSub)?.label} — {pageLang === "en" ? "English" : "Bangla"}
                        </h3>
                        <button
                          type="button"
                          disabled={!canEdit}
                          className="crm-btn text-xs"
                          onClick={() => {
                            const defaults = getMessageDefaults(pageSub, pageLang);
                            setPageContent((pc) => ({
                              ...pc,
                              [pageSub]: {
                                ...(pc[pageSub] || { en: {}, bn: {} }),
                                [pageLang]: { ...defaults },
                              },
                            }));
                            toast.success("Defaults loaded — review and Save to publish");
                          }}
                        >
                          Load current defaults
                        </button>
                      </div>
                      <SimplePageEditor
                        disabled={!canEdit}
                        value={pageContent[pageSub]?.[pageLang] || {}}
                        onChange={(next) => {
                          setPageContent((pc) => ({
                            ...pc,
                            [pageSub]: {
                              ...(pc[pageSub] || { en: {}, bn: {} }),
                              [pageLang]: next,
                            },
                          }));
                        }}
                      />
                    </div>
                  )}

                  {String(pageSub).startsWith("policy:") && (() => {
                    const policyKey = String(pageSub).replace("policy:", "");
                    const label = POLICY_KEYS.find((p) => p.key === policyKey)?.label || policyKey;
                    const current = pageContent.policies?.[policyKey]?.[pageLang];
                    return (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-crm-text-bright">
                            {label} — {pageLang === "en" ? "English" : "Bangla"}
                          </h3>
                          <button
                            type="button"
                            disabled={!canEdit}
                            className="crm-btn text-xs"
                            onClick={() => {
                              const defaults = getPolicyDefaults(policyKey, pageLang);
                              setPageContent((pc) => ({
                                ...pc,
                                policies: {
                                  ...(pc.policies || {}),
                                  [policyKey]: {
                                    ...(pc.policies?.[policyKey] || { en: null, bn: null }),
                                    [pageLang]: defaults,
                                  },
                                },
                              }));
                              toast.success("Policy defaults loaded — review and Save to publish");
                            }}
                          >
                            Load current defaults
                          </button>
                        </div>
                        <PolicyEditor
                          disabled={!canEdit}
                          value={current || getPolicyDefaults(policyKey, pageLang)}
                          onChange={(next) => {
                            setPageContent((pc) => ({
                              ...pc,
                              policies: {
                                ...(pc.policies || {}),
                                [policyKey]: {
                                  ...(pc.policies?.[policyKey] || { en: null, bn: null }),
                                  [pageLang]: next,
                                },
                              },
                            }));
                          }}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === "products" && (
                <div className="space-y-4">
                  <Accordion id="lists" title="Curated product IDs" icon={FiGrid} openId={contentOpen} setOpenId={setContentOpen}>
                    <p className="text-2xs text-crm-text-muted">
                      Comma or newline separated. Powers <code>featured</code>, <code>best-deals</code>, and <code>latest</code>/<code>new-arrivals</code> collections on live + lite.
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Featured</label>
                        <textarea className="crm-input min-h-[64px] text-xs font-mono" value={sf.featuredProductIds} onChange={(e) => setSf({ ...sf, featuredProductIds: e.target.value })} disabled={!canEdit} placeholder="id1, id2, …" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Best deals</label>
                        <textarea className="crm-input min-h-[64px] text-xs font-mono" value={sf.bestDealsProductIds} onChange={(e) => setSf({ ...sf, bestDealsProductIds: e.target.value })} disabled={!canEdit} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">New arrivals</label>
                        <textarea className="crm-input min-h-[64px] text-xs font-mono" value={sf.newArrivalsProductIds} onChange={(e) => setSf({ ...sf, newArrivalsProductIds: e.target.value })} disabled={!canEdit} />
                      </div>
                    </div>
                  </Accordion>
                  <Accordion id="timing" title="Carousel timing" icon={FiClock} openId={contentOpen} setOpenId={setContentOpen}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Banner rotation (ms)</label>
                        <input type="number" step={500} min={1000} className="crm-input" value={sf.defaultBannerRotationMs} onChange={(e) => setSf({ ...sf, defaultBannerRotationMs: Number(e.target.value) })} disabled={!canEdit} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Testimonial delay (ms)</label>
                        <input type="number" step={500} min={1000} className="crm-input" value={sf.testimonialCarouselMs} onChange={(e) => setSf({ ...sf, testimonialCarouselMs: Number(e.target.value) })} disabled={!canEdit} />
                      </div>
                    </div>
                  </Accordion>
                </div>
              )}

              {activeTab === "gateways" && (
                <div className="space-y-3">
                  <Accordion id="ssl" title="SSLCommerz" icon={FiCreditCard} openId={contentOpen} setOpenId={setContentOpen}>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-crm-border bg-crm-bg-alt p-3 space-y-2">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Active mode</label>
                        <div className="flex flex-wrap gap-2">
                          {["sandbox", "live"].map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => setGw({ ...gw, sslcommerzMode: mode })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                gw.sslcommerzMode === mode
                                  ? "bg-crm-primary text-white border-crm-primary"
                                  : "bg-crm-bg text-crm-text-dim border-crm-border hover:border-crm-primary"
                              }`}
                            >
                              {mode === "sandbox" ? "Sandbox (test)" : "Live (production)"}
                            </button>
                          ))}
                        </div>
                        <p className="text-2xs text-crm-text-muted">
                          Currently using <strong className="text-crm-text-bright">{gw.sslcommerzMode}</strong> credentials for Easy Checkout.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2 rounded-lg border border-crm-border p-3">
                          <p className="text-xs font-bold text-crm-text-bright">Sandbox credentials</p>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-crm-text-dim uppercase">Store ID</label>
                            <input className="crm-input font-mono text-xs" value={gw.sslcommerzSandboxStoreId} onChange={(e) => setGw({ ...gw, sslcommerzSandboxStoreId: e.target.value })} disabled={!canEdit} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-crm-text-dim uppercase">Store password</label>
                            <input type="password" className="crm-input font-mono text-xs" value={gw.sslcommerzSandboxStorePassword} onChange={(e) => setGw({ ...gw, sslcommerzSandboxStorePassword: e.target.value })} disabled={!canEdit} autoComplete="new-password" />
                          </div>
                        </div>
                        <div className="space-y-2 rounded-lg border border-crm-border p-3">
                          <p className="text-xs font-bold text-crm-text-bright">Live credentials</p>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-crm-text-dim uppercase">Store ID</label>
                            <input className="crm-input font-mono text-xs" value={gw.sslcommerzLiveStoreId} onChange={(e) => setGw({ ...gw, sslcommerzLiveStoreId: e.target.value })} disabled={!canEdit} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-crm-text-dim uppercase">Store password</label>
                            <input type="password" className="crm-input font-mono text-xs" value={gw.sslcommerzLiveStorePassword} onChange={(e) => setGw({ ...gw, sslcommerzLiveStorePassword: e.target.value })} disabled={!canEdit} autoComplete="new-password" />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="crm-btn text-xs"
                        disabled={!canEdit || sslTesting}
                        onClick={async () => {
                          setSslTesting(true);
                          try {
                            await adminApi.updateGlobalSettings({ ...form, ...gw });
                            const result = await adminApi.testSslcommerz();
                            if (result?.ok) toast.success(result.message || "SSLCommerz connected");
                            else toast.error(result?.message || "SSLCommerz test failed");
                          } catch (err) {
                            toast.error(err?.response?.data?.message || err?.message || "SSLCommerz test failed");
                          } finally {
                            setSslTesting(false);
                          }
                        }}
                      >
                        {sslTesting ? "Testing…" : "Save & test connection"}
                      </button>
                    </div>
                  </Accordion>
                  <Accordion id="courier" title="Courier APIs" icon={FiTruck} openId={contentOpen} setOpenId={setContentOpen}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Pathao client ID</label>
                        <input className="crm-input font-mono text-xs" value={gw.pathaoClientId} onChange={(e) => setGw({ ...gw, pathaoClientId: e.target.value })} disabled={!canEdit} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Pathao secret</label>
                        <input type="password" className="crm-input font-mono text-xs" value={gw.pathaoClientSecret} onChange={(e) => setGw({ ...gw, pathaoClientSecret: e.target.value })} disabled={!canEdit} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">Steadfast API key</label>
                        <input type="password" className="crm-input font-mono text-xs" value={gw.steadfastApiKey} onChange={(e) => setGw({ ...gw, steadfastApiKey: e.target.value })} disabled={!canEdit} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-crm-text-dim uppercase">RedX API key</label>
                        <input type="password" className="crm-input font-mono text-xs" value={gw.redxApiKey} onChange={(e) => setGw({ ...gw, redxApiKey: e.target.value })} disabled={!canEdit} />
                      </div>
                    </div>
                  </Accordion>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
