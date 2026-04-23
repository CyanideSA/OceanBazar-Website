import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { siteSettingsAPI } from "@/api/service";

const defaults = {
  supportEmail: "support@oceanbazar.com.bd",
  supportPhone: "+880 0000 000 000",
  facebookUrl: "",
  twitterUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
  heroSlides: [],
  productBanners: [],
  featuredProductIds: [],
  bestDealsProductIds: [],
  newArrivalsProductIds: [],
  testimonials: [],
  trustBadges: [],
  defaultBannerRotationMs: 6000,
  testimonialCarouselMs: 6000,
};

const SiteSettingsContext = createContext({
  ...defaults,
  loading: true,
  error: null,
  refresh: async () => {},
});

function coerceText(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === "string") {
    const t = v.trim();
    return t || fallback;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(v);
  }
  const s = String(v).trim();
  return s || fallback;
}

export function SiteSettingsProvider({ children }) {
  const [data, setData] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await siteSettingsAPI.get();
      const src = d && typeof d === "object" && !Array.isArray(d) ? d : {};
      setData({
        supportEmail: coerceText(src.supportEmail, defaults.supportEmail),
        supportPhone: coerceText(src.supportPhone, defaults.supportPhone),
        facebookUrl: coerceText(src.facebookUrl, ""),
        twitterUrl: coerceText(src.twitterUrl, ""),
        instagramUrl: coerceText(src.instagramUrl, ""),
        youtubeUrl: coerceText(src.youtubeUrl, ""),
        heroSlides: Array.isArray(src.heroSlides) ? src.heroSlides : [],
        productBanners: Array.isArray(src.productBanners) ? src.productBanners : [],
        featuredProductIds: Array.isArray(src.featuredProductIds) ? src.featuredProductIds : [],
        bestDealsProductIds: Array.isArray(src.bestDealsProductIds) ? src.bestDealsProductIds : [],
        newArrivalsProductIds: Array.isArray(src.newArrivalsProductIds) ? src.newArrivalsProductIds : [],
        testimonials: Array.isArray(src.testimonials) ? src.testimonials : [],
        trustBadges: Array.isArray(src.trustBadges) ? src.trustBadges : [],
        defaultBannerRotationMs: Number(src.defaultBannerRotationMs) > 0 ? Number(src.defaultBannerRotationMs) : 6000,
        testimonialCarouselMs:
          Number(src.testimonialCarouselMs) > 0 ? Number(src.testimonialCarouselMs) : Number(src.defaultBannerRotationMs) > 0
            ? Number(src.defaultBannerRotationMs)
            : 6000,
      });
    } catch (e) {
      setError(e?.message || "Could not load site settings");
      setData(defaults);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...data,
      loading,
      error,
      refresh,
    }),
    [data, loading, error, refresh]
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
