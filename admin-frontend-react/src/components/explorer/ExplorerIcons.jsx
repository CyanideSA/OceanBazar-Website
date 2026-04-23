// Centralized SVG icon set for the Catalog Explorer UI
// All icons are 16×16 by default (pass size prop to override)

export function IconFolder({ size = 16, color = "currentColor", open = false }) {
  return open ? (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M1 3.5C1 2.67 1.67 2 2.5 2H6l1.5 1.5H13.5c.83 0 1.5.67 1.5 1.5v1H1V3.5z" fill={color} fillOpacity="0.7"/>
      <path d="M1 6h14l-1.2 6.5A1.5 1.5 0 0 1 12.32 14H3.68a1.5 1.5 0 0 1-1.48-1.5L1 6z" fill={color}/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13A1.5 1.5 0 0 0 16 11.5V6a1.5 1.5 0 0 0-1.5-1.5H7.5l-1-1.5H1.5z" fill={color}/>
    </svg>
  );
}

export function IconPackage({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1L14 4.5v7L8 15 2 11.5v-7L8 1z" stroke={color} strokeWidth="1.2" fill="none"/>
      <path d="M8 1v14M2 4.5l6 3.5 6-3.5" stroke={color} strokeWidth="1.2"/>
      <path d="M5 3l3 1.7 3-1.7" stroke={color} strokeWidth="1" strokeOpacity="0.6"/>
    </svg>
  );
}

export function IconHome({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6-.5.5.708.708L3 7.707V13.5A1.5 1.5 0 0 0 4.5 15h2a.5.5 0 0 0 .5-.5v-3h2v3a.5.5 0 0 0 .5.5h2A1.5 1.5 0 0 0 13 13.5V7.707l.646.647.708-.708-.5-.5-6-6z"/>
    </svg>
  );
}

export function IconChevronRight({ size = 12, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill={color}>
      <path d="M4.5 2l4 4-4 4" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconChevronDown({ size = 12, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill={color}>
      <path d="M2 4.5l4 4 4-4" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconSearch({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5"/>
      <path d="M11 11l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function IconGrid({ size = 15, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
      <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  );
}

export function IconList({ size = 15, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <rect x="1" y="2" width="3" height="3" rx="0.5"/><rect x="6" y="3" width="9" height="1.5" rx="0.75"/>
      <rect x="1" y="7" width="3" height="3" rx="0.5"/><rect x="6" y="8" width="9" height="1.5" rx="0.75"/>
      <rect x="1" y="12" width="3" height="3" rx="0.5"/><rect x="6" y="13" width="9" height="1.5" rx="0.75"/>
    </svg>
  );
}

export function IconDetails({ size = 15, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="7" width="14" height="2" rx="1"/>
      <rect x="1" y="12" width="14" height="2" rx="1"/>
    </svg>
  );
}

export function IconRefresh({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M13.5 2.5A7 7 0 1 0 14.5 9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14.5 2.5V6h-3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconPlus({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1v11M1 6.5h11" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconClose({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconEdit({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M9.5 4.5l2 2" stroke={color} strokeWidth="1.3"/>
    </svg>
  );
}

export function IconTrash({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M3 4l.8 9.5A1 1 0 0 0 4.8 14.5h6.4a1 1 0 0 0 1-.9L13 4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M6.5 7v4.5M9.5 7v4.5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export function IconMove({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1v14M1 8h14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 4L8 1l3 3M5 12l3 3 3-3M4 5l-3 3 3 3M12 5l3 3-3 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconPreview({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.3"/>
      <path d="M5 14h6M8 12v2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M4 7c0-2 1.8-3 4-3s4 1 4 3-1.8 3-4 3-4-1-4-3z" stroke={color} strokeWidth="1.1"/>
      <circle cx="8" cy="7" r="1.2" fill={color}/>
    </svg>
  );
}

export function IconStar({ size = 13, color = "currentColor", filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={filled ? color : "none"}>
      <path d="M8 1l1.8 4H14l-3.4 2.5 1.3 4L8 9.2 4.1 11.5l1.3-4L2 5h4.2L8 1z" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconTag({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M1.5 1.5h6l7 7-6 6-7-7V1.5z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
      <circle cx="5" cy="5" r="1.2" fill={color}/>
    </svg>
  );
}

export function IconImage({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="12" rx="1.5" stroke={color} strokeWidth="1.3"/>
      <circle cx="5.5" cy="6" r="1.5" stroke={color} strokeWidth="1.1"/>
      <path d="M1 11l4-3.5 3 3 2.5-2 4.5 4" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconPricing({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3"/>
      <path d="M8 4v8M5.5 6.5h4a1 1 0 0 1 0 2H6.5a1 1 0 0 0 0 2H10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function IconVariants({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke={color} strokeWidth="1.2"/>
      <rect x="9" y="1" width="6" height="6" rx="1" stroke={color} strokeWidth="1.2"/>
      <rect x="1" y="9" width="6" height="6" rx="1" stroke={color} strokeWidth="1.2"/>
      <path d="M12 9v6M9 12h6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function IconInfo({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3"/>
      <path d="M8 7.5v4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="5.5" r="0.8" fill={color}/>
    </svg>
  );
}

export function IconSettings({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke={color} strokeWidth="1.3"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.42 1.42M11.65 11.65l1.42 1.42M2.93 13.07l1.42-1.42M11.65 4.35l1.42-1.42" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export function IconUpload({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 10V2M5 5l3-3 3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export function IconExternalLink({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M7 1h5v5M12 1L6 7" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export function IconCopy({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <rect x="4" y="4" width="8" height="8" rx="1" stroke={color} strokeWidth="1.2"/>
      <path d="M1 9V2a1 1 0 0 1 1-1h7" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function IconCheck({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M2 6.5l3.5 3.5 6-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconSpinner({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" strokeOpacity="0.25"/>
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function IconBulkUpload({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 12H1a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M8 9V15M5 12l3 3 3-3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconBanner({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.3"/>
      <path d="M1 7h14M4 3v10M12 3v10" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
    </svg>
  );
}
