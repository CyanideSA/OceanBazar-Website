'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {
  MessageCircle, X, Minus, Send, Paperclip, Bot,
  CheckCheck, AlertCircle, RefreshCw
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { getAccessToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'bot' | 'agent';
  timestamp: number;
  isRead: boolean;
  attachments?: string[];
}

interface ChatSession {
  id: string | null;
  userId: string;
  messages: ChatMessage[];
  isActive: boolean;
  agentEngaged: boolean;
  lastMessageAt: string | null;
}

type WidgetState = 'closed' | 'open' | 'minimised';

export default function ChatWidget() {
  const { user, isAuthenticated } = useAuthStore();
  const [widgetState, setWidgetState] = useState<WidgetState>('closed');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [unread, setUnread] = useState(0);

  const stompRef = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── Scroll to bottom ── */
  useEffect(() => {
    if (widgetState === 'open') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, widgetState]);

  /* ── Clear unread when opened ── */
  useEffect(() => {
    if (widgetState === 'open') setUnread(0);
  }, [widgetState]);

  /* ── Load session on open ── */
  const loadSession = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/session');
      setSession(data as ChatSession);
    } catch {
      /* unauthenticated or error, silently ignore */
    }
  }, []);

  useEffect(() => {
    if (widgetState === 'open' && isAuthenticated) {
      loadSession();
    }
  }, [widgetState, isAuthenticated, loadSession]);

  /* ── STOMP connection ── */
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${WS_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 10000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
    });

    client.onConnect = () => {
      setWsConnected(true);
      client.subscribe('/user/queue/chat', (frame) => {
        try {
          const data = JSON.parse(frame.body) as ChatSession;
          setSession(data);
          if (widgetState !== 'open') {
            setUnread((n) => n + 1);
          }
        } catch { /* ignore */ }
      });
    };

    client.onDisconnect = () => setWsConnected(false);
    client.onStompError = () => setWsConnected(false);
    client.activate();
    stompRef.current = client;

    return () => {
      client.deactivate();
      stompRef.current = null;
      setWsConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /* ── Send message ── */
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text && pendingFiles.length === 0) return;
    if (sending) return;
    setSending(true);

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      message: text,
      sender: 'user',
      timestamp: Date.now(),
      isRead: false,
      attachments: pendingFiles,
    };

    setSession((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, optimistic] }
        : null
    );
    setInputText('');
    setPendingFiles([]);

    try {
      const { data } = await api.post('/chat/message', { message: text || '📎 Attachment', sender: 'user' });
      setSession(data.session as ChatSession);
    } catch {
      /* revert optimistic if needed */
    } finally {
      setSending(false);
    }
  }, [inputText, pendingFiles, sending]);

  /* ── File upload ── */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/tickets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPendingFiles((prev) => [...prev, data.url]);
    } catch { /* ignore */ } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── Close session ── */
  const closeSession = async () => {
    try { await api.post('/chat/session/close'); } catch { /* ignore */ }
    setSession(null);
    setWidgetState('closed');
  };

  /* ── Keyboard send ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isAuthenticated) return null;

  // Launcher button, hidden on mobile
  const Launcher = (
    <button
      type="button"
      onClick={() => setWidgetState('open')}
      className={cn(
        'fixed bottom-6 right-6 z-50 hidden h-14 w-14 items-center justify-center rounded-full bg-primary shadow-xl ring-4 ring-primary/20 transition-transform hover:scale-105 active:scale-95',
        'md:flex'
      )}
      aria-label="Open chat"
    >
      <MessageCircle className="h-6 w-6 text-primary-foreground" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );

  if (widgetState === 'closed') return Launcher;

  // Make chat UI full-screen on mobile
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] sm:hidden',
          widgetState !== 'open' ? 'hidden' : ''
        )}
        onClick={() => setWidgetState('minimised')}
      />
      <div
        className={cn(
          'fixed bottom-6 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all sm:right-6 sm:w-96',
          widgetState === 'minimised' ? 'h-14' : 'h-[500px] max-h-[80vh] sm:h-auto sm:max-h-full',
          'sm:inset-y-auto sm:bottom-auto'
        )}
      >
        {/* Header */}
        <div className="flex h-14 flex-none items-center justify-between gap-2 border-b border-border bg-primary px-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-4 w-4 text-primary-foreground" />
              <span className={cn(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary',
                wsConnected ? 'bg-emerald-400' : 'bg-amber-400'
              )} />
            </span>
            <div>
              <p className="text-sm font-semibold text-primary-foreground">OceanBazar Support</p>
              <p className="text-[10px] font-medium text-primary-foreground/70">
                {wsConnected ? 'Online' : 'Connecting…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWidgetState(widgetState === 'minimised' ? 'open' : 'minimised')}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground/80 hover:bg-white/10"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeSession}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground/80 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {widgetState === 'open' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto scroll-smooth px-3 py-4 space-y-3">
              {session?.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">How can we help you today?</p>
                </div>
              )}

              {session?.messages.map((msg) => {
                const isUser = msg.sender === 'user';
                const isBot  = msg.sender === 'bot';
                return (
                  <div key={msg.id} className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && (
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                        {isBot ? <Bot className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                      </span>
                    )}
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                      isUser
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-muted text-foreground'
                    )}>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {msg.attachments.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className={cn(
                                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium underline underline-offset-2',
                                isUser ? 'text-primary-foreground/80' : 'text-primary'
                              )}>
                              <Paperclip className="h-3 w-3" />Attachment
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words leading-snug">{msg.message}</p>
                      <div className={cn(
                        'mt-1 flex items-center gap-1 text-[10px]',
                        isUser ? 'justify-end text-primary-foreground/60' : 'text-muted-foreground'
                      )}>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isUser && <CheckCheck className="h-3 w-3" />}
                      </div>
                    </div>
                    {isUser && (
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                        {user?.name?.[0]?.toUpperCase() ?? 'U'}
                      </span>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Pending file chips */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
                {pendingFiles.map((url, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Paperclip className="h-3 w-3" />
                    File {i + 1}
                    <button type="button" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex flex-none items-end gap-2 border-t border-border bg-background px-3 py-3">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
              >
                {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile}
                accept="image/*,.pdf,.doc,.docx,.txt" />
              <textarea
                ref={inputRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                style={{ maxHeight: 80, overflowY: 'auto' }}
              />
              <button
                type="button"
                disabled={sending || (!inputText.trim() && pendingFiles.length === 0)}
                onClick={sendMessage}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
