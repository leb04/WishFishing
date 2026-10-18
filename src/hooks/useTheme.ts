import { useEffect, useState } from "react";
import type { ThemePreference } from "../types/picker";

const query = "(prefers-color-scheme: dark)";

export function useTheme(preference: ThemePreference) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const changed = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const theme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return theme;
}
