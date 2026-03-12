import { useState, useEffect, useCallback } from 'react';
import { X, Bell, Shield, FileText, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ExitIntentPopup() {
  const [show, setShow] = useState(false);

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    if (e.clientY <= 0 && !sessionStorage.getItem('exit-popup-shown')) {
      setShow(true);
      sessionStorage.setItem('exit-popup-shown', 'true');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [handleMouseLeave]);

  // Dispatch adVisibility events for AdPlaceholder
  useEffect(() => {
    if (show) {
      window.dispatchEvent(new CustomEvent('adVisibility', { detail: { visible: false } }));
    }
    return () => {
      if (show) {
        window.dispatchEvent(new CustomEvent('adVisibility', { detail: { visible: true } }));
      }
    };
  }, [show]);

  if (!show) return null;

  const handleClose = () => {
    setShow(false);
    window.dispatchEvent(new CustomEvent('adVisibility', { detail: { visible: true } }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-background border shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-300">
        <button onClick={handleClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors" aria-label="Close">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Bell className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Wait! Don't Miss Your Dream Job</h2>
          <p className="text-muted-foreground text-sm">Join 10,000+ candidates who get instant job alerts</p>
        </div>

        <div className="space-y-3 mb-6">
          {[
            { icon: Bell, text: 'Instant Govt Job Alerts via Email' },
            { icon: Shield, text: 'Admit Card & Result Notifications' },
            { icon: FileText, text: 'Free Resume Builder Access' },
            { icon: Clock, text: 'Early Application Reminders' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        <Link
          to="/signup"
          onClick={handleClose}
          className="block w-full text-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Get Free Job Alerts
        </Link>
        <button onClick={handleClose} className="block w-full text-center mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          No thanks, I'll search manually
        </button>
      </div>
    </div>
  );
}
