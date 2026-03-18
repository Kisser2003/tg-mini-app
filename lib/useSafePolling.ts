"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseSafePollingOptions<T> = {
  enabled: boolean;
  intervalMs: number;
  load: () => Promise<T>;
  initialData: T;
};

export function useSafePolling<T>({
  enabled,
  intervalMs,
  load,
  initialData
}: UseSafePollingOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestSeq = useRef(0);
  const inFlight = useRef(false);

  const run = useCallback(
    async (silent = false) => {
      if (!enabled || inFlight.current) return;

      inFlight.current = true;
      const seq = ++requestSeq.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const next = await load();
        if (seq === requestSeq.current) {
          setData(next);
        }
      } catch (e: any) {
        if (seq === requestSeq.current) {
          setError(e?.message ?? "Не удалось загрузить данные.");
        }
      } finally {
        if (seq === requestSeq.current) {
          if (silent) setRefreshing(false);
          else setLoading(false);
        }
        inFlight.current = false;
      }
    },
    [enabled, load]
  );

  useEffect(() => {
    if (!enabled) {
      requestSeq.current += 1;
      setData(initialData);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      inFlight.current = false;
      return;
    }

    void run(false);
    const timer = window.setInterval(() => {
      void run(true);
    }, intervalMs);

    return () => {
      requestSeq.current += 1;
      inFlight.current = false;
      window.clearInterval(timer);
    };
  }, [enabled, initialData, intervalMs, run]);

  return { data, loading, refreshing, error, reload: run };
}

