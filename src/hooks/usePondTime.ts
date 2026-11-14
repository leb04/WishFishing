import { useEffect, useState } from "react";
import type { SceneTheme } from "../scenes/config";

export const POND_TIMES = ["dawn", "day", "dusk", "night"] as const;
export type PondTime = (typeof POND_TIMES)[number];
export type PondTimePreference = "appearance" | "local" | PondTime;

const STORAGE_KEY = "wishfishing:pond-time";

export function pondTimeAt(hour: number): PondTime {
  if (hour < 5 || hour >= 19) return "night";
  if (hour < 7) return "dawn";
  if (hour < 17) return "day";
  return "dusk";
}

function readPreference(developerMode: boolean): PondTimePreference {
  if (!developerMode) {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === "local") return value;
      const manual = POND_TIMES.find(time => time === value);
      if (manual) return manual;
    } catch { /* Use the appearance default if storage is unavailable. */ }
  }
  return "appearance";
}

export function usePondTime(theme: SceneTheme, developerMode: boolean, playing: boolean) {
  const [preference, setPreference] = useState(() => readPreference(developerMode));
  const [localTime, setLocalTime] = useState(() => pondTimeAt(new Date().getHours()));

  useEffect(() => {
    if (preference !== "local" || playing) return;
    const update = () => setLocalTime(pondTimeAt(new Date().getHours()));
    update();
    const timer = window.setInterval(update, 5000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [preference, playing]);

  const time = preference === "appearance" ? (theme === "light" ? "day" : "night")
    : preference === "local" ? localTime : preference;

  return {
    preference,
    time,
    select(value: PondTimePreference) {
      setPreference(value);
      if (value === "local") setLocalTime(pondTimeAt(new Date().getHours()));
      if (!developerMode) {
        try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Keep the preference for this session. */ }
      }
    },
  };
}
