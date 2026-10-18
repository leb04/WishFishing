import { Component, lazy, Suspense, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PondPlaceholder } from "./PondPlaceholder";
import { useSceneActivity } from "../hooks/useSceneActivity";
import type { SceneTheme } from "../scenes/config";

const FishingScene = lazy(() => import("../scenes/FishingScene"));

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <PondPlaceholder /> : this.props.children; }
}

export function PondView({ theme, suspended }: { theme: SceneTheme; suspended: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const { reducedMotion, animate } = useSceneActivity(host, suspended, paused);
  const onFailure = useCallback(() => setFailed(true), []);
  const fallback = still || failed;

  return <>
    <div ref={host} className="scene-viewport" aria-hidden="true" data-render-mode={fallback ? "still" : animate ? "animated" : "on-demand"}>
      {fallback ? <PondPlaceholder /> : (
        <SceneBoundary onFailure={onFailure}>
          <Suspense fallback={<PondPlaceholder />}>
            <FishingScene theme={theme} animate={animate} onFailure={onFailure} />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
    <div className="scene-tools" aria-label="Pond view controls">
      {!fallback && <button type="button" className="secondary-button" disabled={reducedMotion} aria-pressed={paused || reducedMotion} onClick={() => setPaused(!paused)}>
        {reducedMotion ? "Motion reduced" : paused ? "Resume motion" : "Pause motion"}
      </button>}
      <button type="button" className="secondary-button" aria-pressed={fallback} onClick={() => { setStill(!fallback); setFailed(false); }}>
        {fallback ? "Use 3D view" : "Use still view"}
      </button>
    </div>
    {fallback && <div className="scene-status" role="status">
      <span aria-hidden="true">⌁</span>
      <p>{failed ? "A still pond, the same possibilities." : "A little stillness."}</p>
      <small>{failed ? "The 3D view couldn’t load. You can still cast a name." : "Your name picker works just the same."}</small>
    </div>}
  </>;
}
