import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { shouldAnimateScene } from "../scenes/config";

function subscribeVisibility(changed: () => void) {
  document.addEventListener("visibilitychange", changed);
  return () => document.removeEventListener("visibilitychange", changed);
}

function getVisibility() { return !document.hidden; }

export function useMediaQuery(query: string) {
  const subscribe = useCallback((changed: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

export function useSceneActivity(host: RefObject<HTMLDivElement | null>, suspended: boolean, paused: boolean) {
  const visible = useSyncExternalStore(subscribeVisibility, getVisibility, () => true);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [host]);
  return {
    reducedMotion,
    animate: shouldAnimateScene({ visible, inView, suspended, reducedMotion, paused }),
  };
}
