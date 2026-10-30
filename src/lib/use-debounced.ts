"use client";

import { useEffect, useState } from "react";

/** The value, but only after it has stopped changing for `delay` ms. Keeps typing in a search box from firing a request per key. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
