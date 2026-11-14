import { useCallback, useEffect, useState } from 'react';
import { addAfterEffect, useThree } from '@react-three/fiber';
import FishingScene from '../scenes/FishingScene';
import { restingPose } from '../lib/cinematic';
import { loadState } from '../lib/storage';
import { useTheme } from '../hooks/useTheme';
import type { SceneTheme } from '../scenes/config';
import type { ThemePreference } from '../types/picker';
import './EnvironmentCapture.css';

const sceneReady = () => {};

function CaptureExport({ theme, onReady }: { theme: SceneTheme; onReady: () => void }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    let requested = false;
    let ready = false;
    const link = document.createElement('a');
    link.hidden = true;
    link.download = `wishfishing-${theme === 'light' ? 'daylight' : 'moonlit'}-reference.png`;
    document.body.appendChild(link);
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'p' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      event.preventDefault();
      requested = true;
      invalidate();
    };
    // Read the WebGL canvas directly after a rendered frame. This avoids enabling
    // preserveDrawingBuffer or changing renderer settings/materials for exports.
    const remove = addAfterEffect(() => {
      if (!ready && scene.getObjectByName('kenney-nature')) { ready = true; onReady(); }
      if (!requested || !ready) return;
      requested = false;
      const output = document.createElement('canvas');
      output.width = 1920;
      output.height = 1080;
      const context = output.getContext('2d');
      if (!context) return;
      context.drawImage(gl.domElement, 0, 0, output.width, output.height);
      link.href = output.toDataURL('image/png');
      link.click();
    });
    document.addEventListener('keydown', key);
    return () => { remove(); link.remove(); document.removeEventListener('keydown', key); };
  }, [gl, scene, invalidate, theme, onReady]);
  return null;
}

/** Isolated reference-image utility. It never mounts App or starts a fishing draw. */
export default function EnvironmentCapture() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const requested = new URLSearchParams(window.location.search).get('theme');
    return requested === 'light' || requested === 'dark' || requested === 'system'
      ? requested : loadState().state.theme;
  });
  const theme = useTheme(preference);
  const [pose] = useState(restingPose);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => setFailed(true), []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.key.toLowerCase() === 'd') setPreference('light');
      if (event.key.toLowerCase() === 'n') setPreference('dark');
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  return <div className="environment-capture" tabIndex={0} data-capture-theme={theme} data-capture-ready={ready && !failed} data-capture-failed={failed}>
    <div className="environment-capture-frame">
      <FishingScene theme={theme} animate={false} busy={false} pose={pose} onReady={sceneReady} onFailure={onFailure}>
        <CaptureExport theme={theme} onReady={onReady} />
      </FishingScene>
    </div>
  </div>;
}
