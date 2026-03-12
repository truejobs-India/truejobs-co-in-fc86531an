import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { X, Send, User, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';

// Import premium bot icon
import iconChatbot from '@/assets/icon-chatbot.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTION_CHIPS = [
  'Remote React jobs',
  'Fresher in Bangalore',
  'Python developer Delhi',
  'Full stack Mumbai',
  'Data analyst remote',
];

export function JobSearchBot() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showOnboardingTooltip, setShowOnboardingTooltip] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Initialize greeting message with translation
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: t('chat.greeting')
      }
    ]);
  }, [t]);

  // Onboarding tooltip animation - show briefly on first load
  useEffect(() => {
    const hasSeenOnboarding = sessionStorage.getItem('chatbot-onboarding-seen');
    if (!hasSeenOnboarding && !isOpen) {
      const showTimer = setTimeout(() => {
        setShowOnboardingTooltip(true);
      }, 2000); // Show after 2 seconds

      const hideTimer = setTimeout(() => {
        setShowOnboardingTooltip(false);
        sessionStorage.setItem('chatbot-onboarding-seen', 'true');
      }, 6000); // Hide after 6 seconds total

      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('job-search-smart', {
        body: {
          message: userMessage
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get response',
        variant: 'destructive',
      });
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I encountered an error. Please try again in a moment." 
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

  // Parse message content to make job links clickable
  const renderMessageContent = (content: string) => {
    // Match [View Job](/jobs/xxx) pattern
    const linkPattern = /\[View Job\]\(\/jobs\/([a-zA-Z0-9-]+)\)/g;
    const parts = content.split(linkPattern);
    
    return parts.map((part, index) => {
      // Every odd index is a job ID (captured group)
      if (index % 2 === 1) {
        return (
          <Link
            key={index}
            to={`/jobs/${part}`}
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
            onClick={() => setIsOpen(false)}
          >
            View Job →
          </Link>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <TooltipProvider>
              <Tooltip open={showOnboardingTooltip} onOpenChange={setShowOnboardingTooltip}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      setIsOpen(true);
                      setShowOnboardingTooltip(false);
                    }}
                    size="lg"
                    className="h-16 w-16 rounded-full bg-white shadow-xl hover:shadow-2xl transition-all p-0 overflow-hidden border-2 border-primary/20"
                  >
                    <img src={iconChatbot} alt="AI Job Search Assistant" className="h-full w-full object-cover" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-foreground text-background px-3 py-2 max-w-[220px]">
                  <p className="text-sm font-medium">{t('chat.tooltipTitle')}</p>
                  <p className="text-xs opacity-80">{t('chat.tooltipDesc')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
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
                      <CardTitle className="text-lg font-semibold">TrueJobs AI</CardTitle>
                      <p className="text-xs text-white/80">Smart Job Matching</p>
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
                          className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          }`}
                        >
                          {message.role === 'assistant' 
                            ? renderMessageContent(message.content)
                            : message.content
                          }
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
                            <motion.span
                              className="w-2 h-2 bg-primary/60 rounded-full"
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                            />
                            <motion.span
                              className="w-2 h-2 bg-primary/60 rounded-full"
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                            />
                            <motion.span
                              className="w-2 h-2 bg-primary/60 rounded-full"
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </ScrollArea>

                {/* Suggestion Chips */}
                {messages.length === 1 && !isLoading && (
                  <div className="border-t pt-3 pb-2 px-4">
                    <p className="text-xs text-muted-foreground mb-2">Try these:</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTION_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          onClick={() => {
                            setInput(chip);
                            setTimeout(() => {
                              setMessages(prev => [...prev, { role: 'user', content: chip }]);
                              setIsLoading(true);
                              supabase.functions.invoke('job-search-smart', {
                                body: { message: chip }
                              }).then(({ data, error }) => {
                                if (error || data?.error) {
                                  setMessages(prev => [...prev, { 
                                    role: 'assistant', 
                                    content: "I'm sorry, I encountered an error. Please try again in a moment." 
                                  }]);
                                } else {
                                  setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
                                }
                                setIsLoading(false);
                                setInput('');
                              });
                            }, 0);
                          }}
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
                      placeholder="Describe your ideal job..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading}
                      size="icon"
                      className="bg-gradient-primary"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Try: "Find React developer jobs in Bangalore"
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