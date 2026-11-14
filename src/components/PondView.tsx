import { Component, lazy, useEffect, Suspense, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ControlIcon } from "./ControlIcon";
import { PondPlaceholder } from "./PondPlaceholder";
import { useSceneActivity } from "../hooks/useSceneActivity";
import { POND_TIMES, usePondTime, type PondTimePreference } from "../hooks/usePondTime";
import type { SceneLighting, SceneTheme } from "../scenes/config";

import { isFishing } from "../lib/cinematic";
import type { FishingLifecycle, FishingPhase } from "../lib/cinematic";

const FishingScene = lazy(() => import("../scenes/FishingScene"));
const TIME_LABELS = { dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night" };
const STILL_VIEW_KEY = "wishfishing:still-view";

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void; lighting: SceneLighting }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <PondPlaceholder lighting={this.props.lighting} /> : this.props.children; }
}

export function PondView({ theme, suspended, developerMode, lifecycle, phase, soundEnabled, onToggleSound, fullscreen, onToggleFullscreen, children }: {
  theme: SceneTheme; suspended: boolean; developerMode: boolean; lifecycle: FishingLifecycle; phase: FishingPhase; soundEnabled: boolean; onToggleSound: () => void;
  fullscreen: boolean; onToggleFullscreen: () => void; children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const [still, setStill] = useState(() => {
    if (!developerMode) {
      try { return localStorage.getItem(STILL_VIEW_KEY) === "on"; } catch { /* Use 3D by default. */ }
    }
    return false;
  });
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const { reducedMotion, animate } = useSceneActivity(host, suspended, paused);
  const onFailure = useCallback(() => {
    setReady(false);
    setFailed(true);
  }, []);
  const fallback = still || failed;
  const busy = isFishing(phase);
  const { preference, time, select } = usePondTime(theme, developerMode, busy || suspended);
  const lighting = preference === "appearance" && (busy || suspended) ? "dark"
    : time === "day" ? "light" : time === "night" ? "dark" : time;
  useEffect(() => { if (busy && (fallback || !ready || paused)) lifecycle.skip(); }, [busy, fallback, ready, paused, lifecycle]);

  function toggleStillView() {
    const next = !fallback;
    setReady(false);
    setStill(next);
    setFailed(false);
    if (!developerMode) {
      try { localStorage.setItem(STILL_VIEW_KEY, next ? "on" : "off"); } catch { /* Keep the setting for this session. */ }
    }
  }

  return <>
    <div className="pond-header">
      <h2 id="pond-title">The wishing pond</h2>
      <div className="scene-tools" role="group" aria-label="Pond view controls">
        <label className="toolbar-select pond-time-control" hidden={busy}>
          <ControlIcon name="clock" />
          <span aria-hidden="true">Pond time</span>
          <select className="pond-time-select" aria-label="Pond time" value={preference}
            onChange={event => select(event.target.value as PondTimePreference)}>
            <option value="appearance">Match appearance</option>
            <option value="local">Local time{preference === "local" ? ` · ${TIME_LABELS[time]}` : ""}</option>
            {POND_TIMES.map(mode => <option key={mode} value={mode}>{TIME_LABELS[mode]}</option>)}
          </select>
        </label>
        <div className="scene-actions">
          <button hidden={busy} type="button" aria-label="Sound effects" title={soundEnabled ? "Mute sound" : "Unmute sound"}
            aria-pressed={soundEnabled} onClick={onToggleSound}>
            <ControlIcon name={soundEnabled ? "sound" : "mute"} />
          </button>
          {!fallback && <button hidden={busy} type="button" aria-label={reducedMotion ? "Motion reduced" : "Pause motion"}
            title={reducedMotion ? "Motion reduced" : paused ? "Resume motion" : "Pause motion"}
            disabled={reducedMotion} aria-pressed={paused || reducedMotion} onClick={() => setPaused(!paused)}>
            <ControlIcon name={paused || reducedMotion ? "play" : "pause"} />
          </button>}
          <button hidden={busy} type="button" aria-label="Still view" title={fallback ? "Use 3D view" : "Use still view"}
            aria-pressed={fallback} onClick={toggleStillView}>
            <ControlIcon name={fallback ? "scene" : "still"} />
          </button>
          {document.fullscreenEnabled && <button type="button" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={onToggleFullscreen}>
            <ControlIcon name={fullscreen ? "shrink" : "expand"} />
          </button>}
        </div>
      </div>
    </div>
    <div className="pond-frame">
      <div ref={host} className="scene-viewport" aria-hidden="true" data-pond-time={lighting} data-render-mode={fallback ? "still" : (animate || busy) ? "animated" : "on-demand"}>
        {fallback ? <PondPlaceholder lighting={lighting} /> : (
          <SceneBoundary onFailure={onFailure} lighting={lighting}>
            <Suspense fallback={<PondPlaceholder lighting={lighting} />}>
              <FishingScene theme={lighting} animate={animate || busy} onFailure={onFailure} onReady={onReady} pose={lifecycle.pose} busy={busy || (phase === "RESULT" && lifecycle.pose.reveal === 1)} phase={phase} school={lifecycle.school} decoys={lifecycle.decoys} attempt={lifecycle.attempt}
                keepCamera={lifecycle.keepCamera} />
            </Suspense>
          </SceneBoundary>
        )}
      </div>
      {fallback && !busy && <p className="scene-status" role="status">
        {failed ? "3D view unavailable. You can still cast." : "Still view"}
      </p>}
      {children}
    </div>
  </>;
}
