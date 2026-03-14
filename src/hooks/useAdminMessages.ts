import { useState, useEffect, useCallback } from 'react';

export type AdminMessageType = 'success' | 'warning' | 'error' | 'info';

export interface AdminMessage {
  id: string;
  type: AdminMessageType;
  title: string;
  description: string;
  timestamp: string; // ISO string for serialization
  expanded?: boolean;
}

const MAX_MESSAGES = 20;

function getStorageKey(pageKey: string): string {
  return `admin_messages_${pageKey}`;
}

function loadFromSession(pageKey: string): AdminMessage[] {
  try {
    const raw = sessionStorage.getItem(getStorageKey(pageKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function saveToSession(pageKey: string, messages: AdminMessage[]) {
  try {
    sessionStorage.setItem(getStorageKey(pageKey), JSON.stringify(messages.slice(0, MAX_MESSAGES)));
  } catch {
    // Session storage full or unavailable — silently ignore
  }
}

/**
 * Persistent admin message system. Messages survive page refreshes (session storage)
 * and stay visible until manually dismissed.
 * 
 * @param pageKey Unique key for the admin page (e.g., 'blog', 'emp-news', 'content-enrichment')
 */
export function useAdminMessages(pageKey: string) {
  const [messages, setMessages] = useState<AdminMessage[]>(() => loadFromSession(pageKey));

  // Sync to session storage on every change
  useEffect(() => {
    saveToSession(pageKey, messages);
  }, [messages, pageKey]);

  const addMessage = useCallback((
    type: AdminMessageType,
    title: string,
    description: string = ''
  ) => {
    const msg: AdminMessage = {
      id: crypto.randomUUID(),
      type,
      title,
      description,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [msg, ...prev].slice(0, MAX_MESSAGES));
    return msg.id;
  }, []);

  const dismissMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setMessages([]);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, expanded: !m.expanded } : m
    ));
  }, []);

  return {
    messages,
    addMessage,
    dismissMessage,
    clearAll,
    toggleExpand,
  };
}
