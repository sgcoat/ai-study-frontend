import { useEffect, useState } from 'react';

export interface CodeTiming { expiresAt: number; resendAt: number }
export function codeTiming(expiresInSeconds = 300, resendAfterSeconds = 60): CodeTiming {
  const now = Date.now();
  return { expiresAt: now + expiresInSeconds * 1000, resendAt: now + resendAfterSeconds * 1000 };
}
export function useCodeTimer(timing: CodeTiming | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!timing) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [timing]);
  return {
    expiresIn: timing ? Math.max(0, Math.ceil((timing.expiresAt - now) / 1000)) : 0,
    resendIn: timing ? Math.max(0, Math.ceil((timing.resendAt - now) / 1000)) : 0,
  };
}
