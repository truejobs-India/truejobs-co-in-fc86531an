import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type AdminMessageType = 'success' | 'warning' | 'error' | 'info';

export interface AdminMessage {
  id: string;
  type: AdminMessageType;
  title: string;
  description: string;
  timestamp: string;
  expanded?: boolean;
}

const MAX_MESSAGES = 20;
const STORAGE_KEY = 'admin_persistent_messages';

function loadFromSession(): AdminMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function saveToSession(messages: AdminMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(0, MAX_MESSAGES)));
  } catch {}
}

interface AdminMessagesContextType {
  messages: AdminMessage[];
  addMessage: (type: AdminMessageType, title: string, description?: string) => string;
  dismissMessage: (id: string) => void;
  clearAll: () => void;
  toggleExpand: (id: string) => void;
}

const AdminMessagesContext = createContext<AdminMessagesContextType | null>(null);

export function AdminMessagesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<AdminMessage[]>(loadFromSession);

  useEffect(() => {
    saveToSession(messages);
  }, [messages]);

  const addMessage = useCallback((type: AdminMessageType, title: string, description = '') => {
    const id = crypto.randomUUID();
    setMessages(prev => [{
      id, type, title, description, timestamp: new Date().toISOString(),
    }, ...prev].slice(0, MAX_MESSAGES));
    return id;
  }, []);

  const dismissMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const clearAll = useCallback(() => setMessages([]), []);

  const toggleExpand = useCallback((id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, expanded: !m.expanded } : m));
  }, []);

  return (
    <AdminMessagesContext.Provider value={{ messages, addMessage, dismissMessage, clearAll, toggleExpand }}>
      {children}
    </AdminMessagesContext.Provider>
  );
}

export function useAdminMessagesContext() {
  const ctx = useContext(AdminMessagesContext);
  if (!ctx) throw new Error('useAdminMessagesContext must be inside AdminMessagesProvider');
  return ctx;
}

/**
 * Drop-in replacement for useToast() inside admin components.
 * Same API: returns { toast } where toast({ title, description, variant }) works.
 * Messages become persistent instead of ephemeral.
 */
export function useAdminToast() {
  const ctx = useContext(AdminMessagesContext);

  // If used outside AdminMessagesProvider, fall back to no-op
  // (shouldn't happen in admin panel)
  if (!ctx) {
    return {
      toast: ({ title, description }: { title: string; description?: string; variant?: string }) => {
        console.warn('[useAdminToast] Called outside provider:', title, description);
        return { id: '', dismiss: () => {}, update: () => {} };
      },
      dismiss: () => {},
    };
  }

  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    let type: AdminMessageType = 'success';
    if (variant === 'destructive') type = 'error';
    else if (title.includes('⚠') || title.toLowerCase().includes('warning')) type = 'warning';
    else if (title.includes('ℹ') || title.toLowerCase().includes('info') || title.toLowerCase().includes('scanning') || title.toLowerCase().includes('processing')) type = 'info';

    const id = ctx.addMessage(type, title, description || '');
    return { id, dismiss: () => ctx.dismissMessage(id), update: () => {} };
  };

  return { toast, dismiss: ctx.dismissMessage };
}
