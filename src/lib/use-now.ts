"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed on an interval so relative labels ("5 minutes ago") stay true. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
