import { useCallback, useState } from "react";
import ReauthModal from "../components/ReauthModal";
import { getReauthToken } from "../lib/reauth";

export default function useStepUpReauth() {
  const [open, setOpen] = useState(false);
  const [resolver, setResolver] = useState(null);

  const requestToken = useCallback(() => {
    const existing = getReauthToken();
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      setResolver(() => ({ resolve, reject }));
      setOpen(true);
    });
  }, []);

  const onClose = () => {
    if (resolver?.reject) resolver.reject(new Error("Re-authentication cancelled"));
    setResolver(null);
    setOpen(false);
  };

  const onSuccess = (token) => {
    resolver?.resolve?.(token || getReauthToken());
    setResolver(null);
    setOpen(false);
  };

  return {
    requestToken,
    modal: <ReauthModal open={open} onClose={onClose} onSuccess={onSuccess} />,
  };
}

