import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { ReadingHistory } from "../types";
import { prepareReadingSession, StaleReadingSessionError } from "../utils/readingSession";

type EntryOptions = Omit<NonNullable<Parameters<typeof prepareReadingSession>[1]>, "signal">;

interface EntryState {
  openingPath: string | null;
  error: { path: string; message: string } | null;
}

/** Own the lifetime of a reading entry, including its session writes and navigation. */
export function useReadingSessionEntry() {
  const navigate = useNavigate();
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<EntryState>({ openingPath: null, error: null });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
      request.current = null;
    };
  }, []);

  const isMounted = useCallback(() => mounted.current, []);

  const clearError = useCallback(() => {
    if (mounted.current) setState((current) => current.error ? { ...current, error: null } : current);
  }, []);

  const cancel = useCallback(() => {
    const controller = request.current;
    if (!controller) return;
    request.current = null;
    controller.abort();
    if (mounted.current) setState((current) => ({ ...current, openingPath: null }));
  }, []);

  const run = useCallback(async (history: ReadingHistory, options: EntryOptions = {}) => {
    if (!mounted.current || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () => mounted.current && request.current === controller && !controller.signal.aborted;
    setState({ openingPath: history.folderPath, error: null });
    try {
      const target = await prepareReadingSession(history, { ...options, signal: controller.signal });
      if (isCurrent()) await navigate(target);
    } catch (cause) {
      if (isCurrent() && !(cause instanceof StaleReadingSessionError)) {
        setState((current) => ({ ...current, error: {
          path: history.folderPath,
          message: cause instanceof Error ? cause.message : "暂时无法打开章节，请重试。",
        } }));
      }
    } finally {
      if (isCurrent()) {
        request.current = null;
        setState((current) => ({ ...current, openingPath: null }));
      }
    }
  }, [navigate]);

  return { ...state, run, clearError, cancel, isMounted };
}
