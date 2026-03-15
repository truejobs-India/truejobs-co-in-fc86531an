import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { X, Send, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import iconChatbot from '@/assets/icon-chatbot.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_CHIPS = [
  'SSC CGL eligibility kya hai?',
  'UP Police admit card kab aayega?',
  '12th pass sarkari jobs',
  'Railway Group D syllabus',
  'Latest govt jobs in Bihar',
];

// Valid URL patterns for link grounding
const VALID_LINK_PATTERNS = [
  /^\/sarkari-exam\//,
  /^\/employment-news\//,
  /^\/blog\//,
  /^\/sample-papers\//,
  /^\/books\//,
  /^\/previous-year-papers\//,
  /^\/sarkari-result\//,
  /^\/answer-key\//,
];

function isValidInternalLink(href: string): boolean {
  return VALID_LINK_PATTERNS.some(p => p.test(href));
}

export function JobSearchBot() {
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [showOnboardingTooltip, setShowOnboardingTooltip] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(DEFAULT_CHIPS);
  const [messageCount, setMessageCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Session ID
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Draggable state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Load chatbot config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['chatbot_enabled', 'chatbot_welcome_message', 'chatbot_suggested_prompts']);

        if (data) {
          for (const row of data) {
            const val = row.value as Record<string, any>;
            if (row.key === 'chatbot_enabled') {
              setChatbotEnabled(val?.enabled !== false);
            } else if (row.key === 'chatbot_welcome_message') {
              const welcomeMsg = val?.[language] || val?.en || t('chat.greeting');
              setMessages([{ role: 'assistant', content: welcomeMsg }]);
            } else if (row.key === 'chatbot_suggested_prompts') {
              if (Array.isArray(val?.prompts) && val.prompts.length > 0) {
                setSuggestedPrompts(val.prompts);
              }
            }
          }
        }
      } catch {
        // Fallback to defaults
        setMessages([{ role: 'assistant', content: t('chat.greeting') }]);
      }
    };
    loadConfig();
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved position
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('chatbot-position');
      if (saved) {
        const parsed = JSON.parse(saved);
        setPosition(clampPosition(parsed.x, parsed.y));
      }
    } catch { /* ignore */ }
  }, []);

  function clampPosition(x: number, y: number): { x: number; y: number } {
    const minBottom = isMobile ? 80 : 16;
    return {
      x: Math.max(16, Math.min(x, window.innerWidth - 80)),
      y: Math.max(16, Math.min(y, window.innerHeight - 80 - minBottom)),
    };
  }

  function getDefaultPosition() {
    return {
      x: window.innerWidth - 80,
      y: window.innerHeight - (isMobile ? 160 : 80),
    };
  }

  // Onboarding tooltip
  useEffect(() => {
    const hasSeenOnboarding = sessionStorage.getItem('chatbot-onboarding-seen');
    if (!hasSeenOnboarding && !isOpen) {
      const showTimer = setTimeout(() => setShowOnboardingTooltip(true), 2000);
      const hideTimer = setTimeout(() => {
        setShowOnboardingTooltip(false);
        sessionStorage.setItem('chatbot-onboarding-seen', 'true');
      }, 6000);
      return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const pos = position || getDefaultPosition();
    dragStartRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    isDraggingRef.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isDraggingRef.current = true;
      const newPos = clampPosition(
        dragStartRef.current.px + dx,
        dragStartRef.current.py + dy
      );
      setPosition(newPos);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    if (isDraggingRef.current && position) {
      sessionStorage.setItem('chatbot-position', JSON.stringify(position));
    } else {
      // Click — toggle chat
      setIsOpen(true);
      setShowOnboardingTooltip(false);
    }
    dragStartRef.current = null;
    isDraggingRef.current = false;
  }, [position]);

  const handleDoubleClick = useCallback(() => {
    const def = getDefaultPosition();
    setPosition(def);
    sessionStorage.setItem('chatbot-position', JSON.stringify(def));
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (text?: string) => {
    const userMessage = (text || input).trim();
    if (!userMessage || isLoading) return;
    if (messageCount >= 30) {
      toast({ title: 'Session limit reached', description: 'Please refresh to start a new session.', variant: 'destructive' });
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setMessageCount(c => c + 1);

    if (messageCount >= 24) {
      toast({ title: 'Notice', description: `${30 - messageCount - 1} messages remaining in this session.` });
    }

    try {
      // Build conversation history (last 6 messages)
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('govt-jobs-assistant', {
        body: {
          message: userMessage,
          sessionId: sessionIdRef.current,
          conversationHistory: history,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: language === 'hi' 
          ? 'क्षमा करें, कोई त्रुटि हुई। कृपया पुनः प्रयास करें।'
          : 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!chatbotEnabled) return null;

  const buttonPos = position || getDefaultPosition();

  return (
    <>
      {/* Draggable Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{ position: 'fixed', left: buttonPos.x, top: buttonPos.y, zIndex: 50, touchAction: 'none' }}
          >
            <TooltipProvider>
              <Tooltip open={showOnboardingTooltip} onOpenChange={setShowOnboardingTooltip}>
                <TooltipTrigger asChild>
                  <button
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onDoubleClick={handleDoubleClick}
                    className="h-16 w-16 rounded-full bg-white shadow-xl hover:shadow-2xl transition-all p-0 overflow-hidden border-2 border-primary/20 cursor-grab active:cursor-grabbing"
                    aria-label={t('chat.tooltipTitle')}
                  >
                    <img src={iconChatbot} alt="Sarkari Jobs AI Assistant" className="h-full w-full object-cover" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-foreground text-background px-3 py-2 max-w-[220px]">
                  <p className="text-sm font-medium">{t('chat.tooltipTitle')}</p>
                  <p className="text-xs opacity-80">{t('chat.tooltipDesc')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="absolute -top-1 -right-1 flex h-4 w-4 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)]"
          >
            <Card className="shadow-2xl border-2 overflow-hidden">
              {/* Header */}
              <CardHeader className="bg-gradient-primary text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                      <img src={iconChatbot} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">{t('chat.title')}</CardTitle>
                      <p className="text-xs text-white/80">{t('chat.subtitle')}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="p-0">
                <ScrollArea className="h-[400px] p-4" ref={scrollAreaRef}>
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'assistant' && (
                          <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 shadow-sm">
                            <img src={iconChatbot} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          }`}
                        >
                          {message.role === 'assistant' ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                              <ReactMarkdown
                                components={{
                                  a: ({ href, children }) => {
                                    if (href && isValidInternalLink(href)) {
                                      return (
                                        <Link
                                          to={href}
                                          className="text-primary hover:underline font-medium"
                                          onClick={() => setIsOpen(false)}
                                        >
                                          {children}
                                        </Link>
                                      );
                                    }
                                    // Non-internal or unrecognized links: render as plain text
                                    return <span className="font-medium">{children}</span>;
                                  },
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <span className="whitespace-pre-wrap">{message.content}</span>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                      >
                        <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 shadow-sm">
                          <img src={iconChatbot} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <motion.span className="w-2 h-2 bg-primary/60 rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                            <motion.span className="w-2 h-2 bg-primary/60 rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
                            <motion.span className="w-2 h-2 bg-primary/60 rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </ScrollArea>

                {/* Suggestion Chips */}
                {messages.length <= 1 && !isLoading && (
                  <div className="border-t pt-3 pb-2 px-4">
                    <p className="text-xs text-muted-foreground mb-2">{t('chat.tryThese')}</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedPrompts.map((chip) => (
                        <button
                          key={chip}
                          onClick={() => sendMessage(chip)}
                          className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('chat.placeholder')}
                      disabled={isLoading || messageCount >= 30}
                      className="flex-1"
                      maxLength={500}
                    />
                    <Button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isLoading || messageCount >= 30}
                      size="icon"
                      className="bg-gradient-primary"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t('chat.hint')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
