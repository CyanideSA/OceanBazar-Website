/**
 * Demo payloads for Settings → Brand / Content / Storefront Lists.
 * Click “Load demos” in CRM, then Save to publish to live + lite storefronts.
 */
export const STOREFRONT_CONTENT_DEMOS = {
  logoLightUrl: "https://oceanbazar.com.bd/ob-brand-logo.png?v=7",
  logoDarkUrl: "https://oceanbazar.com.bd/ob-footer-logo.png?v=7",
  faviconUrl: "https://oceanbazar.com.bd/ob-brand-logo.png?v=7",
  defaultBannerRotationMs: 5500,
  testimonialCarouselMs: 7000,
  testimonials: [
    {
      name: "Nusrat Rahman",
      title: "Dhaka",
      quote: "Every serum arrived sealed and authentic — exactly what OceanBazar promises.",
      rating: 5,
      verified: true,
      avatarUrl: "",
    },
    {
      name: "Farhan Ahmed",
      title: "Chattogram",
      quote: "Wholesale pricing with retail-grade packaging. Reordered within a week.",
      rating: 5,
      verified: true,
      avatarUrl: "",
    },
    {
      name: "Maliha Chowdhury",
      title: "Sylhet",
      quote: "Support answered on chat the same hour. Delivery was on time across town.",
      rating: 5,
      verified: true,
      avatarUrl: "",
    },
  ],
  trustBadges: [
    { icon: "shield", label: "100% authentic", labelBn: "১০০% অথেন্টিক", description: "Verified genuine products" },
    { icon: "truck", label: "Nationwide delivery", labelBn: "সারাদেশে ডেলিভারি", description: "Across Bangladesh" },
    { icon: "lock", label: "Secure payment", labelBn: "নিরাপদ পেমেন্ট", description: "bKash · Nagad · COD" },
    { icon: "headphones", label: "Real support", labelBn: "লাইভ সাপোর্ট", description: "Chat when you need it" },
  ],
  /** Fallback IDs if admin product list is unavailable — replace via Load demos fetch when possible */
  featuredProductIds: ["A1B2C3D4", "C3D4E5F6", "E5F6G7H8", "G7H8I9J0"],
  bestDealsProductIds: ["A1B2C3D4", "I9J0K1L2", "K1L2M3N4"],
  newArrivalsProductIds: ["M3N4O5P6", "O5P6Q7R8", "Q7R8S9T0", "S9T0U1V2"],
};
