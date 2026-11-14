import { Component, lazy, Suspense, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PondPlaceholder } from "./PondPlaceholder";
import { useSceneActivity } from "../hooks/useSceneActivity";
import { POND_TIMES, usePondTime, type PondTimePreference } from "../hooks/usePondTime";
import type { SceneLighting, SceneTheme } from "../scenes/config";

const FishingScene = lazy(() => import("../scenes/FishingScene"));

const TIME_LABELS = { dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night" };

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void; lighting: SceneLighting }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <PondPlaceholder lighting={this.props.lighting} /> : this.props.children; }
}

export function PondView({ theme, suspended }: { theme: SceneTheme; suspended: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const { reducedMotion, animate } = useSceneActivity(host, suspended, paused);
  const onFailure = useCallback(() => setFailed(true), []);
  const fallback = still || failed;
  const { preference, time, select } = usePondTime(theme, false, suspended);
  const lighting = time === "day" ? "light" : time === "night" ? "dark" : time;

  return <>
    <div ref={host} className="scene-viewport" aria-hidden="true" data-render-mode={fallback ? "still" : animate ? "animated" : "on-demand"}>
      {fallback ? <PondPlaceholder lighting={lighting} /> : (
        <SceneBoundary onFailure={onFailure} lighting={lighting}>
          <Suspense fallback={<PondPlaceholder lighting={lighting} />}>
            <FishingScene theme={lighting} animate={animate} onFailure={onFailure} />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
    <div className="scene-tools" aria-label="Pond view controls">
      <select className="pond-time-select" aria-label="Pond time" value={preference}
        onChange={event => select(event.target.value as PondTimePreference)}>
        <option value="appearance">Match appearance</option>
        <option value="local">Local time{preference === "local" ? ` · ${TIME_LABELS[time]}` : ""}</option>
        {POND_TIMES.map(mode => <option key={mode} value={mode}>{TIME_LABELS[mode]}</option>)}
      </select>
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
