import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Send,
  MessageSquare,
  Clock,
  Check,
  CheckCheck,
  User,
  Building,
  RefreshCw,
  ArrowLeft,
  ShieldAlert,
  Sparkles,
  Inbox,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function LiveChatView() {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread'
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInputText, setEditInputText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Mobile navigation state: show contacts or active chat
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  const messagesEndRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const pollingTimerRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // 1. Fetch messages for selected thread
  const fetchMessages = useCallback(async (threadId, isInitial = false) => {
    if (!threadId) return;
    if (isInitial) setLoadingMessages(true);

    try {
      const afterId = isInitial ? null : lastMessageIdRef.current;
      const response = await api.getChatMessages(threadId, afterId);
      const incoming = response?.data || [];
      const lastReadId = Number(response?.last_read_message_id) || 0;
      const deletedIds = new Set((response?.deleted_message_ids || []).map(Number));

      if (isInitial) {
        setMessages(
          incoming.map((m) => ({
            ...m,
            is_read: m.is_read || (lastReadId > 0 && m.id <= lastReadId),
          }))
        );
        if (incoming.length > 0) {
          lastMessageIdRef.current = incoming[incoming.length - 1].id;
        }
        setTimeout(() => scrollToBottom(false), 80);
      } else {
        setMessages((prev) => {
          let updated = prev;

          // Real-time double tick: Mark all own messages as read if id <= lastReadId
          if (lastReadId > 0) {
            updated = updated.map((m) =>
              !m.is_read && m.id <= lastReadId ? { ...m, is_read: true } : m
            );
          }

          // Mark any deleted messages
          if (deletedIds.size > 0) {
            updated = updated.map((m) =>
              deletedIds.has(m.id) && !m.is_deleted
                ? { ...m, is_deleted: true, message: 'This message was deleted' }
                : m
            );
          }

          // Append new incoming messages
          if (incoming.length > 0) {
            const existingIds = new Set(updated.map((m) => m.id));
            const uniqueNew = incoming
              .filter((m) => !existingIds.has(m.id))
              .map((m) => ({
                ...m,
                is_read: m.is_read || (lastReadId > 0 && m.id <= lastReadId),
              }));

            if (uniqueNew.length > 0) {
              lastMessageIdRef.current = uniqueNew[uniqueNew.length - 1].id;
              setTimeout(() => scrollToBottom(true), 50);
              return [...updated, ...uniqueNew];
            }
          }

          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      if (isInitial) setLoadingMessages(false);
    }
  }, []);

  // When a thread/contact is selected
  const handleSelectThread = useCallback((threadItem) => {
    setSelectedThread(threadItem);
    setMobileView('chat');
    lastMessageIdRef.current = null;
    setMessages([]);

    if (threadItem.thread_id) {
      fetchMessages(threadItem.thread_id, true);
      api.markChatAsRead(threadItem.thread_id).catch(() => {});
    } else {
      // New conversation with no prior thread in DB
      setLoadingMessages(false);
    }

    // Clear unread count locally for responsive UI
    setThreads((prev) =>
      prev.map((t) => (t.user_id === threadItem.user_id ? { ...t, unread_count: 0 } : t))
    );
  }, [fetchMessages]);

  // 2. Fetch conversations / employees list
  const fetchThreads = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingThreads(true);
    try {
      const response = await api.getChatThreads();
      const data = response?.data || [];
      setThreads(data);

      // Auto-select first thread on desktop if none selected yet
      setSelectedThread((current) => {
        if (!current && data.length > 0 && window.innerWidth >= 1024) {
          handleSelectThread(data[0]);
          return data[0];
        }
        return current;
      });
    } catch (err) {
      console.error('Failed to load chat conversations:', err);
      if (!quiet) setErrorMessage('Could not load chat conversations. Please try again.');
    } finally {
      if (!quiet) setLoadingThreads(false);
    }
  }, [handleSelectThread]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // 3. Smart Polling: Every 2.5 seconds when active thread is open
  useEffect(() => {
    if (!selectedThread?.thread_id) return;

    pollingTimerRef.current = setInterval(() => {
      fetchMessages(selectedThread.thread_id, false);
      // Quiet background refresh of threads unread count
      fetchThreads(true);
    }, 2500);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [selectedThread?.thread_id, fetchMessages, fetchThreads]);

  // 4. Send Message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedThread || sending) return;

    setInputText('');
    setSending(true);

    // Optimistic message placeholder
    const currentUserId = currentUser?.user_id || currentUser?.id;
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: selectedThread.user_id,
      message: text,
      created_at: new Date().toISOString(),
      is_read: false,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const payload = {
        message: text,
        receiver_id: selectedThread.user_id,
        thread_id: selectedThread.thread_id || null,
      };

      const response = await api.sendChatMessage(payload);
      const savedMessage = response?.data;
      const threadId = response?.thread_id;

      // Replace optimistic message with actual DB record
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...savedMessage, isPending: false } : m))
      );

      if (savedMessage?.id) {
        lastMessageIdRef.current = savedMessage.id;
      }

      // If thread was newly created, attach thread_id to selectedThread
      if (!selectedThread.thread_id && threadId) {
        setSelectedThread((prev) => ({ ...prev, thread_id: threadId }));
      }

      // Update last message in thread list
      setThreads((prev) =>
        prev.map((t) =>
          t.user_id === selectedThread.user_id
            ? {
                ...t,
                thread_id: threadId || t.thread_id,
                last_message: text,
                last_message_at: new Date().toISOString(),
                last_sender_id: currentUser.id,
              }
            : t
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      // Revert optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(text); // restore typed text so user doesn't lose it
      setErrorMessage(err?.data?.message || 'Failed to send message. Please retry.');
    } finally {
      setSending(false);
    }
  };

  const handleStartEdit = (msg) => {
    if (msg.is_deleted) return;
    setEditingMessageId(msg.id);
    setEditInputText(msg.message);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditInputText('');
  };

  const handleSaveEdit = async (messageId) => {
    const text = editInputText.trim();
    if (!text || actionLoading) return;

    setActionLoading(true);
    try {
      await api.updateChatMessage(messageId, { message: text });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, message: text, is_edited: true, edited_at: new Date().toISOString() }
            : m
        )
      );
      setEditingMessageId(null);
      setEditInputText('');
    } catch (err) {
      alert(err?.data?.message || 'Failed to update message.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    setActionLoading(true);
    try {
      await api.deleteChatMessage(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: true, message: 'This message was deleted' }
            : m
        )
      );
    } catch (err) {
      alert(err?.data?.message || 'Failed to delete message.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter contacts
  const filteredThreads = threads.filter((thread) => {
    const matchesSearch =
      (thread.name && thread.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (thread.employee_code && thread.employee_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (thread.department && thread.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (thread.designation && thread.designation.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterTab === 'unread') {
      return matchesSearch && Number(thread.unread_count) > 0;
    }
    return matchesSearch;
  });

  const totalUnread = threads.reduce((acc, t) => acc + (Number(t.unread_count) || 0), 0);

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Top Header Banner */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-sm">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">
                {isSuperAdmin ? 'Live Employee Chat' : 'Admin Live Support'}
              </h1>
              {totalUnread > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {totalUnread} unread
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isSuperAdmin
                ? 'Direct 1-on-1 real-time communications with employees'
                : 'Direct confidential channel with Super Admin'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchThreads();
            if (selectedThread?.thread_id) fetchMessages(selectedThread.thread_id, true);
          }}
          title="Refresh chat messages"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sync Chat</span>
        </button>
      </div>

      {/* Main Workspace (Split View) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Contacts & Conversations */}
        <div
          className={`flex w-full flex-col border-r border-slate-200 bg-slate-50/40 lg:w-80 lg:shrink-0 xl:w-96 ${
            mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search & Tabs */}
          <div className="border-b border-slate-200 p-3 space-y-2.5 bg-white">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, code, dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                  filterTab === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Staff ({threads.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                  filterTab === 'unread'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Unread ({totalUnread})
              </button>
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingThreads ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading staff directory...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-medium text-slate-500">No staff found</p>
                <p className="text-[11px] text-slate-400">Try adjusting your search criteria</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedThread?.user_id === thread.user_id;
                const hasUnread = Number(thread.unread_count) > 0;

                return (
                  <button
                    key={thread.user_id}
                    type="button"
                    onClick={() => handleSelectThread(thread)}
                    className={`group flex w-full items-start gap-3 p-3.5 text-left transition ${
                      isSelected
                        ? 'bg-emerald-50/80 border-l-4 border-emerald-600'
                        : 'hover:bg-slate-100/70'
                    }`}
                  >
                    {/* User Avatar */}
                    <div className="relative shrink-0">
                      {thread.avatar ? (
                        <img
                          src={thread.avatar}
                          alt={thread.name}
                          className="h-10 w-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-xs font-bold text-white uppercase shadow-sm">
                          {thread.name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </div>

                    {/* Meta & Last Message */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold text-slate-900 group-hover:text-emerald-900">
                          {thread.name}
                        </span>
                        {thread.last_message_at && (
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatMessageTime(thread.last_message_at)}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                        {thread.employee_code && (
                          <span className="font-semibold text-emerald-700">{thread.employee_code}</span>
                        )}
                        {thread.designation && (
                          <>
                            <span>·</span>
                            <span className="truncate">{thread.designation}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] text-slate-500 leading-tight">
                          {thread.last_message || <span className="italic text-slate-400">Click to start conversation</span>}
                        </p>
                        {hasUnread && (
                          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div
          className={`flex flex-1 flex-col bg-slate-50/20 ${
            mobileView === 'list' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {selectedThread ? (
            <>
              {/* Chat Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-xs">
                <div className="flex items-center gap-3">
                  {/* Back button on mobile */}
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div className="relative">
                    {selectedThread.avatar ? (
                      <img
                        src={selectedThread.avatar}
                        alt={selectedThread.name}
                        className="h-9 w-9 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white uppercase">
                        {selectedThread.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-bold text-slate-900">{selectedThread.name}</h2>
                      {selectedThread.employee_code && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                          {selectedThread.employee_code}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {selectedThread.designation || 'Staff'} · {selectedThread.branch_name || 'Pinweb'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-Time Active</span>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="mx-4 mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-center justify-between">
                  <span>{errorMessage}</span>
                  <button onClick={() => setErrorMessage('')} className="font-bold ml-2">×</button>
                </div>
              )}

              {/* Message History Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-xs text-slate-400">Loading conversation history...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-3 shadow-xs">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Start conversation with {selectedThread.name}
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-slate-500">
                      Messages sent here are delivered instantly and securely to the employee portal.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const currentUserId = currentUser?.user_id || currentUser?.id;
                    const isOwnMessage =
                      Number(msg.sender_id) === Number(currentUserId) ||
                      Number(msg.sender_id) === Number(currentUser?.id) ||
                      Number(msg.sender_id) === Number(currentUser?.user_id);
                    const isEditingThis = editingMessageId === msg.id;

                    return (
                      <div
                        key={msg.id || idx}
                        className={`group relative flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                      >
                        {/* Hover Action Toolbar: Edit & Delete for own message, or Super Admin delete */}
                        {!msg.isPending && !msg.is_deleted && !isEditingThis && (
                          <div
                            className={`mb-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[11px] text-slate-400 ${
                              isOwnMessage ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {isOwnMessage && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(msg)}
                                className="rounded-md p-1 hover:bg-slate-200 hover:text-slate-700 transition"
                                title="Edit message"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {(isOwnMessage || isSuperAdmin) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="rounded-md p-1 hover:bg-rose-100 hover:text-rose-600 transition"
                                title="Delete message"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs break-words transition-all ${
                            isOwnMessage
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-xs'
                              : 'bg-white text-slate-900 border border-slate-200/90 rounded-tl-xs'
                          } ${msg.is_deleted ? 'italic opacity-60 bg-slate-100 text-slate-500 border border-slate-200' : ''}`}
                        >
                          {isEditingThis ? (
                            <div className="space-y-2 min-w-[220px]">
                              <input
                                type="text"
                                value={editInputText}
                                onChange={(e) => setEditInputText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(msg.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                className="w-full rounded-lg bg-white/20 text-white px-2.5 py-1.5 text-xs outline-none border border-white/40 placeholder-white/60 focus:bg-white/30"
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-1.5 text-[10px]">
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(msg.id)}
                                  disabled={actionLoading}
                                  className="px-2 py-0.5 rounded bg-white text-emerald-800 font-bold hover:bg-emerald-50 shadow-xs"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                              <div
                                className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                                  isOwnMessage ? 'text-emerald-100' : 'text-slate-400'
                                }`}
                              >
                                {msg.is_edited && !msg.is_deleted && (
                                  <span className="text-[9px] opacity-80 mr-0.5 italic">(edited)</span>
                                )}
                                <span>{formatMessageTime(msg.created_at)}</span>
                                {isOwnMessage && !msg.is_deleted && (
                                  <span>
                                    {msg.isPending ? (
                                      <Clock className="h-3 w-3 inline text-emerald-200" />
                                    ) : msg.is_read ? (
                                      <CheckCheck className="h-3.5 w-3.5 inline text-teal-200" title="Seen" />
                                    ) : (
                                      <Check className="h-3 w-3 inline text-emerald-200/80" title="Sent" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Message Input Bar */}
              <div className="border-t border-slate-200 bg-white p-3 sm:px-4">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Write a message to ${selectedThread.name}... (Press Enter to send)`}
                    className="flex-1 rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 mr-1 sm:mr-1.5" />
                    <span className="hidden sm:inline">{sending ? 'Sending...' : 'Send'}</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Select an employee</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Choose any staff member from the left directory to start a live 1-on-1 chat session.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
