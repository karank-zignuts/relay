"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const CHANGE_EVENT = "relay:persisted-change";

/**
 * A boolean or number remembered in localStorage. Server render and first client render use `initial`,
 * so there is no hydration mismatch, then the saved value takes over.
 */
export function usePersisted<T extends boolean | number>(key: string, initial: T): [T, (next: T) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(CHANGE_EVENT, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(CHANGE_EVENT, notify);
    };
  }, []);

  const read = useCallback((): T => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return initial;
      return (typeof initial === "boolean" ? saved === "1" : Number(saved)) as T;
    } catch {
      return initial; // storage can be unavailable (private window)
    }
  }, [key, initial]);

  const value = useSyncExternalStore(subscribe, read, () => initial);

  const write = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, typeof next === "boolean" ? (next ? "1" : "0") : String(next));
      } catch {
        // The preference just will not persist.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return [value, write];
}

/** A list of strings remembered in localStorage (hidden table columns). Same no-mismatch behaviour as `usePersisted`. */
export function usePersistedList(key: string, initial: readonly string[]): [string[], (next: string[]) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(CHANGE_EVENT, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(CHANGE_EVENT, notify);
    };
  }, []);

  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const value = useMemo(() => {
    if (raw === null) return [...initial];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [...initial];
    } catch {
      return [...initial];
    }
  }, [raw, initial]);

  const write = useCallback(
    (next: string[]) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // The preference just will not persist.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return [value, write];
}
