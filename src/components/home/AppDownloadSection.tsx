import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Smartphone, Star, Download, CheckCircle, ScanLine, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';

// Import app screenshots
import appScreenshot1 from '@/assets/app-screenshot-1.jpg';
import appScreenshot2 from '@/assets/app-screenshot-2.jpg';
import appScreenshot3 from '@/assets/app-screenshot-3.jpg';

const screenshots = [appScreenshot1, appScreenshot2, appScreenshot3];
const screenshotLabels = ['TrueJobs mobile app job search interface', 'TrueJobs mobile app job details view', 'TrueJobs mobile app user dashboard'];
const APP_URL = 'https://truejobs.co.in';

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export function AppDownloadSection() {
  const { t } = useLanguage();
  const { isInstallable, isInstalled, isIOS, installApp } = usePWAInstall();
  const [currentScreenshot, setCurrentScreenshot] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Zoom state for pinch-to-zoom
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const paginate = useCallback((newDirection: number) => {
    setDirection(newDirection);
    setCurrentScreenshot((prev) => {
      const next = prev + newDirection;
      if (next < 0) return screenshots.length - 1;
      if (next >= screenshots.length) return 0;
      return next;
    });
    // Reset zoom when changing screenshots
    resetZoom();
  }, []);

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Keyboard navigation for modal
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          paginate(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          paginate(1);
          break;
        case 'Escape':
          e.preventDefault();
          setIsModalOpen(false);
          break;
        case '+':
        case '=':
          e.preventDefault();
          setScale((s) => Math.min(s + 0.5, 3));
          break;
        case '-':
          e.preventDefault();
          setScale((s) => Math.max(s - 0.5, 1));
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
        case 'Home':
          e.preventDefault();
          setDirection(-1);
          setCurrentScreenshot(0);
          resetZoom();
          break;
        case 'End':
          e.preventDefault();
          setDirection(1);
          setCurrentScreenshot(screenshots.length - 1);
          resetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, paginate]);

  // Pinch-to-zoom handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastTouchDistance.current = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchCenter.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const scaleChange = currentDistance / lastTouchDistance.current;
      const newScale = Math.min(Math.max(scale * scaleChange, 1), 3);
      setScale(newScale);
      
      lastTouchDistance.current = currentDistance;

      // Handle panning when zoomed
      if (lastTouchCenter.current && newScale > 1) {
        const currentCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
        setPosition((prev) => ({
          x: prev.x + (currentCenter.x - lastTouchCenter.current!.x),
          y: prev.y + (currentCenter.y - lastTouchCenter.current!.y),
        }));
        lastTouchCenter.current = currentCenter;
      }
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
  };

  // Auto-rotate screenshots (pause on hover or when modal is open)
  useEffect(() => {
    if (isPaused || isModalOpen) return;
    
    const interval = setInterval(() => {
      paginate(1);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPaused, isModalOpen, paginate]);

  const handleDragEnd = (e: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: PanInfo) => {
    const swipe = swipePower(offset.x, velocity.x);

    if (swipe < -swipeConfidenceThreshold) {
      paginate(1);
    } else if (swipe > swipeConfidenceThreshold) {
      paginate(-1);
    }
  };

  const features = [
    t('appDownload.feature1'),
    t('appDownload.feature2'),
    t('appDownload.feature3'),
    t('appDownload.feature4'),
  ];

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast.info(t('appDownload.alreadyInstalled'));
      return;
    }

    if (isIOS) {
      toast.info(t('appDownload.iosInstructions'), {
        duration: 6000,
        description: t('appDownload.iosSteps'),
      });
      return;
    }

    if (isInstallable) {
      const success = await installApp();
      if (success) {
        toast.success(t('appDownload.installSuccess'));
      }
    } else {
      toast.info(t('appDownload.browserInstructions'), {
        duration: 5000,
      });
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <>
      <section className="py-20 bg-gradient-to-br from-primary/10 via-background to-accent/10 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Smartphone className="w-4 h-4" />
                {t('appDownload.badge')}
              </div>

              <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
                {t('appDownload.title')}
              </h2>

              <p className="text-lg text-muted-foreground mb-8">
                {t('appDownload.subtitle')}
              </p>

              {/* Features List */}
              <ul className="space-y-4 mb-8">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Install App Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Google Play Style Button */}
                <Button 
                  size="lg" 
                  className="h-16 px-6 bg-black hover:bg-black/90 text-white rounded-xl"
                  onClick={handleInstallClick}
                >
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92z" fill="#4285F4"/>
                      <path d="M20.25 10.768l-3.521-2.015-3.891 3.247 3.89 3.247 3.522-2.015c.75-.429.75-1.495 0-2.464z" fill="#FBBC04"/>
                      <path d="M3.609 1.814L13.792 12l-3.445 3.232-6.738-3.86V2.734a1 1 0 0 1 .609-.92z" fill="#34A853"/>
                      <path d="M16.729 16.015l-6.382 5.799a1 1 0 0 1-1.35.066L3.61 22.186a.996.996 0 0 1-.61-.92v-.638l6.738-3.86 6.99 -1.753z" fill="#EA4335"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[10px] uppercase tracking-wider opacity-80">
                        {isInstalled ? t('appDownload.installed') : 'Get it on'}
                      </div>
                      <div className="text-xl font-semibold -mt-0.5">
                        Google Play
                      </div>
                    </div>
                  </div>
                </Button>

                {/* App Store Style Button */}
                <Button 
                  size="lg" 
                  className="h-16 px-6 bg-black hover:bg-black/90 text-white rounded-xl"
                  onClick={handleInstallClick}
                >
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[10px] uppercase tracking-wider opacity-80">
                        {isInstalled ? t('appDownload.installed') : 'Download on the'}
                      </div>
                      <div className="text-xl font-semibold -mt-0.5">
                        App Store
                      </div>
                    </div>
                  </div>
                </Button>
              </div>

              {/* Status Badge */}
              {isInstalled && (
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-primary">
                  <CheckCircle className="w-4 h-4" />
                  {t('appDownload.installedMessage')}
                </div>
              )}

              {/* Ratings */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 mt-8 pt-8 border-t border-border">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <span className="font-semibold text-foreground">4.8</span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-semibold text-foreground">100K+</span> {t('appDownload.downloads')}
                  </div>
                </div>
                
                {/* Social Sharing Icons */}
                <div className="flex items-center gap-3 sm:ml-auto">
                  <span className="text-sm text-muted-foreground mr-1">Follow us:</span>
                  <a 
                    href="https://facebook.com/truejobsindia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                    aria-label="Follow us on Facebook"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                  <a 
                    href="https://instagram.com/truejobsindia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                    aria-label="Follow us on Instagram"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                  <a 
                    href="https://twitter.com/truejobsindia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-[#1DA1F2] flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                    aria-label="Follow us on Twitter"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                  <a 
                    href="https://linkedin.com/company/truejobs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-[#0A66C2] flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                    aria-label="Follow us on LinkedIn"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                  <a 
                    href="https://youtube.com/@truejobsindia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-[#FF0000] flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                    aria-label="Follow us on YouTube"
                  >
                    <Youtube className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right Content - Phone Mockup with Carousel */}
            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative">
                {/* Decorative elements */}
                <div className="absolute -top-8 -left-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
                
                {/* Phone Frame with Animated Screenshots */}
                <div 
                  className="relative z-10 cursor-pointer group"
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                  onClick={() => setIsModalOpen(true)}
                >
                  {/* Phone Frame */}
                  <div className="relative w-72 lg:w-80">
                    {/* Phone Bezel */}
                    <div className="relative bg-black rounded-[3rem] p-2 shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]">
                      {/* Screen with Notch */}
                      <div className="relative bg-black rounded-[2.5rem] overflow-hidden">
                        {/* Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-20" />
                        
                        {/* Screenshot Carousel with Swipe */}
                        <motion.div 
                          className="relative aspect-[9/19.5] overflow-hidden rounded-[2.5rem]"
                          whileTap={{ cursor: 'grabbing' }}
                        >
                          <AnimatePresence initial={false} custom={direction}>
                            <motion.img
                              key={currentScreenshot}
                              src={screenshots[currentScreenshot]}
                              alt={screenshotLabels[currentScreenshot]}
                              className="absolute inset-0 w-full h-full object-cover"
                              custom={direction}
                              variants={variants}
                              initial="enter"
                              animate="center"
                              exit="exit"
                              transition={{
                                x: { type: 'spring', stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 },
                              }}
                              drag="x"
                              dragConstraints={{ left: 0, right: 0 }}
                              dragElastic={1}
                              onDragEnd={handleDragEnd}
                            />
                          </AnimatePresence>
                          
                          {/* Zoom hint overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 rounded-full p-3">
                              <ZoomIn className="w-6 h-6 text-black" />
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                    
                    {/* Home Indicator */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
                  </div>

                  {/* Swipe hint */}
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/80 px-2 py-1 rounded-full">
                    <ChevronLeft className="w-3 h-3" />
                    Swipe or tap to preview
                    <ChevronRight className="w-3 h-3" />
                  </div>

                  {/* Carousel Indicators */}
                  <div className="flex justify-center gap-2 mt-4">
                    {screenshots.map((_, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDirection(index > currentScreenshot ? 1 : -1);
                          setCurrentScreenshot(index);
                        }}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          index === currentScreenshot 
                            ? 'bg-primary w-6' 
                            : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* QR Code Card */}
                <motion.div 
                  className="absolute -right-4 lg:-right-16 top-1/2 -translate-y-1/2 bg-background rounded-2xl shadow-xl p-4 z-20 hidden md:block"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="text-center mb-3">
                    <div className="flex items-center gap-1.5 justify-center text-sm font-medium text-foreground mb-1">
                      <ScanLine className="w-4 h-4 text-primary" />
                      Scan to Install
                    </div>
                    <p className="text-xs text-muted-foreground">Point camera at code</p>
                  </div>
                  
                  <div className="bg-white p-2 rounded-lg">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(APP_URL)}&bgcolor=ffffff&color=000000&margin=0`}
                      alt="Scan QR code to install TrueJobs mobile app"
                      className="w-28 h-28"
                    />
                  </div>
                  
                  <div className="mt-2 text-center">
                    <span className="text-[10px] text-muted-foreground">Works on iOS & Android</span>
                  </div>
                </motion.div>

                {/* Floating badges */}
                <motion.div 
                  className="absolute top-10 -left-4 bg-background rounded-xl shadow-lg p-3 z-20"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{t('appDownload.freeDownload')}</span>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="absolute bottom-20 -left-4 bg-background rounded-xl shadow-lg p-3 z-20"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{t('appDownload.instantAlerts')}</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fullscreen Preview Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black/95 border-none">
          <div className="relative w-full h-full flex flex-col">
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Screenshot title */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
              <span className="text-white/80 text-sm font-medium bg-white/10 px-4 py-2 rounded-full">
                {screenshotLabels[currentScreenshot]}
              </span>
            </div>

            {/* Main carousel area */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
              {/* Navigation arrows */}
              <button
                onClick={() => paginate(-1)}
                className="absolute left-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Previous screenshot"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
              
              <button
                onClick={() => paginate(1)}
                className="absolute right-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Next screenshot"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>

              {/* Zoom controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/50 rounded-full px-3 py-2">
                <button
                  onClick={() => setScale((s) => Math.max(s - 0.5, 1))}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
                  disabled={scale <= 1}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-5 h-5 text-white" />
                </button>
                <span className="text-white text-sm min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(s + 0.5, 3))}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
                  disabled={scale >= 3}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-5 h-5 text-white" />
                </button>
                {scale > 1 && (
                  <button
                    onClick={resetZoom}
                    className="p-1.5 rounded-full hover:bg-white/20 transition-colors ml-1"
                    aria-label="Reset zoom"
                  >
                    <RotateCcw className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>

              {/* Phone mockup in modal with pinch-to-zoom */}
              <div 
                ref={imageContainerRef}
                className="relative w-72 sm:w-80 md:w-96 touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <motion.div 
                  className="relative bg-black rounded-[3rem] p-2 shadow-2xl border border-white/10"
                  animate={{ 
                    scale,
                    x: position.x,
                    y: position.y,
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <div className="relative bg-black rounded-[2.5rem] overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-20" />
                    
                    <motion.div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.5rem]">
                      <AnimatePresence initial={false} custom={direction}>
                        <motion.img
                          key={currentScreenshot}
                          src={screenshots[currentScreenshot]}
                          alt={screenshotLabels[currentScreenshot]}
                          className="absolute inset-0 w-full h-full object-cover"
                          custom={direction}
                          variants={variants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{
                            x: { type: 'spring', stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 },
                          }}
                          drag={scale > 1 ? false : "x"}
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={1}
                          onDragEnd={scale > 1 ? undefined : handleDragEnd}
                        />
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </motion.div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="hidden md:flex items-center justify-center gap-4 py-2 text-white/40 text-xs">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded">←</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded">→</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded">+</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded">-</kbd>
                Zoom
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded">0</kbd>
                Reset
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd>
                Close
              </span>
            </div>

            {/* Thumbnail navigation */}
            <div className="p-6 flex justify-center gap-4">
              {screenshots.map((screenshot, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setDirection(index > currentScreenshot ? 1 : -1);
                    setCurrentScreenshot(index);
                    resetZoom();
                  }}
                  className={`relative rounded-xl overflow-hidden transition-all duration-300 ${
                    index === currentScreenshot 
                      ? 'ring-2 ring-primary scale-105' 
                      : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  <img 
                    src={screenshot} 
                    alt={screenshotLabels[index]}
                    className="w-16 h-28 object-cover"
                  />
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded">
                    {screenshotLabels[index]}
                  </span>
                </button>
              ))}
            </div>

            {/* Install CTA in modal */}
            <div className="p-4 border-t border-white/10 flex justify-center">
              <Button 
                size="lg"
                className="bg-primary hover:bg-primary/90"
                onClick={() => {
                  setIsModalOpen(false);
                  handleInstallClick();
                }}
              >
                <Download className="w-5 h-5 mr-2" />
                Install App Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
