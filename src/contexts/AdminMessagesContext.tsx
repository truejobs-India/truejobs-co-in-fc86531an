import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';

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

// ── State context (messages array) ──────────────────────────
interface AdminMessagesStateContextType {
  messages: AdminMessage[];
}

const AdminMessagesStateContext = createContext<AdminMessagesStateContextType | null>(null);

// ── Actions context (stable callbacks only) ─────────────────
interface AdminMessagesActionsContextType {
  addMessage: (type: AdminMessageType, title: string, description?: string) => string;
  dismissMessage: (id: string) => void;
  clearAll: () => void;
  toggleExpand: (id: string) => void;
}

const AdminMessagesActionsContext = createContext<AdminMessagesActionsContextType | null>(null);

// ── Combined type for backward-compat hook ──────────────────
interface AdminMessagesContextType extends AdminMessagesStateContextType, AdminMessagesActionsContextType {}

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

  // Memoize both provider values to prevent unnecessary re-renders
  const stateValue = useMemo(() => ({ messages }), [messages]);
  const actionsValue = useMemo(() => ({ addMessage, dismissMessage, clearAll, toggleExpand }), [addMessage, dismissMessage, clearAll, toggleExpand]);

  return (
    <AdminMessagesActionsContext.Provider value={actionsValue}>
      <AdminMessagesStateContext.Provider value={stateValue}>
        {children}
      </AdminMessagesStateContext.Provider>
    </AdminMessagesActionsContext.Provider>
  );
}

/**
 * Full context hook — returns messages + all actions.
 * Use this in components that READ messages (e.g. AdminMessageLog).
 */
export function useAdminMessagesContext(): AdminMessagesContextType {
  const state = useContext(AdminMessagesStateContext);
  const actions = useContext(AdminMessagesActionsContext);
  if (!state || !actions) throw new Error('useAdminMessagesContext must be inside AdminMessagesProvider');
  return { ...state, ...actions };
}

/**
 * Drop-in replacement for useToast() inside admin components.
 * Same API: returns { toast } where toast({ title, description, variant }) works.
 * Messages become persistent instead of ephemeral.
 *
 * IMPORTANT: Subscribes to actions context ONLY — components using this hook
 * will NOT re-render when messages change. This is intentional to prevent
 * flicker in write-only consumers like PdfResourcesManager.
 */
export function useAdminToast() {
  const actions = useContext(AdminMessagesActionsContext);

  // If used outside AdminMessagesProvider, fall back to no-op
  const noopToast = useCallback(({ title, description }: { title: string; description?: string; variant?: string }) => {
    console.warn('[useAdminToast] Called outside provider:', title, description);
    return { id: '', dismiss: () => {}, update: () => {} };
  }, []);

  const noopDismiss = useCallback(() => {}, []);

  const stableToast = useCallback(({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (!actions) return { id: '', dismiss: () => {}, update: () => {} };
    let type: AdminMessageType = 'success';
    if (variant === 'destructive') type = 'error';
    else if (title.includes('⚠') || title.toLowerCase().includes('warning')) type = 'warning';
    else if (title.includes('ℹ') || title.toLowerCase().includes('info') || title.toLowerCase().includes('scanning') || title.toLowerCase().includes('processing')) type = 'info';

    const id = actions.addMessage(type, title, description || '');
    return { id, dismiss: () => actions.dismissMessage(id), update: () => {} };
  }, [actions]);

  if (!actions) {
    return { toast: noopToast, dismiss: noopDismiss };
  }

  return { toast: stableToast, dismiss: actions.dismissMessage };
}
