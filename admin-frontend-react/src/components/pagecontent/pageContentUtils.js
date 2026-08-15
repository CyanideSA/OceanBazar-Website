import messageDefaults from "./messageDefaults.json";
import policyDefaults from "./policyDefaults.json";

export const PAGE_KEYS = [
  { key: "support", label: "Support Center", type: "messages" },
  { key: "obPoints", label: "OB Points", type: "messages" },
  { key: "marketing", label: "Why OceanBazar", type: "messages" },
  { key: "wholesale", label: "Wholesale Hub", type: "messages" },
  { key: "businessInquiries", label: "Business Inquiries", type: "messages" },
];

export const POLICY_KEYS = [
  { key: "privacy", label: "Privacy Policy" },
  { key: "returns", label: "Return Policy" },
  { key: "refunds", label: "Refund Policy" },
  { key: "shipping", label: "Shipping Policy" },
  { key: "terms", label: "Terms & Conditions" },
  { key: "warranty", label: "Warranty Policy" },
];

export function emptyPageContent() {
  return {
    policies: {},
    support: { en: {}, bn: {} },
    marketing: { en: {}, bn: {} },
    wholesale: { en: {}, bn: {} },
    obPoints: { en: {}, bn: {} },
    businessInquiries: { en: {}, bn: {} },
  };
}

/** Normalize API payload into editable shape. */
export function normalizePageContent(raw) {
  const base = emptyPageContent();
  if (!raw || typeof raw !== "object") return base;
  for (const p of PAGE_KEYS) {
    const block = raw[p.key];
    base[p.key] = {
      en: block?.en && typeof block.en === "object" ? { ...block.en } : {},
      bn: block?.bn && typeof block.bn === "object" ? { ...block.bn } : {},
    };
  }
  const policies = raw.policies && typeof raw.policies === "object" ? raw.policies : {};
  for (const p of POLICY_KEYS) {
    const block = policies[p.key];
    base.policies[p.key] = {
      en: block?.en && typeof block.en === "object" ? structuredClone(block.en) : null,
      bn: block?.bn && typeof block.bn === "object" ? structuredClone(block.bn) : null,
    };
  }
  return base;
}

export function getMessageDefaults(pageKey, locale) {
  const block = messageDefaults[pageKey];
  if (!block) return {};
  return { ...(block[locale] || {}) };
}

export function getPolicyDefaults(policyKey, locale) {
  const block = policyDefaults[policyKey];
  if (!block) return { title: "", intro: "", lastUpdated: "", sections: [] };
  return structuredClone(block[locale] || block.en || { title: "", intro: "", lastUpdated: "", sections: [] });
}

export { messageDefaults, policyDefaults };
