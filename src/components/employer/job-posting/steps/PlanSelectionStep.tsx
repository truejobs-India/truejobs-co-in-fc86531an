import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Check, X, Loader2 } from 'lucide-react';
import { JobPostingData } from '../JobPostingWizard';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Company logos
import logoTCS from '@/assets/logo-tcs-new.png';
import logoInfosys from '@/assets/logo-infosys-new.png';
import logoWipro from '@/assets/logo-wipro-new.png';
import logoHDFC from '@/assets/logo-hdfc-life.png';
import logoTataAIG from '@/assets/logo-tata-aig-new.png';
import logoReliance from '@/assets/logo-reliance.png';
import logoBajaj from '@/assets/logo-bajaj.png';
import logoKotak from '@/assets/logo-kotak-life.png';
import logoICICI from '@/assets/logo-icici-prudential.png';
import logoTechM from '@/assets/logo-techmahindra.jpg';

interface PlanSelectionStepProps {
  data: JobPostingData;
  onUpdate: (updates: Partial<JobPostingData>) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

interface JobPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  currency: string;
  duration_days: number;
  visibility_level: string;
  features: string[];
  is_featured: boolean;
  is_urgent_hiring: boolean;
  has_whatsapp_notifications: boolean;
  has_priority_placement: boolean;
  display_order: number;
  max_job_posts: number;
}

const hiringLogos = [
  { src: logoTCS, alt: 'TCS' },
  { src: logoInfosys, alt: 'Infosys' },
  { src: logoWipro, alt: 'Wipro' },
  { src: logoHDFC, alt: 'HDFC Life' },
  { src: logoTataAIG, alt: 'Tata AIG' },
  { src: logoReliance, alt: 'Reliance' },
  { src: logoBajaj, alt: 'Bajaj' },
  { src: logoKotak, alt: 'Kotak Life' },
  { src: logoICICI, alt: 'ICICI Prudential' },
  { src: logoTechM, alt: 'Tech Mahindra' },
];

