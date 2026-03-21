"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { debugInit } from "@/lib/debug";
import { USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";

type UseSafePollingOptions<T> = {
  enabled: boolean;
  intervalMs: number;
  load: () => Promise<T>;
  initialData: T;
  requestTimeoutMs?: number;
  debugName?: string;
};

export function useSafePolling<T>({
  enabled,
  intervalMs,
  load,
  initialData,
  requestTimeoutMs = 15000,
  debugName = "useSafePolling"
}: UseSafePollingOptions<T>) {
  const [data, setData] = useState<T>(() => initialData);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestSeq = useRef(0);
  const inFlight = useRef(false);
  const initialDataRef = useRef(initialData);

  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  const run = useCallback(
    async (silent = false) => {
      if (!enabled) return;
      if (inFlight.current) {
        debugInit(debugName, "skip run: request already in flight");
        return;
      }

      inFlight.current = true;
      const seq = ++requestSeq.current;
      const startedAt = Date.now();
      let timeoutId: number | null = null;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      debugInit(debugName, "run started", { seq, silent });

      try {
        const loadPromise = load();
        // Avoid noisy unhandled rejection if timeout wins Promise.race.
        loadPromise.catch(() => {});
        const timeoutPromise = new Promise<T>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error(USER_REQUEST_TIMEOUT_MESSAGE));
          }, requestTimeoutMs);
        });
        const next = await Promise.race([loadPromise, timeoutPromise]);
        if (timeoutId != null) window.clearTimeout(timeoutId);
        if (seq === requestSeq.current) {
          setData(next);
          debugInit(debugName, "run success", {
            seq,
            durationMs: Date.now() - startedAt
          });
        }
      } catch (e: any) {
        if (timeoutId != null) window.clearTimeout(timeoutId);
        if (seq === requestSeq.current) {
          setError(e?.message ?? "Не удалось загрузить данные.");
          console.error(`[${debugName}] run failed`, e);
        }
      } finally {
        if (seq === requestSeq.current) {
          if (silent) setRefreshing(false);
          else setLoading(false);
        }
        inFlight.current = false;
        debugInit(debugName, "run finished", {
          seq,
          silent,
          durationMs: Date.now() - startedAt
        });
      }
    },
    [debugName, enabled, load, requestTimeoutMs]
  );

  useEffect(() => {
    if (!enabled) {
      requestSeq.current += 1;
      setData(initialDataRef.current);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      inFlight.current = false;
      debugInit(debugName, "polling disabled, state reset");
      return;
    }

    debugInit(debugName, "polling enabled", { intervalMs, requestTimeoutMs });
    void run(false);
    const timer = window.setInterval(() => {
      void run(true);
    }, intervalMs);

    return () => {
      requestSeq.current += 1;
      inFlight.current = false;
      window.clearInterval(timer);
      debugInit(debugName, "polling cleanup");
    };
  }, [debugName, enabled, intervalMs, requestTimeoutMs, run]);

  return { data, loading, refreshing, error, reload: run };
}

