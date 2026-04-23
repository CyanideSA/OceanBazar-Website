import React from "react";
import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const FooterLink = ({ to, children }) => (
  <Link
    to={to}
    className="text-sm text-slate-400 hover:text-white transition-colors duration-200"
  >
    {children}
  </Link>
);

const FooterExternal = ({ href, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="text-sm text-slate-400 hover:text-white transition-colors duration-200"
    aria-label={label}
    title={label}
  >
    {label}
  </a>
);

const SocialLink = ({ href, label, children }) => (
  <a
    href={href}
    className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-[#5BA3D0]/20 border border-white/[0.08] hover:border-[#5BA3D0]/30 flex items-center justify-center transition-all duration-200 group"
    aria-label={label}
    title={label}
  >
    {children}
  </a>
);

export default function Footer() {
  const { supportEmail, supportPhone, facebookUrl, twitterUrl, instagramUrl, youtubeUrl } = useSiteSettings();

  const social = [
    { key: "fb", href: facebookUrl, label: "Facebook", Icon: Facebook },
    { key: "tw", href: twitterUrl, label: "Twitter", Icon: Twitter },
    { key: "ig", href: instagramUrl, label: "Instagram", Icon: Instagram },
    { key: "yt", href: youtubeUrl, label: "YouTube", Icon: Youtube },
  ].filter((s) => s.href && String(s.href).trim());

  return (
    <footer className="mt-12 bg-gradient-to-b from-[#0c1524] to-[#070d17] text-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-5">
                <img
                  src="https://customer-assets.emergentagent.com/job_ocean-commerce-4/artifacts/nudvg1tt_OceanBazar%20Logo.png"
                  alt="OceanBazar"
                  className="h-12 w-auto object-contain"
                />
                <div>
                  <div className="text-lg font-bold tracking-tight">OceanBazar</div>
                  <div className="text-[13px] text-slate-400">
                    B2B marketplace for wholesale and partner trade
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                Discover trusted suppliers, secure transactions, and fast support.
                Built for global trade with a seamless customer experience.
              </p>

              <div className="mt-6 flex items-center gap-2.5 flex-wrap">
                {social.length === 0 ? (
                  <span className="text-xs text-slate-500">Social links are configured in admin.</span>
                ) : (
                  social.map(({ key, href, label, Icon }) => (
                    <SocialLink key={key} href={href} label={label}>
                      <Icon className="w-4 h-4 text-slate-400 group-hover:text-[#5BA3D0] transition-colors" />
                    </SocialLink>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-4 text-white">About</div>
              <div className="flex flex-col gap-2.5">
                <FooterLink to="/who-we-are">Who We Are</FooterLink>
                <FooterLink to="/wholesale-hub">Wholesale Hub</FooterLink>
                <FooterLink to="/marketplace">Marketplace</FooterLink>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-4 text-white">Help</div>
              <div className="flex flex-col gap-2.5">
                <FooterLink to="/help">Help Center</FooterLink>
                <FooterLink to="/help/customer-support">Customer Support</FooterLink>
                <FooterLink to="/help/dispute">Disputes</FooterLink>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-4 text-white">Policies</div>
              <div className="flex flex-col gap-2.5">
                <FooterLink to="/protections">Order Protections</FooterLink>
                <FooterLink to="/privacy-policy">Privacy Policy</FooterLink>
                <FooterLink to="/terms-of-service">Terms of Service</FooterLink>
              </div>
            </div>
          </div>
        </div>

        <div className="py-6 border-t border-white/[0.06] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-slate-500">
            © {new Date().getFullYear()} OceanBazar. All rights reserved.
          </div>
          <div className="text-xs text-slate-500">
            {supportEmail || "—"}
            {supportEmail && supportPhone ? " · " : null}
            {supportPhone || ""}
          </div>
        </div>
      </div>
    </footer>
  );
}
