import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Search, Zap, Target, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AISearchAnimationProps {
  isSearching: boolean;
  onComplete?: () => void;
}

const searchSteps = [
  { icon: Search, text: 'Analyzing search criteria...', duration: 600 },
  { icon: Brain, text: 'Processing with AI...', duration: 800 },
  { icon: Sparkles, text: 'Matching skills & preferences...', duration: 700 },
  { icon: Target, text: 'Finding best opportunities...', duration: 600 },
  { icon: CheckCircle2, text: 'Results ready!', duration: 400 },
];

export function AISearchAnimation({ isSearching, onComplete }: AISearchAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isSearching) {
      setIsVisible(true);
      setCurrentStep(0);
      setProgress(0);

      let stepIndex = 0;
      const progressPerStep = 100 / searchSteps.length;

      const runSteps = () => {
        if (stepIndex < searchSteps.length) {
          setCurrentStep(stepIndex);
          setProgress((stepIndex + 1) * progressPerStep);
          
          setTimeout(() => {
            stepIndex++;
            runSteps();
          }, searchSteps[stepIndex].duration);
        } else {
          setTimeout(() => {
            setIsVisible(false);
            onComplete?.();
          }, 300);
        }
      };

      runSteps();
    }
  }, [isSearching, onComplete]);

  const CurrentIcon = searchSteps[currentStep]?.icon || Search;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
          >
            {/* AI Brain Animation */}
            <div className="relative flex justify-center mb-6">
              {/* Outer pulsing rings */}
              <motion.div
                className="absolute w-32 h-32 rounded-full border-2 border-primary/20"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.2, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="absolute w-24 h-24 rounded-full border-2 border-primary/30"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.6, 0.3, 0.6],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.2,
                }}
              />
              
              {/* Central icon */}
              <motion.div
                className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg"
                animate={{
                  boxShadow: [
                    '0 0 20px hsl(var(--primary) / 0.3)',
                    '0 0 40px hsl(var(--primary) / 0.5)',
                    '0 0 20px hsl(var(--primary) / 0.3)',
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <motion.div
                  key={currentStep}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CurrentIcon className="h-10 w-10 text-primary-foreground" />
                </motion.div>
              </motion.div>

              {/* Floating particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-primary/60"
                  style={{
                    left: '50%',
                    top: '50%',
                  }}
                  animate={{
                    x: [0, Math.cos((i * 60 * Math.PI) / 180) * 60, 0],
                    y: [0, Math.sin((i * 60 * Math.PI) / 180) * 60, 0],
                    opacity: [0, 1, 0],
                    scale: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            {/* Status Text */}
            <div className="text-center mb-6">
              <motion.div
                className="flex items-center justify-center gap-2 mb-2"
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Zap className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-lg font-medium">{searchSteps[currentStep]?.text}</span>
              </motion.div>
              <p className="text-sm text-muted-foreground">
                AI is finding the perfect jobs for you
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Step indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {searchSteps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index <= currentStep ? 'bg-primary w-4' : 'bg-muted w-2'
                  }`}
                  animate={{
                    width: index <= currentStep ? 16 : 8,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
