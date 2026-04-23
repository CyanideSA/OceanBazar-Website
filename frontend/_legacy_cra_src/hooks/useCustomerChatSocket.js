import { useEffect, useRef } from "react";
import { createStompSockJsClient } from "@/lib/stompClient";

/**
 * STOMP: chat snapshot on {@code /user/queue/chat}.
 */
export function useCustomerChatSocket(enabled, onSession) {
  const handlerRef = useRef(onSession);
  useEffect(() => {
    handlerRef.current = onSession;
  }, [onSession]);

  useEffect(() => {
    if (!enabled) return undefined;
    const token = localStorage.getItem("oceanBazarToken");
    if (!token) return undefined;

    const { client, deactivate } = createStompSockJsClient({
      token,
      onConnect: (c) => {
        c.subscribe("/user/queue/chat", (message) => {
          try {
            const data = JSON.parse(message.body);
            handlerRef.current?.(data);
          } catch {
            /* ignore */
          }
        });
      }
    });

    client.activate();
    return () => deactivate();
  }, [enabled]);
}
