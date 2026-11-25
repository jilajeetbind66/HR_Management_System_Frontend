import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  X,
  Send,
  Maximize2,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function FloatingChatWidget({ onNavigateToFullChat }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // 1. Fetch unread count periodically
  const fetchUnread = useCallback(async () => {
    try {
      const res = await api.getChatUnreadCount();
      if (res?.data) {
        setUnreadCount(Number(res.data.unread_count) || 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 9000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // 2. Fetch conversations and load the Super Admin thread
  const loadConversation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getChatThreads();
      const list = res?.data || [];
      if (list.length > 0) {
        const primary = list[0]; // For employees, this is the Super Admin thread
        setThread(primary);
        if (primary.thread_id) {
          const msgRes = await api.getChatMessages(primary.thread_id);
          const msgs = msgRes?.data || [];
          setMessages(msgs);
          if (msgs.length > 0) {
            lastMessageIdRef.current = msgs[msgs.length - 1].id;
          }
          setUnreadCount(0);
          setTimeout(() => scrollToBottom(false), 80);
        }
      }
    } catch (err) {
      console.error('Failed to load floating chat conversation:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // When widget is opened
  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && !thread) {
      loadConversation();
    } else if (nextState && thread?.thread_id) {
      // Mark as read and fetch latest
      api.markChatAsRead(thread.thread_id).catch(() => {});
      setUnreadCount(0);
      setTimeout(() => scrollToBottom(false), 80);
    }
  };

  // 3. Polling when widget is open
  useEffect(() => {
    if (!isOpen || !thread?.thread_id) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const afterId = lastMessageIdRef.current;
        const res = await api.getChatMessages(thread.thread_id, afterId);
        const incoming = res?.data || [];
        if (incoming.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMsgs = incoming.filter((m) => !existingIds.has(m.id));
            if (newMsgs.length > 0) {
              lastMessageIdRef.current = newMsgs[newMsgs.length - 1].id;
              setTimeout(() => scrollToBottom(true), 50);
              return [...prev, ...newMsgs];
            }
            return prev;
          });
        }
      } catch {
        // silent
      }
    }, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, thread?.thread_id]);

  // 4. Send Message
  const handleSend = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !thread) return;

    setInputText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: currentUser.id,
      receiver_id: thread.user_id,
      message: text,
      created_at: new Date().toISOString(),
      is_read: false,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const res = await api.sendChatMessage({
        message: text,
        receiver_id: thread.user_id,
        thread_id: thread.thread_id || null,
      });

      const saved = res?.data;
      const threadId = res?.thread_id;

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...saved, isPending: false } : m))
      );

      if (saved?.id) {
        lastMessageIdRef.current = saved.id;
      }
      if (!thread.thread_id && threadId) {
        setThread((prev) => ({ ...prev, thread_id: threadId }));
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleExpandToFull = () => {
    setIsOpen(false);
    if (typeof onNavigateToFullChat === 'function') {
      onNavigateToFullChat('chat');
    } else {
      navigate('/chat');
    }
  };

  // If Super Admin, they have the full Live Chat view in sidebar; but this widget is also useful for quick tests or employees
  return (
    <aside aria-label="Live Support Chat" className="fixed bottom-4 right-4 z-40 print:hidden">
      {/* Floating launcher trigger */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleToggle}
          className="group relative flex h-13 w-13 items-center justify-center rounded-full bg-teal-600 text-white shadow-xl hover:bg-teal-700 hover:scale-105 active:scale-95 transition focus:outline-none focus:ring-4 focus:ring-teal-300"
          title="Chat with Super Admin"
          aria-label="Open Live Chat"
        >
          <MessageSquare className="h-6 w-6 transition group-hover:rotate-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-md ring-2 ring-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Floating Chat Popup Card */}
      {isOpen && (
        <div className="flex flex-col w-[360px] sm:w-[400px] h-[520px] max-h-[85vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-800 to-slate-900 text-white shadow-sm shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 font-bold border border-teal-400/40 text-xs shrink-0">
                  {thread?.name ? thread.name.slice(0, 2).toUpperCase() : 'SA'}
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold truncate">
                    {thread?.name || 'Super Admin Live Desk'}
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-teal-400/20 px-1.5 py-0.2 text-[9px] font-medium text-teal-200">
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-teal-200/80 truncate">
                  {isSuperAdmin ? 'Live Chat Desk' : 'Direct channel with Super Admin'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExpandToFull}
                className="rounded-lg p-1.5 text-teal-200 hover:text-white hover:bg-white/10 transition"
                title="Expand to Full Screen"
                aria-label="Expand chat"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-teal-200 hover:text-white hover:bg-white/10 transition"
                title="Minimize Chat"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Canvas */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 bg-slate-50/70">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="h-10 w-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mb-2">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">Need immediate assistance?</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">
                  Send a message directly to the Super Admin. You will receive real-time replies here.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_id === currentUser.id;
                const timeStr = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-sm ${
                        isMine
                          ? 'bg-teal-600 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      } ${msg.isPending ? 'opacity-70' : ''}`}
                    >
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>

                    <div className="flex items-center gap-1 mt-0.5 px-1 text-[9px] text-slate-400">
                      <span>{timeStr}</span>
                      {isMine && (
                        <span>
                          {msg.isPending ? (
                            <Clock className="h-2.5 w-2.5 text-slate-400" />
                          ) : msg.is_read ? (
                            <CheckCheck className="h-2.5 w-2.5 text-teal-600" />
                          ) : (
                            <Check className="h-2.5 w-2.5 text-slate-400" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 p-2.5 bg-white border-t border-slate-200 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type message to Super Admin..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 transition"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              title="Send Message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
