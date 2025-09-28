import { useEffect, useRef, useState } from 'react';

export interface UseTypeStreamOptions {
  text: string;
  active: boolean;
  /** Approximate characters per second */
  speed?: number;
  /** Max characters appended per frame (simulates token bursts) */
  chunk?: number;
  onProgress?: (partial: string) => void;
  onDone?: () => void;
}

/**
 * useTypeStream – unified streaming typewriter effect used across pages.
 * Adds small chunk bursts for a more LLM-like feel (vs single char ticks).
 */
export function useTypeStream(opts: UseTypeStreamOptions): [string, boolean] {
  const { text, active, speed = 70, chunk = 2, onProgress, onDone } = opts;
  const [out, setOut] = useState('');
  const doneRef = useRef(false);
  const textRef = useRef(text);
  const progressRef = useRef(onProgress);
  const doneCbRef = useRef(onDone);
  // update refs without triggering effect
  progressRef.current = onProgress;
  doneCbRef.current = onDone;
  textRef.current = text;

  useEffect(() => {
    if (!active) {
      // only clear if we were previously active
      if (doneRef.current || out) {
        setOut('');
        doneRef.current = false;
      }
      return;
    }
    // restart only when text changes or activation flips from false->true
    setOut('');
    doneRef.current = false;
    let i = 0;
    const total = textRef.current.length;
    if (total === 0) {
      doneRef.current = true;
      return;
    }
    const interval = speed > 0 ? 1000 / speed : 16;
    let cancelled = false;

    function step() {
      if (cancelled) return;
      if (i >= total) {
        if (!doneRef.current) {
          doneRef.current = true;
          doneCbRef.current && doneCbRef.current();
        }
        return;
      }
      const take = Math.min(chunk, total - i);
      i += take;
      const slice = textRef.current.slice(0, i);
      setOut(slice);
      progressRef.current && progressRef.current(slice);
      setTimeout(step, interval);
    }
    step();
    return () => { cancelled = true; };
  }, [text, active, speed, chunk]);

  return [out, doneRef.current];
}
