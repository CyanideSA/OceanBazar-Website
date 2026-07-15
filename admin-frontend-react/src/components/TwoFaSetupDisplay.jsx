import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

function secretFromOtpauthUrl(otpauthUrl) {
  try {
    const u = new URL(otpauthUrl);
    return (u.searchParams.get("secret") || "").replace(/\s+/g, "").toUpperCase();
  } catch {
    return "";
  }
}

/**
 * Manual entry first (most reliable for Google Authenticator), optional QR scan.
 */
export default function TwoFaSetupDisplay({
  secret,
  otpauthUrl,
  secretHint,
  manualEntryKey,
  accountLabel,
  children,
}) {
  const [showQr, setShowQr] = useState(false);
  if (!secret || !otpauthUrl) return null;
  const hint = secretHint || (secret.length >= 4 ? secret.slice(-4) : "");
  const displayKey = manualEntryKey || secret;
  const qrSecret = useMemo(() => secretFromOtpauthUrl(otpauthUrl), [otpauthUrl]);
  const normalized = String(secret).replace(/\s+/g, "").toUpperCase();
  const qrMismatch = qrSecret && normalized && qrSecret !== normalized;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(secret.replace(/\s+/g, ""));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/95">
        <strong>Recommended:</strong> In Google Authenticator tap <strong>+</strong> →{" "}
        <strong>Enter a setup key</strong> → paste the key below (not your phone camera).
        {accountLabel ? (
          <>
            {" "}
            Account name: <span className="font-mono">{accountLabel}</span>.
          </>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-crm-text-dim">Setup key (tap Copy, then paste in Google Authenticator):</p>
        <div className="flex gap-2">
          <code className="block flex-1 break-all rounded bg-crm-bg-hover px-2 py-1.5 text-[11px] text-crm-text-bright font-mono tracking-wider">
            {displayKey}
          </code>
          <button
            type="button"
            onClick={copyKey}
            className="crm-btn crm-btn-secondary shrink-0 h-auto px-2 text-[10px]"
          >
            Copy key
          </button>
        </div>
        {hint ? (
          <p className="text-[11px] text-amber-400/90 font-medium">
            The key must end with <span className="font-mono">{hint}</span>. Delete every old OceanBazar entry first.
          </p>
        ) : null}
        {qrMismatch ? (
          <p className="text-[11px] text-crm-danger font-medium">
            QR does not match this key — use manual entry or Regenerate QR.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="text-[11px] text-crm-primary underline"
        onClick={() => setShowQr((v) => !v)}
      >
        {showQr ? "Hide QR code" : "Or scan QR code (inside Google Authenticator app only)"}
      </button>

      {showQr ? (
        <div className="flex justify-center">
          <div className="rounded-lg border border-crm-border bg-white p-3 shadow-sm">
            <QRCodeSVG
              value={otpauthUrl}
              size={168}
              level="M"
              includeMargin
              aria-label="Scan inside Google Authenticator only"
            />
          </div>
        </div>
      ) : null}

      {children}
    </div>
  );
}