export function PlanSelectionStep({ data, onUpdate, onBack, onSubmit, isSubmitting }: PlanSelectionStepProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<JobPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data: plansData, error } = await supabase
      .from('job_posting_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (!error && plansData) {
      setPlans(plansData.map(p => ({
        ...p,
        features: Array.isArray(p.features) ? p.features as string[] : []
      })));
      if (!data.selectedPlanId && plansData.length > 0) {
        onUpdate({ selectedPlanId: plansData[0].id });
      }
    }
    setIsLoading(false);
  };

  const selectedPlan = plans.find(p => p.id === data.selectedPlanId);

  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

  const handlePayAndPost = async () => {
    if (!selectedPlan || !user) return;

    // Free plan — skip payment
    if (selectedPlan.price === 0) {
      onSubmit();
      return;
    }

    setIsPaymentProcessing(true);

    try {
      // Step 1: Create order server-side (price fetched from DB, not client)
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            planId: selectedPlan.id,
            employerId: user.id,
          },
        }
      );

      if (orderError || !orderData?.orderId) {
        throw new Error(orderData?.error || 'Failed to create payment order');
      }

      // Step 2: Open Razorpay Checkout modal (amount is pre-set, user cannot change it)
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'TrueJobs',
        description: `${orderData.planName || selectedPlan.name} Plan`,
        order_id: orderData.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // Step 3: Verify payment server-side before activating
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              'verify-razorpay-payment',
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  planId: selectedPlan.id,
                  employerId: user.id,
                },
              }
            );

            if (verifyError || !verifyData?.verified) {
              throw new Error(verifyData?.error || 'Payment verification failed');
            }

            toast({
              title: '✅ Payment Successful!',
              description: `Your ${selectedPlan.name} plan is now active. Payment ID: ${response.razorpay_payment_id}`,
            });

            onSubmit();
          } catch (verifyErr: any) {
            toast({
              title: 'Payment verification failed',
              description: verifyErr.message || 'Please contact support if amount was deducted.',
              variant: 'destructive',
            });
          } finally {
            setIsPaymentProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsPaymentProcessing(false);
            toast({
              title: 'Payment cancelled',
              description: 'You can try again when ready.',
            });
          },
        },
        prefill: {
          email: user.email || '',
        },
        theme: {
          color: '#2563eb',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        setIsPaymentProcessing(false);
        toast({
          title: 'Payment failed',
          description: response.error?.description || 'Please try again.',
          variant: 'destructive',
        });
      });
      rzp.open();
    } catch (err: any) {
      setIsPaymentProcessing(false);
      toast({
        title: 'Error',
        description: err.message || 'Could not initiate payment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isProcessing = isSubmitting || isPaymentProcessing;
  // Find which plan is "recommended" (featured or premium-ai)
  const recommendedSlug = plans.find(p => p.is_featured || p.slug === 'premium-ai')?.id;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">Select your Job Plan</h2>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Choose the plan that best fits your hiring needs
        </p>
      </div>

      {/* Plan Cards */}
      <RadioGroup
        value={data.selectedPlanId || ''}
        onValueChange={(value) => onUpdate({ selectedPlanId: value })}
        className={cn(
          "grid gap-4",
          plans.length <= 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {plans.map((plan) => {
          const isSelected = data.selectedPlanId === plan.id;
          const isRecommended = plan.id === recommendedSlug;

          return (
            <div key={plan.id} className="relative">
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground whitespace-nowrap px-4 py-1 text-xs">
                    Recommended
                  </Badge>
                </div>
              )}

              <div
                className={cn(
                  'cursor-pointer rounded-xl border-2 bg-card p-5 transition-all h-full flex flex-col',
                  isSelected
                    ? 'border-primary shadow-lg ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/40 hover:shadow-md',
                  isRecommended && !isSelected && 'border-primary/50'
                )}
                onClick={() => onUpdate({ selectedPlanId: plan.id })}
              >
                {/* Plan Header */}
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{plan.visibility_level} visibility</p>
                  </div>
                  <RadioGroupItem value={plan.id} className="mt-1" />
                </div>

                {/* Price */}
                <div className="mt-3 mb-4">
                  <span className="text-3xl font-bold text-foreground">₹{plan.price.toLocaleString()}</span>
                  {plan.original_price && (
                    <span className="text-sm text-muted-foreground line-through ml-2">
                      ₹{plan.original_price.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Dotted separator */}
                <div className="border-t border-dashed border-border mb-4" />

                {/* Features */}
                <ul className="space-y-3 text-sm flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}

                  <li className="flex items-start gap-2">
                    {plan.has_whatsapp_notifications ? (
                      <>
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-foreground">{t('plan.whatsappNotif')} 📱</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{t('plan.whatsappNotif')}</span>
                      </>
                    )}
                  </li>

                  <li className="flex items-start gap-2">
                    {plan.is_urgent_hiring ? (
                      <>
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-foreground">{t('plan.urgentlyHiring')} 🔥</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{t('plan.urgentlyHiring')}</span>
                      </>
                    )}
                  </li>

                  {plan.has_priority_placement && (
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span className="text-foreground">{t('plan.topPlacements')}</span>
                    </li>
                  )}
                </ul>

                {/* Bottom price box */}
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-foreground">₹{plan.price.toLocaleString()}</span>
                    {plan.original_price && (
                      <>
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{plan.original_price.toLocaleString()}
                        </span>
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Save {Math.round((1 - plan.price / plan.original_price) * 100)}%
                        </Badge>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plan.max_job_posts} {plan.name} {plan.max_job_posts === 1 ? 'Job' : 'Jobs'} · {plan.duration_days} days
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </RadioGroup>

      {/* CTA Button */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="flex gap-3 w-full max-w-md">
          <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
            {t('wizard.back')}
          </Button>
          <Button
            size="lg"
            className="flex-[2] text-base"
            onClick={handlePayAndPost}
            disabled={!data.selectedPlanId || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('wizard.postingJob')}
              </>
            ) : selectedPlan && selectedPlan.price > 0 ? (
              `Continue with ${selectedPlan.name} Plan`
            ) : (
              t('wizard.postJob')
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('plan.excludingTax')}</p>
      </div>

      {/* Top Hiring Companies */}
      <div className="pt-6 pb-2 text-center">
        <p className="text-sm font-semibold text-primary mb-5">
          Top Hiring Companies in India
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 opacity-70">
          {hiringLogos.map((logo) => (
            <img
              key={logo.alt}
              src={logo.src}
              alt={logo.alt}
              className="h-8 md:h-10 w-auto object-contain grayscale hover:grayscale-0 transition-all"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
