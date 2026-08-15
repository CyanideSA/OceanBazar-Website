/** Keep in sync with frontend/lib/storefrontMotion.ts */
import React from "react";

export const STOREFRONT_ANIMATIONS = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "fade-up", label: "Fade up" },
  { value: "fade-down", label: "Fade down" },
  { value: "fade-left", label: "Fade left" },
  { value: "fade-right", label: "Fade right" },
  { value: "zoom-in", label: "Zoom in" },
  { value: "zoom-out", label: "Zoom out" },
  { value: "slide-up", label: "Slide up" },
  { value: "slide-down", label: "Slide down" },
  { value: "slide-left", label: "Slide left" },
  { value: "slide-right", label: "Slide right" },
  { value: "bounce", label: "Bounce" },
  { value: "flip", label: "Flip" },
  { value: "blur-in", label: "Blur in" },
  { value: "scale-spring", label: "Scale spring" },
  { value: "rotate-in", label: "Rotate in" },
  { value: "ken-burns", label: "Ken Burns" },
];

export function AnimationSelect({ value, onChange, disabled, label = "Animation" }) {
  return (
    <label className="block space-y-1">
      <span className="text-2xs font-bold uppercase tracking-wide text-crm-text-dim">{label}</span>
      <select
        className="crm-input text-sm"
        value={value || "fade"}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {STOREFRONT_ANIMATIONS.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>
    </label>
  );
}
