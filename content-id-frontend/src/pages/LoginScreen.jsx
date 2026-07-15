import { useEffect, useState } from "react";
import OceanBackground from "../components/OceanBackground";
import { contentIdApi, microsoftSsoStartUrl } from "../lib/api";

const SSO_ERRORS = {
  missing_params: "Microsoft sign-in was interrupted. Please try again.",
  invalid_state: "Sign-in session expired. Please try again.",
  tenant_mismatch: "Your Microsoft account is not in the allowed organization.",
  domain_not_allowed: "Your email domain is not allowed for OceanBazar Content ID.",
  token_exchange_failed: "Microsoft sign-in failed. Please try again.",
  handoff_failed: "Could not complete sign-in. Please try again.",
  missing_email: "Microsoft did not return an email address.",
  microsoft_sso_not_configured: "Microsoft sign-in is not configured yet.",
};

export default function LoginScreen({ onLogin, exchanging }) {
  const [error, setError] = useState("");
  const [microsoftEnabled, setMicrosoftEnabled] = useState(true);

  useEffect(() => {
    contentIdApi.ssoStatus().then((s) => setMicrosoftEnabled(Boolean(s.microsoft))).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get("sso_error");
    if (ssoError) {
      setError(SSO_ERRORS[ssoError] || `Sign-in error: ${ssoError}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <OceanBackground>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="ob-card glass w-full max-w-md p-8 shadow-soft-lg">
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src="/ob-brand-logo.png"
              alt="OceanBazar"
              className="mb-4 h-14 w-auto object-contain"
            />
            <h1 className="text-2xl font-bold text-foreground">Content ID</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Reserve a lifetime-unique OceanBazar product ID for Facebook &amp; Instagram posts.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {exchanging ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <button
              type="button"
              disabled={!microsoftEnabled}
              onClick={() => {
                window.location.href = microsoftSsoStartUrl();
              }}
              className="ob-btn ob-btn-primary w-full py-3"
            >
              <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Sign in with Microsoft 365
            </button>
          )}

          {!microsoftEnabled && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Microsoft SSO is not configured on the server.
            </p>
          )}

          {onLogin && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Use your OceanBazar Microsoft 365 business account.
            </p>
          )}
        </div>
      </div>
    </OceanBackground>
  );
}
