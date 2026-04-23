import { useEffect, useRef } from "react";
import { createStompSockJsClient } from "@/lib/stompClient";

/**
 * STOMP: {@code /user/queue/notifications} plus optional {@code /topic/catalog/changes}.
 * URL: {@code http(s)://<BACKEND>/ws} with JWT in CONNECT headers.
 */
export function useCustomerNotificationSocket(enabled, onNotification, onCatalogChange) {
  const handlerRef = useRef(onNotification);
  const catalogRef = useRef(onCatalogChange);
  useEffect(() => {
    handlerRef.current = onNotification;
  }, [onNotification]);
  useEffect(() => {
    catalogRef.current = onCatalogChange;
  }, [onCatalogChange]);

  useEffect(() => {
    if (!enabled) return undefined;
    const token = localStorage.getItem("oceanBazarToken");
    if (!token) return undefined;

    const { client, deactivate } = createStompSockJsClient({
      token,
      onConnect: (c) => {
        c.subscribe("/user/queue/notifications", (message) => {
          try {
            const data = JSON.parse(message.body);
            handlerRef.current?.(data);
          } catch {
            /* ignore malformed frame */
          }
        });
        c.subscribe("/topic/catalog/changes", (message) => {
          try {
            const data = JSON.parse(message.body);
            catalogRef.current?.(data);
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
