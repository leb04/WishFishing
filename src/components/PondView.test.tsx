import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "../hooks/useTheme";
import { FishingLifecycle, type FishingPhase } from "../lib/cinematic";
import { PondView } from "./PondView";

function SystemPond({ phase }: { phase: FishingPhase }) {
  const theme = useTheme("system");
  return <PondView theme={theme} suspended={phase === "RESULT"} developerMode
    lifecycle={new FishingLifecycle()} phase={phase} soundEnabled={false}
    onToggleSound={() => {}} fullscreen={false} onToggleFullscreen={() => {}}>
    {null}
  </PondView>;
}

describe("pond lighting in System appearance", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["light", "dark"])("keeps system %s lighting during the draw", (scheme) => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: scheme === "dark" }) });
    vi.stubGlobal("document", { fullscreenEnabled: false });

    for (const phase of ["IDLE", "CASTING", "REELING", "REVEALING", "RESULT"] as const) {
      const markup = renderToStaticMarkup(<SystemPond phase={phase} />);
      expect(markup, phase).toContain(`data-pond-time="${scheme}"`);
    }
  });
});
