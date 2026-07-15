import React, { useState, useEffect } from "react";
import { FiLock, FiUser, FiArrowRight, FiRefreshCw, FiShield, FiKey, FiCheck } from "react-icons/fi";
import { motion } from "framer-motion";
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

  useEffect(() => {
    sanitizeAdminApiStorage();
    clearSession();
    adminApi.ssoStatus().then(setSsoStatus).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get("sso_error");
    if (ssoError) {
      setError(`SSO failed: ${decodeURIComponent(ssoError)}`);
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
    [STEPS.credentials]: { heading: "Sign In", sub: "Enter your credentials to access the backoffice" },
    [STEPS.changePassword]: { heading: "Set Your Password", sub: "You must choose a new password before continuing" },
    [STEPS.setup2fa]: { heading: "Set Up 2FA", sub: "Scan the QR code or enter the setup key in Google Authenticator, then enter the 6-digit code" },
    [STEPS.verify2fa]: {
      heading: "Verify Authenticator",
      sub: "Enter the 6-digit code currently shown in Google Authenticator (not the previous one — wait for it to refresh if needed)",
    },
    [STEPS.forgotStart]: { heading: "Reset Password", sub: "Enter your username or email to begin password recovery" },
    [STEPS.forgotReset]: { heading: "Verify & Set New Password", sub: "Enter your authenticator code and choose a new password" },
    [STEPS.forgotSuccess]: { heading: "Password Updated", sub: "Your password has been reset. Sign in with your new password." },
  };

  const { heading, sub } = titles[step];

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9a9989" },
      body: JSON.stringify({
        sessionId: "9a9989",
        runId: "crm-visibility-check",
        hypothesisId: "H1",
        location: "src/pages/LoginPage.jsx:mounted",
        message: "Login page mounted with latest enterprise build marker",
        data: { marker: "enterprise-ui-build-v1", step },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [step]);

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-crm-bg p-6 pt-10 sm:pt-6 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-crm-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-crm-purple/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] z-10"
      >
        <div className="text-center mb-8">
          <img src="/ob-brand-logo.png?v=5" alt="OceanBazar" className="h-24 w-auto mx-auto mb-2 object-contain drop-shadow-xl" />
          <p className="text-crm-text-dim mt-2 font-medium">Administrative Command Center</p>
        </div>

        <div className="crm-card bg-crm-bg-alt/80 backdrop-blur-xl p-8 border-crm-border shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-crm-text-bright">{heading}</h2>
            <p className="text-xs text-crm-text-dim">{sub}</p>
          </div>

          {step === STEPS.forgotSuccess ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-crm-success/30 bg-crm-success/10 p-4">
                <FiCheck className="text-crm-success flex-shrink-0" size={20} />
                <p className="text-sm text-crm-success font-medium">Password reset successful</p>
              </div>
              <button type="button" onClick={resetToLogin} className="crm-btn crm-btn-primary w-full h-11">
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {step === STEPS.credentials && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Username</label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                      <input
                        type="text"
                        required
                        placeholder="admin_id"
                        className="crm-input pl-10 h-11"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Password</label>
                      <button
                        type="button"
                        onClick={() => { setStep(STEPS.forgotStart); setError(""); setPassword(""); }}
                        className="text-xs text-crm-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        className="crm-input pl-10 h-11"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  {(ssoStatus.microsoft || ssoStatus.google) && (
                    <div className="space-y-3 pt-2">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-crm-border" /></div>
                        <div className="relative flex justify-center text-xs"><span className="bg-crm-bg-alt px-2 text-crm-text-dim">or sign in with</span></div>
                      </div>
                      {ssoStatus.microsoft && (
                        <button
                          type="button"
                          className="crm-btn w-full h-11 text-sm font-semibold border border-crm-border bg-[#2f2f2f] hover:bg-[#3a3a3a] text-white flex items-center justify-center gap-2 rounded-xl"
                          onClick={() => { window.location.href = `${resolveAdminApiBase()}/api/admin/auth/sso/microsoft/start`; }}
                        >
                          <span className="text-[#00a4ef] font-bold">M</span>
                          Sign in with Microsoft 365
                        </button>
                      )}
                      {ssoStatus.google && (
                        <button
                          type="button"
                          className="crm-btn w-full h-11 text-sm font-semibold border border-crm-border bg-crm-bg-alt hover:bg-crm-bg flex items-center justify-center gap-2 rounded-xl"
                          onClick={() => { window.location.href = `${resolveAdminApiBase()}/api/admin/auth/sso/google/start`; }}
                        >
                          Sign in with Google Workspace
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {step === STEPS.forgotStart && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Username or Email</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                    <input
                      type="text"
                      required
                      placeholder="admin_id or email"
                      className="crm-input pl-10 h-11"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-crm-text-muted">
                    You will need your Google Authenticator app to verify your identity.
                  </p>
                </div>
              )}

              {(step === STEPS.changePassword || step === STEPS.forgotReset) && (
                <>
                  {step === STEPS.forgotReset && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Authenticator Code</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="123456"
                        className="crm-input h-11"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">New Password</label>
                    <div className="relative">
                      <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="At least 8 characters"
                        className="crm-input pl-10 h-11"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Confirm Password</label>
                    <div className="relative">
                      <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="Repeat new password"
                        className="crm-input pl-10 h-11"
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
                    <div className="rounded-lg border border-crm-border bg-crm-bg p-4 text-xs text-crm-text-dim">
                      <FiShield className="inline mr-1 text-crm-primary" />
                      Two-factor authentication is required for all CRM accounts. Click below to generate your QR code and setup key.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-crm-border bg-crm-bg p-3 space-y-3">
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
                            className="crm-input h-11 flex-1"
                            placeholder="6-digit code"
                            maxLength={6}
                            required
                          />
                          <button
                            type="button"
                            className="crm-btn crm-btn-secondary h-11 px-3 text-xs shrink-0"
                            disabled={busy || otp.length !== 6}
                            onClick={test2faCode}
                          >
                            Test code
                          </button>
                        </div>
                        {otpCheckOk ? (
                          <p className="text-[11px] text-emerald-400 font-medium">
                            Code matches — you can enable 2FA now.
                          </p>
                        ) : null}
                      </TwoFaSetupDisplay>
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary w-full h-9 text-xs"
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
                  <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Authenticator Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    className="crm-input h-11"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                    autoFocus
                  />
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs font-bold text-crm-danger bg-crm-danger-dim p-3 rounded-lg border border-crm-danger/20"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                className="crm-btn crm-btn-primary w-full h-11 text-sm font-bold shadow-lg shadow-crm-primary/20"
                disabled={isLoading}
              >
                {isLoading ? <FiRefreshCw className="animate-spin" /> : <FiArrowRight />}
                {isLoading ? "Processing..." :
                  step === STEPS.credentials ? "Continue" :
                  step === STEPS.forgotStart ? "Continue" :
                  step === STEPS.forgotReset ? "Reset Password" :
                  step === STEPS.changePassword ? "Update Password" :
                  step === STEPS.setup2fa && !twoFaSetup ? "Generate 2FA Key" :
                  step === STEPS.setup2fa ? "Enable 2FA & Sign In" :
                  "Verify & Sign In"}
              </button>

              {(step === STEPS.forgotStart || step === STEPS.forgotReset) && (
                <button type="button" onClick={resetToLogin} className="crm-btn w-full h-10 text-sm">
                  Back to Sign In
                </button>
              )}
            </form>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-crm-text-muted font-bold uppercase tracking-[0.2em]">
            &copy; 2026 OceanBazar Enterprise &bull; Secure Protocol
          </p>
        </div>
      </motion.div>
    </div>
  );
}
