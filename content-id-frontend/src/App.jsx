import { useCallback, useEffect, useState } from "react";
import { contentIdApi } from "./lib/api";
import { clearSession, getToken, getUser, setSession } from "./lib/auth";
import LoginScreen from "./pages/LoginScreen";
import GeneratorPage from "./pages/GeneratorPage";

export default function App() {
  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(getUser());
  const [exchanging, setExchanging] = useState(false);
  const [booting, setBooting] = useState(true);

  const handleLogout = useCallback(() => {
    clearSession();
    setToken("");
    setUser(null);
  }, []);

  useEffect(() => {
    function onAuthCleared() {
      handleLogout();
    }
    window.addEventListener("content-id-auth-cleared", onAuthCleared);
    return () => window.removeEventListener("content-id-auth-cleared", onAuthCleared);
  }, [handleLogout]);

  useEffect(() => {
    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const ssoCode = params.get("sso_code");
      if (ssoCode) {
        setExchanging(true);
        window.history.replaceState({}, "", window.location.pathname);
        try {
          const res = await contentIdApi.ssoExchange(ssoCode);
          setSession(res.token, res.user);
          setToken(res.token);
          setUser(res.user);
        } catch {
          window.location.search = "?sso_error=handoff_failed";
        } finally {
          setExchanging(false);
        }
      } else if (token) {
        try {
          const res = await contentIdApi.me();
          setUser(res.user);
        } catch {
          handleLogout();
        }
      }
      setBooting(false);
    }
    bootstrap();
  }, []);

  if (booting || exchanging) {
    return <LoginScreen exchanging />;
  }

  if (!token || !user) {
    return <LoginScreen onLogin={() => {}} exchanging={false} />;
  }

  return <GeneratorPage user={user} onLogout={handleLogout} />;
}
