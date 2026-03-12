import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AuthPageTransitionProps {
  children: ReactNode;
}

export function AuthPageTransition({ children }: AuthPageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.4, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
