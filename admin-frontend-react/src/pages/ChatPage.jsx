import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiSend, FiUser, FiSearch, FiMoreVertical, FiCheck, FiPaperclip, FiSmile, FiXCircle, FiMessageSquare } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import useAdminRealtimeSocket from "../hooks/useAdminRealtimeSocket";

export default function ChatPage({ liveTick, wsConnected, chatInboundRef }) {
  const toast = useToast();
  const [conversations, setConversations] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await adminApi.conversations();
      setConversations(Array.isArray(res) ? res : res?.sessions || res?.conversations || []);
    } catch (err) {
      toast.error("Failed to fetch conversations");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMessages = useCallback(async (sessionId) => {
    try {
      const res = await adminApi.conversationDetail(sessionId);
      setMessages(res?.messages || []);
      setActiveSession(res?.session || null);
    } catch (err) {
      toast.error("Failed to fetch messages");
    }
  }, [toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, liveTick]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!wsConnected) {
      toast.error('WebSocket disconnected, real-time updates may be delayed.');
    }
  }, [wsConnected, toast]);

  // Handle inbound messages via ref from parent App/Socket context
  useEffect(() => {
    if (!chatInboundRef) return;
    const originalHandler = chatInboundRef.current;
    chatInboundRef.current = (msg) => {
      if (activeSession && msg.sessionId === activeSession.sessionId) {
        setMessages((prev) => [...prev, msg]);
      } else {
        fetchConversations(); // Update list for unread indicator
      }
      if (originalHandler) originalHandler(msg);
    };
    return () => {
      chatInboundRef.current = originalHandler;
    };
  }, [activeSession, chatInboundRef, fetchConversations]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !activeSession || sending) return;

    setSending(true);
    try {
      const res = await adminApi.replyConversation(activeSession.sessionId, {
        content: replyText.trim()
      });
      setMessages((prev) => [...prev, res]);
      setReplyText("");
    } catch (err) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    try {
      await adminApi.closeConversation(activeSession.sessionId);
      toast.success("Conversation closed");
      setActiveSession(null);
      setMessages([]);
      fetchConversations();
    } catch (err) {
      toast.error("Failed to close conversation");
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sessionId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-var(--crm-topbar-height)-3rem)] gap-4 overflow-hidden">
      {/* Sidebar: Conversation List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-80 flex flex-col crm-card p-0 overflow-hidden"
      >
        <div className="p-4 border-b border-crm-border">
          <h3 className="font-bold text-crm-text-bright mb-3">Conversations</h3>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              className="crm-input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin h-6 w-6 border-b-2 border-crm-primary mx-auto"></div></div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-crm-text-dim text-sm">No conversations found</div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.sessionId}
                onClick={() => fetchMessages(conv.sessionId)}
                className={`w-full text-left p-4 border-b border-crm-border transition-colors hover:bg-crm-bg-hover flex gap-3 ${
                  activeSession?.sessionId === conv.sessionId ? "bg-crm-bg-hover border-l-4 border-l-crm-primary" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-crm-bg-card flex items-center justify-center text-crm-primary font-bold shrink-0">
                  {conv.customerName?.charAt(0) || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-bold text-crm-text-bright truncate">{conv.customerName || "User"}</p>
                    <span className="text-[10px] text-crm-text-dim">{conv.lastMessageTime ? format(new Date(conv.lastMessageTime), "HH:mm") : ""}</span>
                  </div>
                  <p className="text-xs text-crm-text-dim truncate">{conv.lastMessage || "No messages yet"}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <div className="w-2 h-2 rounded-full bg-crm-primary mt-2"></div>
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col crm-card p-0 overflow-hidden relative">
        {!activeSession ? (
          <div className="flex-1 flex flex-col items-center justify-center text-crm-text-dim p-8 text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-full bg-crm-bg-hover flex items-center justify-center mb-4 text-crm-text-muted"
            >
              <FiMessageSquare size={40} />
            </motion.div>
            <h3 className="text-lg font-bold text-crm-text-bright mb-2">Your Inbox</h3>
            <p className="max-w-xs text-sm">Select a conversation from the list to start messaging with your customers in real-time.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-crm-border flex items-center justify-between bg-crm-bg-alt/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-crm-primary flex items-center justify-center text-white font-bold">
                  {activeSession.customerName?.charAt(0) || "U"}
                </div>
                <div>
                  <h4 className="font-bold text-crm-text-bright text-sm">{activeSession.customerName || "Customer"}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">
                    <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-crm-success" : "bg-crm-danger"}`}></span>
                    {wsConnected ? "Online" : "Offline"} • {activeSession.sessionId.slice(0, 8)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCloseSession}
                  className="crm-btn py-1.5 px-3 text-xs border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim"
                >
                  <FiXCircle /> Close Chat
                </button>
                <button className="p-2 text-crm-text-dim hover:text-crm-text-bright"><FiMoreVertical /></button>
              </div>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-crm-bg/30">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isMe = msg.senderType === "ADMIN";
                  const showDate = idx === 0 || format(new Date(messages[idx-1].createdAt), "yyyy-MM-dd") !== format(new Date(msg.createdAt), "yyyy-MM-dd");

                  return (
                    <React.Fragment key={msg.id || idx}>
                      {showDate && (
                        <div className="flex justify-center my-6">
                          <span className="px-3 py-1 rounded-full bg-crm-bg-hover text-[10px] font-bold text-crm-text-muted uppercase tracking-widest">
                            {format(new Date(msg.createdAt), "MMMM dd, yyyy")}
                          </span>
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[70%] group ${isMe ? "order-1" : "order-2"}`}>
                          <div className={`p-3 rounded-2xl text-sm ${
                            isMe 
                              ? "bg-crm-primary text-white rounded-tr-none shadow-lg shadow-crm-primary/10" 
                              : "bg-crm-bg-card text-crm-text-bright rounded-tl-none border border-crm-border"
                          }`}>
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-2 mt-1 px-1 text-[10px] text-crm-text-dim font-medium ${isMe ? "justify-end" : "justify-start"}`}>
                            {format(new Date(msg.createdAt), "HH:mm")}
                            {isMe && (
                              <span className="inline-flex -space-x-1.5 text-crm-primary"><FiCheck size={10} /><FiCheck size={10} /></span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-crm-border bg-crm-bg-alt/50">
              <form onSubmit={handleSend} className="flex items-center gap-3">
                <button type="button" className="p-2 text-crm-text-dim hover:text-crm-primary transition-colors"><FiPaperclip size={20} /></button>
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="Type a message..." 
                    className="crm-input pr-10 py-2.5 rounded-xl bg-crm-bg"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={sending}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-text-dim hover:text-crm-warning transition-colors">
                    <FiSmile size={18} />
                  </button>
                </div>
                <button 
                  type="submit" 
                  disabled={!replyText.trim() || sending}
                  className={`p-3 rounded-xl transition-all shadow-lg ${
                    replyText.trim() ? "bg-crm-primary text-white scale-105" : "bg-crm-bg-hover text-crm-text-dim"
                  }`}
                >
                  <FiSend size={20} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
