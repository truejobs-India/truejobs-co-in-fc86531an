import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Bell, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Import premium icons
import iconNotification from '@/assets/icon-notification.png';
import iconCheckmark from '@/assets/icon-checkmark.png';

export function NewsletterSection() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('email_subscribers' as any)
        .insert({ email: email.trim(), frequency: 'daily' } as any);

      if (error) {
        if (error.code === '23505') {
          toast.info('You are already subscribed!');
        } else {
          throw error;
        }
      } else {
        toast.success(t('newsletter.successMessage'));
      }
      setIsSubmitted(true);
    } catch (err) {
      console.error('Newsletter subscription error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setEmail('');
    }
  };

  const features = [
    { key: 'feature1', icon: CheckCircle2 },
    { key: 'feature2', icon: CheckCircle2 },
    { key: 'feature3', icon: CheckCircle2 },
  ];

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-gradient-to-br from-primary/5 via-accent/5 to-background relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-2xl" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl glass-strong shadow-medium mb-6 overflow-hidden">
            <img 
              src={iconNotification} 
              alt="Job alert notification bell icon"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            {t('newsletter.title')}
          </h2>
          
          {/* Subtitle */}
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-6 sm:mb-8">
            {t('newsletter.subtitle')}
          </p>

          {/* Form */}
          {!isSubmitted ? (
            <motion.form 
              onSubmit={handleSubmit} 
              className="glass-strong rounded-2xl p-3 sm:p-4 shadow-medium max-w-md mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type="email"
                    placeholder={t('newsletter.placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isLoading} 
                  className="h-12 px-6 bg-gradient-primary hover:opacity-90 rounded-xl shadow-primary"
                >
                  {isLoading ? t('common.loading') : t('newsletter.subscribe')}
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.div 
              className="flex items-center justify-center gap-3 glass-strong rounded-2xl px-6 py-4 max-w-md mx-auto"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <img src={iconCheckmark} alt="" className="w-8 h-8 object-contain" />
              <span className="font-semibold text-foreground">{t('newsletter.subscribed')}</span>
            </motion.div>
          )}

          {/* Features */}
          <motion.div 
            className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-6 sm:mt-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            {features.map((feature) => (
              <div key={feature.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                <feature.icon className="w-4 h-4 text-primary" />
                <span>{t(`newsletter.${feature.key}`)}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
