import { useState, useEffect, useRef } from 'react';
import { getPhaseDuration } from '@/lib/timerConfig';

interface UsePhaseTimerOptions {
  gameType: string;
  status: string;
  startedAt: string | null;
  isDuel?: boolean;
  onExpired?: () => void;
}

/**
 * Returns remaining seconds for the current phase, computed from
 * the server-side started_at timestamp. Calls onExpired once when it hits 0.
 */
export function usePhaseTimer({ gameType, status, startedAt, isDuel = false, onExpired }: UsePhaseTimerOptions) {
  const duration = getPhaseDuration(gameType, status, isDuel);
  const [remaining, setRemaining] = useState<number | null>(null);
  const expiredCalled = useRef(false);

  useEffect(() => {
    expiredCalled.current = false;
  }, [status, startedAt]);

  useEffect(() => {
    if (duration === null || !startedAt) {
      setRemaining(null);
      return;
    }

    const calculate = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);

      if (left === 0 && !expiredCalled.current) {
        expiredCalled.current = true;
        onExpired?.();
      }
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [duration, startedAt, status, onExpired]);

  return { remaining, duration };
}
