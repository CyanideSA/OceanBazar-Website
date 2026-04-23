import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Minus, Send } from "lucide-react";
import { Button } from "./ui/button";
import axios from "axios";
import { BACKEND_URL } from "../api/service";
import { useCustomerChatSocket } from "../hooks/useCustomerChatSocket";
import { getApiErrorMessage } from "@/utils/apiError";
import { logger } from "@/utils/logger";
import { useToast } from "@/hooks/use-toast";

const LS_OPEN = "oceanbazar_chat_open";
const LS_MIN = "oceanbazar_chat_minimized";

function normalizeMessages(raw) {
  if (!raw || !Array.isArray(raw.messages)) return [];
  return raw.messages;
}

function chatUserInitials(name) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

const LiveChat = ({ user = null }) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem(LS_OPEN) === "1");
  const [isMinimized, setIsMinimized] = useState(() => localStorage.getItem(LS_MIN) === "1");
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const baseRef = useRef(BACKEND_URL.replace(/\/$/, ""));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const applySession = useCallback((data) => {
    setMessages(normalizeMessages(data));
  }, []);

  const loadSessionOnce = useCallback(async (opts = { showSpinner: true }) => {
    const token = localStorage.getItem("oceanBazarToken");
    if (!token) return;
    const base = baseRef.current;
    if (opts.showSpinner) setLoading(true);
    try {
      const response = await axios.get(`${base}/api/chat/session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      applySession(response.data);
    } catch (error) {
      logger.error("Error loading chat session:", error);
      toast({
        title: "Chat unavailable",
        description: getApiErrorMessage(error, "Could not load your chat session."),
        variant: "destructive",
      });
    } finally {
      if (opts.showSpinner) setLoading(false);
    }
  }, [applySession, toast]);

  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("oceanBazarToken");
  useCustomerChatSocket(Boolean(isOpen && hasToken), applySession);

  useEffect(() => {
    baseRef.current = BACKEND_URL.replace(/\/$/, "");
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem("oceanBazarToken");
    if (!token) {
      setMessages([]);
      return;
    }
    loadSessionOnce({ showSpinner: true });
  }, [isOpen, loadSessionOnce]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    const token = localStorage.getItem("oceanBazarToken");
    const base = baseRef.current;
    if (!token) {
      setMessages((prev) => [
        ...prev,
        {
          message: "Please login to start live chat with our support team.",
          sender: "bot",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    const text = inputMessage.trim();
    setInputMessage("");

    const optimistic = {
      id: `tmp-${Date.now()}`,
      message: text,
      sender: "user",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    localStorage.setItem(LS_OPEN, "1");

    try {
      const res = await axios.post(
        `${base}/api/chat/message`,
        { message: text, sender: "user" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.session) {
        applySession(res.data.session);
      }
    } catch (error) {
      logger.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast({
        title: "Message not sent",
        description: getApiErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(LS_OPEN, isOpen ? "1" : "0");
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem(LS_MIN, isMinimized ? "1" : "0");
  }, [isMinimized]);

  const handleClose = async () => {
    const token = localStorage.getItem("oceanBazarToken");
    const base = baseRef.current;
    if (token) {
      try {
        await axios.post(`${base}/api/chat/session/close`, {}, { headers: { Authorization: `Bearer ${token}` } });
      } catch (error) {
        logger.error("Error closing session:", error);
      }
    }
    setIsOpen(false);
    setIsMinimized(false);
    localStorage.setItem(LS_OPEN, "0");
    localStorage.setItem(LS_MIN, "0");
  };

  const handleMinimize = async () => {
    const token = localStorage.getItem("oceanBazarToken");
    const base = baseRef.current;
    if (token) {
      try {
        await axios.post(`${base}/api/chat/session/minimize`, {}, { headers: { Authorization: `Bearer ${token}` } });
      } catch (error) {
        logger.error("Error minimizing session:", error);
      }
    }
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openChat = () => {
    setIsOpen(true);
    setIsMinimized(false);
    localStorage.setItem(LS_OPEN, "1");
    localStorage.setItem(LS_MIN, "0");
  };

  const leftAligned = (sender) => sender === "agent" || sender === "bot";

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={openChat}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#5BA3D0] to-[#7BB8DC] text-white shadow-lg ring-1 ring-black/5 transition-all hover:shadow-xl dark:ring-white/10"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#D8EAF6] bg-white shadow-2xl transition-all duration-200 dark:border-gray-700 dark:bg-gray-900 ${
            isMinimized ? "h-14" : "h-[min(560px,78vh)]"
          }`}
        >
          <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#5BA3D0] to-[#7BB8DC] px-4 py-3 text-white dark:from-[#3d7a9c] dark:to-[#4a8fb5]">
            <div className="flex min-w-0 items-center gap-2.5">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full border-2 border-white/40 object-cover"
                />
              ) : user?.name ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-xs font-bold text-white">
                  {chatUserInitials(user.name)}
                </span>
              ) : (
                <MessageCircle className="h-5 w-5 shrink-0 opacity-95" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold tracking-tight">Messages</span>
                {user?.name ? (
                  <span className="block truncate text-xs font-medium text-white/85">{user.name}</span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={isMinimized ? handleMaximize : handleMinimize}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
                aria-label={isMinimized ? "Expand" : "Minimize"}
              >
                <Minus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#EEF5FA] px-3 py-3 dark:bg-gray-950">
                {loading ? (
                  <div className="py-12 text-center text-sm text-slate-500 dark:text-gray-400">
                    Loading conversation…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mt-10 px-2 text-center text-slate-500 dark:text-gray-400">
                    <MessageCircle className="mx-auto mb-3 h-12 w-12 text-[#5BA3D0] opacity-80 dark:text-[#7BB8DC]" />
                    <p className="font-medium text-slate-600 dark:text-gray-200">Say hello</p>
                    <p className="mt-1 text-sm dark:text-gray-400">We typically reply within a few minutes.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map((msg, index) => (
                      <div
                        key={msg.id || `${index}-${msg.timestamp}`}
                        className={`flex w-full ${leftAligned(msg.sender) ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-[18px] px-3.5 py-2 shadow-sm ${
                            leftAligned(msg.sender)
                              ? msg.sender === "bot"
                                ? "rounded-bl-md border border-[#C5DDF0] bg-white text-slate-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                : "rounded-bl-md border border-white/80 bg-white text-slate-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                              : "rounded-br-md bg-gradient-to-br from-[#5BA3D0] to-[#6AADD6] text-white dark:from-[#4a8fb5] dark:to-[#3d7a9c]"
                          }`}
                        >
                          {leftAligned(msg.sender) && (
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
                              {msg.sender === "bot" ? "OceanBazar" : "Support"}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap text-[15px] leading-snug">{msg.message}</p>
                          <p
                            className={`mt-1 text-[11px] tabular-nums ${
                              leftAligned(msg.sender) ? "text-slate-400 dark:text-gray-500" : "text-white/75"
                            }`}
                          >
                            {msg.timestamp
                              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-[#E4F0F9] bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message…"
                    className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#5BA3D0] transition-shadow placeholder:text-slate-400 focus:border-[#5BA3D0] focus:bg-white focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-[#5BA3D0] dark:focus:bg-gray-800 dark:focus:ring-[#5BA3D0]"
                  />
                  <Button
                    type="button"
                    onClick={sendMessage}
                    disabled={!inputMessage.trim()}
                    className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-r from-[#5BA3D0] to-[#7BB8DC] p-0 text-white shadow-md hover:opacity-95"
                    aria-label="Send"
                  >
                    <Send className="mx-auto h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default LiveChat;
