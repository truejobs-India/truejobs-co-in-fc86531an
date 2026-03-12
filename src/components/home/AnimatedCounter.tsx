import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  formatAsCurrency?: boolean;
}

export function AnimatedCounter({ 
  value, 
  suffix = '', 
  prefix = '',
  duration = 2,
  formatAsCurrency = false
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [hasAnimated, setHasAnimated] = useState(false);

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const display = useTransform(spring, (current) => {
    const rounded = Math.round(current);
    if (formatAsCurrency) {
      if (rounded >= 100000) {
        return `${(rounded / 100000).toFixed(1)}L`;
      }
      if (rounded >= 1000) {
        return `${(rounded / 1000).toFixed(0)}K`;
      }
    }
    return rounded.toLocaleString('en-IN');
  });

  useEffect(() => {
    if (isInView && !hasAnimated) {
      spring.set(value);
      setHasAnimated(true);
    }
  }, [isInView, value, spring, hasAnimated]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}
