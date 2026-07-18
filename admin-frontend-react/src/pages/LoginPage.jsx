import React, { useState, useEffect } from "react";
import { FiLock, FiUser, FiArrowRight, FiRefreshCw, FiShield, FiKey, FiCheck } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, sanitizeAdminApiStorage, resolveAdminApiBase } from "../lib/api";
import { clearSession } from "../lib/auth";
import TwoFaSetupDisplay from "../components/TwoFaSetupDisplay";

const STEPS = {
  credentials: "credentials",
  changePassword: "changePassword",
  setup2fa: "setup2fa",
  verify2fa: "verify2fa",
  forgotStart: "forgotStart",
  forgotReset: "forgotReset",
  forgotSuccess: "forgotSuccess",
};

const SSO_ERROR_COPY = {
  not_provisioned:
    "This Microsoft account isn't authorized yet. Ask a Super Admin to add your email in Team & Permissions.",
  missing_params: "Microsoft sign-in was interrupted. Please try again.",
  invalid_state: "Sign-in session expired. Please try again.",
  tenant_mismatch: "Your Microsoft account is not in the OceanBazar organization.",
  domain_not_allowed: "Your email domain is not allowed for Admin CRM access.",
  token_exchange_failed: "Microsoft sign-in failed. Please try again.",
  handoff_failed: "Could not complete sign-in. Please try again.",
  missing_email: "Microsoft did not return an email address for this account.",
  microsoft_sso_not_configured: "Microsoft 365 sign-in is not configured on the server yet.",
  inactive: "This admin account is inactive. Contact a Super Admin.",
};

function MicrosoftLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function LoginPage({ onLogin, loading }) {
  const [step, setStep] = useState(STEPS.credentials);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [onboardingToken, setOnboardingToken] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [twoFaSetup, setTwoFaSetup] = useState(null);
  const [otpCheckOk, setOtpCheckOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ssoStatus, setSsoStatus] = useState({ microsoft: false, google: false });
  const [showEmergency, setShowEmergency] = useState(false);
  const [footerClicks, setFooterClicks] = useState(0);

  useEffect(() => {
    sanitizeAdminApiStorage();
    clearSession();
    adminApi.ssoStatus().then(setSsoStatus).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get("sso_error");
    const wantLegacy = params.get("legacy") === "1";
    const storedError = sessionStorage.getItem("oceanbazar_admin_sso_error");

    if (ssoError) {
      const key = decodeURIComponent(ssoError);
      const message = SSO_ERROR_COPY[key] || `SSO failed: ${key}`;
      sessionStorage.setItem("oceanbazar_admin_sso_error", message);
      setError(message);
    } else if (storedError) {
      setError(storedError);
      sessionStorage.removeItem("oceanbazar_admin_sso_error");
    }

    if (wantLegacy) {
      sessionStorage.setItem("oceanbazar_admin_legacy_login", "1");
      setShowEmergency(true);
    } else if (sessionStorage.getItem("oceanbazar_admin_legacy_login") === "1") {
      sessionStorage.removeItem("oceanbazar_admin_legacy_login");
      setShowEmergency(true);
    }

    if (ssoError || wantLegacy) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (step !== STEPS.setup2fa || !onboardingToken || twoFaSetup) return;
    let cancelled = false;
    setBusy(true);
    setError("");
    adminApi
      .onboarding2faSetup({ onboardingToken })
      .then((setup) => {
        if (!cancelled) setTwoFaSetup(setup);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || "Could not load 2FA setup");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, onboardingToken, twoFaSetup]);

  const resetToLogin = () => {
    clearSession();
    setStep(STEPS.credentials);
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setOtp("");
    setOnboardingToken("");
    setTempToken("");
    setResetToken("");
    setTwoFaSetup(null);
    setOtpCheckOk(false);
    setError("");
  };

  const test2faCode = async () => {
    if (!onboardingToken || otp.length !== 6) {
      setError("Enter a 6-digit code first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await adminApi.onboarding2faCheck({ onboardingToken, otp });
      setOtpCheckOk(Boolean(r?.valid));
      if (r?.valid) {
        setError("");
      } else {
        setError(
          `Code does not match this setup key (ending ${r?.secretHint || twoFaSetup?.secretHint || "????"}). ` +
            "Delete old OceanBazar entries in Google Authenticator, tap Regenerate QR, paste the new key, then test again."
        );
      }
    } catch (err) {
      setOtpCheckOk(false);
      setError(err?.response?.data?.error || err?.message || "Could not verify code");
    } finally {
      setBusy(false);
    }
  };

  const refresh2faSetup = async () => {
    if (!onboardingToken) return;
    setBusy(true);
    setError("");
    setOtp("");
    setOtpCheckOk(false);
    try {
      const setup = await adminApi.onboarding2faRefresh({ onboardingToken });
      setTwoFaSetup(setup);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Could not regenerate 2FA setup");
    } finally {
      setBusy(false);
    }
  };

  const finishSession = async (res) => {
    if (!res?.token || !res?.admin?.id) {
      throw new Error(res?.error || "Login failed: server did not return a session token.");
    }
    await onLogin({ session: res });
  };

  const handlePostLoginResponse = async (res) => {
    if (res?.requiresPasswordChange) {
      setOnboardingToken(res.onboardingToken);
      setStep(STEPS.changePassword);
      setNewPassword("");
      setConfirmPassword("");
      return;
    }
    if (res?.requires2faSetup) {
      setOnboardingToken(res.onboardingToken);
      setStep(STEPS.setup2fa);
      setTwoFaSetup(null);
      setOtp("");
      setOtpCheckOk(false);
      return;
    }
    if (res?.requires2fa) {
      setTempToken(res.tempToken);
      setStep(STEPS.verify2fa);
      setOtp("");
      return;
    }
    await finishSession(res);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (step === STEPS.credentials) {
        const res = await onLogin({ username, password });
        await handlePostLoginResponse(res);
        return;
      }

      if (step === STEPS.changePassword) {
        if (newPassword.length < 8) {
          setError("Password must be at least 8 characters");
          return;
        }
        if (newPassword !== confirmPassword) {
          setError("Passwords do not match");
          return;
        }
        const res = await adminApi.onboardingChangePassword({ onboardingToken, newPassword });
        await handlePostLoginResponse(res);
        return;
      }

      if (step === STEPS.setup2fa) {
        if (!twoFaSetup) {
          setError("Loading QR code… try again in a moment");
          return;
        }
        if (otp.length !== 6) {
          setError("Enter the 6-digit code from your authenticator app");
          return;
        }
        const res = await adminApi.onboarding2faEnable({
          onboardingToken,
          setupToken: twoFaSetup.setupToken,
          otp,
        });
        await finishSession(res);
        return;
      }

      if (step === STEPS.verify2fa) {
        const res = await onLogin({ tempToken, otp });
        await finishSession(res);
        return;
      }

      if (step === STEPS.forgotStart) {
        if (!username.trim()) {
          setError("Enter your username or email");
          return;
        }
        const res = await adminApi.forgotPasswordStart({ username: username.trim() });
        if (res?.resetToken) {
          setResetToken(res.resetToken);
          setNewPassword("");
          setConfirmPassword("");
          setOtp("");
          setStep(STEPS.forgotReset);
        }
        return;
      }

      if (step === STEPS.forgotReset) {
        if (newPassword.length < 8) {
          setError("Password must be at least 8 characters");
          return;
        }
        if (newPassword !== confirmPassword) {
          setError("Passwords do not match");
          return;
        }
        if (otp.length !== 6) {
          setError("Enter the 6-digit code from your authenticator app");
          return;
        }
        await adminApi.forgotPasswordReset({ resetToken, otp, newPassword });
        setStep(STEPS.forgotSuccess);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const isLoading = loading || busy;

  const titles = {
    [STEPS.credentials]: {
      heading: "Emergency Access",
      sub: "Username and password still require Google Authenticator verification",
    },
    [STEPS.changePassword]: { heading: "Set Your Password", sub: "You must choose a new password before continuing" },
    [STEPS.setup2fa]: {
      heading: "Set Up 2FA",
      sub: "Scan the QR code or enter the setup key in Google Authenticator, then enter the 6-digit code",
    },
    [STEPS.verify2fa]: {
      heading: "Verify Authenticator",
      sub: "Enter the 6-digit code currently shown in Google Authenticator (not the previous one — wait for it to refresh if needed)",
    },
    [STEPS.forgotStart]: { heading: "Reset Password", sub: "Enter your username or email to begin password recovery" },
    [STEPS.forgotReset]: {
      heading: "Verify & Set New Password",
      sub: "Enter your authenticator code and choose a new password",
    },
    [STEPS.forgotSuccess]: {
      heading: "Password Updated",
      sub: "Your password has been reset. Sign in with your new password.",
    },
  };

  const { heading, sub } = titles[step];

  const startMicrosoft = () => {
    window.location.href = `${resolveAdminApiBase()}/api/admin/auth/sso/microsoft/start`;
  };

  const onFooterClick = () => {
    const next = footerClicks + 1;
    setFooterClicks(next);
    if (next >= 5) {
      setShowEmergency(true);
      setFooterClicks(0);
    }
  };

  const showM365Primary = !showEmergency || step === STEPS.credentials;

  // OceanBazar cream (#FAF7F2) 75% + brand blue (#1E7EB8) 25% → #C3D9E4
  const gradientWash =
    "linear-gradient(90deg, #C3D9E4 0%, #C3D9E4 24%, rgba(195,217,228,0.90) 46%, rgba(250,247,242,0.42) 70%, rgba(250,247,242,0.10) 86%, rgba(255,255,255,0) 100%)";

  return (
    <div
      className="h-[100dvh] relative overflow-x-hidden overflow-y-auto overscroll-y-contain"
      style={{
        backgroundImage: `${gradientWash}, url(/admin-login-bg.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center right",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#FAF7F2]/35 via-transparent to-[#1E7EB8]/10" />

      <div className="relative z-10 min-h-full flex items-start sm:items-center">
        <div className="w-full max-w-xl px-6 sm:px-10 lg:px-16 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <div className="space-y-5">
              <div className="space-y-3">
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-[#1E7EB8]"
                >
                  Beyond borders · Built for generations
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.12] tracking-tight text-[#0C2F4A]"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  OceanBazar
                  <span className="block text-[#123A58]">Administrative Panel</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm sm:text-base text-[#3A5A72] max-w-md leading-relaxed"
                >
                  The command center powering Bangladesh&apos;s most trusted destination for authentic global brands.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] sm:text-xs text-[#4A6B82]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#1E7EB8]" />
                  Enterprise-grade access
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#1E7EB8]" />
                  Microsoft 365 secured
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#1E7EB8]" />
                  Built for generations
                </span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.45 }}
              className="rounded-2xl border border-[#1E7EB8]/18 bg-[#FAF7F2]/80 backdrop-blur-xl p-6 sm:p-7 shadow-xl space-y-5 max-w-md"
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs font-medium text-red-700 bg-red-50 p-3 rounded-lg border border-red-200"
                >
                  {error}
                </motion.div>
              )}

              {showM365Primary && (
                <div className="space-y-3">
                  {ssoStatus.microsoft ? (
                    <button
                      type="button"
                      onClick={startMicrosoft}
                      disabled={isLoading}
                      className="w-full h-12 rounded-xl bg-white hover:bg-[#F4FBFF] text-[#0C2F4A] font-semibold text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-60 shadow-md border border-[#1E7EB8]/20"
                    >
                      <MicrosoftLogo size={18} />
                      Sign in with Microsoft 365
                    </button>
                  ) : (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-xs text-amber-900/90">
                      Microsoft 365 SSO is not configured on the server yet. Set{" "}
                      <span className="font-mono text-amber-950">MS_SSO_*</span> and{" "}
                      <span className="font-mono text-amber-950">MS_TENANT_ID</span> on the API.
                    </div>
                  )}
                  <p className="text-[11px] text-[#4A6B82] text-center leading-relaxed">
                    No extra password needed — your Microsoft 365 identity is your key.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {showEmergency && (
                  <motion.div
                    key="emergency"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    {showM365Primary && (
                      <div className="relative py-1 mb-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[#1E7EB8]/15" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                          <span className="bg-[#FAF7F2]/90 px-2 text-[#4A6B82]">Emergency · Authenticator required</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 mb-4">
                      <h2 className="text-base font-semibold text-[#0C2F4A]">{heading}</h2>
                      <p className="text-[11px] text-[#4A6B82]">{sub}</p>
                    </div>

                    {step === STEPS.forgotSuccess ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-50 p-4">
                          <FiCheck className="text-emerald-600 flex-shrink-0" size={20} />
                          <p className="text-sm text-emerald-800 font-medium">Password reset successful</p>
                        </div>
                        <button
                          type="button"
                          onClick={resetToLogin}
                          className="w-full h-11 rounded-xl bg-[#1E7EB8] hover:bg-[#1869A0] text-white text-sm font-semibold"
                        >
                          Back to Sign In
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={submit} className="space-y-4">
                        {step === STEPS.credentials && (
                          <>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-[#4A6B82] uppercase tracking-wider">
                                Username
                              </label>
                              <div className="relative">
                                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E7EB8]/70" />
                                <input
                                  type="text"
                                  required
                                  placeholder="admin_id"
                                  className="w-full h-11 rounded-xl bg-white/90 border border-[#1E7EB8]/25 text-[#0C2F4A] placeholder:text-[#4A6B82]/45 pl-10 pr-3 text-sm outline-none focus:border-[#1E7EB8]/70"
                                  value={username}
                                  onChange={(e) => setUsername(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-[#4A6B82] uppercase tracking-wider">
                                  Password
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStep(STEPS.forgotStart);
                                    setError("");
                                    setPassword("");
                                  }}
                                  className="text-[11px] text-[#1E7EB8] hover:underline"
                                >
                                  Forgot password?
                                </button>
                              </div>
                              <div className="relative">
                                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E7EB8]/70" />
                                <input
                                  type="password"
                                  required
                                  placeholder="••••••••"
                                  className="w-full h-11 rounded-xl bg-white/90 border border-[#1E7EB8]/25 text-[#0C2F4A] placeholder:text-[#4A6B82]/45 pl-10 pr-3 text-sm outline-none focus:border-[#1E7EB8]/70"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-[#4A6B82] flex items-start gap-1.5">
                              <FiShield className="mt-0.5 shrink-0 text-[#1E7EB8]" size={12} />
                              After password, you must verify with Google Authenticator before CRM access.
                            </p>
                          </>
                        )}

                        {step === STEPS.forgotStart && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[#4A6B82] uppercase tracking-wider">
                              Username or Email
                            </label>
                            <div className="relative">
                              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E7EB8]/70" />
                              <input
                                type="text"
                                required
                                placeholder="admin_id or email"
                                className="w-full h-11 rounded-xl bg-white/90 border border-[#1E7EB8]/25 text-[#0C2F4A] placeholder:text-[#4A6B82]/45 pl-10 pr-3 text-sm outline-none focus:border-[#1E7EB8]/70"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <p className="text-[11px] text-[#4A6B82]">
                              You will need Google Authenticator to verify your identity.
                            </p>
                          </div>
                        )}

                        {(step === STEPS.changePassword || step === STEPS.forgotReset) && (
                          <>
                            {step === STEPS.forgotReset && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#4A6B82] uppercase tracking-wider">
                                  Authenticator Code
                                </label>
                                <input
                                  type="text"
                                  required
                                  maxLength={6}
                                  placeholder="123456"
                                  className="w-full h-11 rounded-xl bg-white/90 border border-[#1E7EB8]/25 text-[#0C2F4A] placeholder:text-[#4A6B82]/45 px-3 text-sm outline-none focus:border-[#1E7EB8]/70"
                                  value={otp}
                                  onChange={(e) => setOtp(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                                  autoFocus
                                />
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-[#4A6B82] uppercase tracking-wider">
                                New Password
                              </label>
                              <div className="relative">
                                <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E7EB8]/70" />
                                <input
                                  type="password"
                                  required
                                  minLength={8}
                                  placeholder="At least 8 characters"
                                  className="w-full h-11 rounded-xl bg-white/90 border border-[#1E7EB8]/25 text-[#0C2F4A] placeholder:text-[#4A6B82]/45 pl-10 pr-3 text-sm outline-none focus:border-[#1E7EB8]/70"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-[#4A6B82] uppercase tracking-wider">
                                Confirm Password
                              </label>
                              <div className="relative">
                                <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E7EB8]/70" />
                                <input
                                  type="password"
                                  required
                                  minLength={8}
                                  placeholder="Repeat new password"
                                  className="w-full h-11 rounded-xl bg-white/90 border border-[#1E7EB8]/25 text-[#0C2F4A] placeholder:text-[#4A6B82]/45 pl-10 pr-3 text-sm outline-none focus:border-[#1E7EB8]/70"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {step === STEPS.setup2fa && (
                          <>
                            {!twoFaSetup ? (
                              <div className="rounded-lg border border-[#1E7EB8]/20 bg-white/70 p-4 text-xs text-[#3A5A72]">
                                <FiShield className="inline mr-1 text-[#1E7EB8]" />
                                Two-factor authentication is required. Click below to generate your QR code and setup key.
                              </div>
                            ) : (
                              <div className="rounded-lg border border-[#1E7EB8]/20 bg-white/70 p-3 space-y-3">
                                <TwoFaSetupDisplay
                                  key={twoFaSetup.setupToken}
                                  secret={twoFaSetup.secret}
                                  otpauthUrl={twoFaSetup.otpauthUrl}
                                  secretHint={twoFaSetup.secretHint}
                                  manualEntryKey={twoFaSetup.manualEntryKey}
                                  accountLabel={twoFaSetup.accountLabel}
                                >
                                  <div className="flex gap-2">
                                    <input
                                      value={otp}
                                      onChange={(e) => {
                                        setOtp(e.target.value.replace(/\D+/g, "").slice(0, 6));
                                        setOtpCheckOk(false);
                                      }}
                                      className="w-full h-11 rounded-xl bg-white/90 border border-[#1E7EB8]/25 text-[#0C2F4A] placeholder:text-[#4A6B82]/45 px-3 text-sm outline-none focus:border-[#1E7EB8]/70 flex-1"
                                      placeholder="6-digit code"
                                      maxLength={6}
                                      required
                                    />
                                    <button
                                      type="button"
                                      className="h-11 px-3 text-xs shrink-0 rounded-xl border border-[#1E7EB8]/25 text-[#0C2F4A]/80 hover:bg-white"
                                      disabled={busy || otp.length !== 6}
                                      onClick={test2faCode}
                                    >
                                      Test code
                                    </button>
                                  </div>
                                  {otpCheckOk ? (
                                    <p className="text-[11px] text-emerald-700 font-medium">
                                      Code matches — you can enable 2FA now.
                                    </p>
                                  ) : null}
                                </TwoFaSetupDisplay>
                                <button
                                  type="button"
                                  className="w-full h-9 text-xs rounded-xl border border-[#1E7EB8]/25 text-[#4A6B82] hover:bg-white"
                                  disabled={busy}
                                  onClick={refresh2faSetup}
                                >
                                  Regenerate setup key (after deleting old Google Authenticator entries)
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {step === STEPS.verify2fa && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[#4A6B82] uppercase tracking-wider">
                              Authenticator Code
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={6}
                              placeholder="123456"
                              className="w-full h-11 rounded-xl bg-white/90 border border-[#1E7EB8]/25 text-[#0C2F4A] placeholder:text-[#4A6B82]/45 px-3 text-sm outline-none focus:border-[#1E7EB8]/70"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                              autoFocus
                            />
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full h-11 rounded-xl bg-[#1E7EB8] hover:bg-[#1869A0] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                          disabled={isLoading}
                        >
                          {isLoading ? <FiRefreshCw className="animate-spin" /> : <FiArrowRight />}
                          {isLoading
                            ? "Processing..."
                            : step === STEPS.credentials
                              ? "Continue"
                              : step === STEPS.forgotStart
                                ? "Continue"
                                : step === STEPS.forgotReset
                                  ? "Reset Password"
                                  : step === STEPS.changePassword
                                    ? "Update Password"
                                    : step === STEPS.setup2fa && !twoFaSetup
                                      ? "Generate 2FA Key"
                                      : step === STEPS.setup2fa
                                        ? "Enable 2FA & Sign In"
                                        : "Verify & Sign In"}
                        </button>

                        {(step === STEPS.forgotStart || step === STEPS.forgotReset) && (
                          <button
                            type="button"
                            onClick={resetToLogin}
                            className="w-full h-10 text-sm text-[#4A6B82] hover:text-[#0C2F4A]"
                          >
                            Back to Sign In
                          </button>
                        )}

                        {step === STEPS.credentials && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowEmergency(false);
                              resetToLogin();
                            }}
                            className="w-full text-[11px] text-[#4A6B82]/70 hover:text-[#0C2F4A]"
                          >
                            Hide emergency access
                          </button>
                        )}
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <button
              type="button"
              onClick={onFooterClick}
              className="text-[10px] text-[#4A6B82]/55 hover:text-[#4A6B82] font-medium uppercase tracking-[0.2em] select-none"
            >
              © 2026 OceanBazar Enterprise · Secure Protocol
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
