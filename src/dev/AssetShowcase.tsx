import { Component, Suspense, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, Lightformer, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { KENNEY_ASSETS, KENNEY_SCALE, KENNEY_SOURCE } from "./kenneyAssets";
import type { KenneyAsset } from "./kenneyAssets";
import "./assetShowcase.css";

class ShowcaseBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">The asset preview could not load. Check WebGL support and the local model files, then reload.</p> : this.props.children;
  }
}

/** Cached source materials/geometry are shared; only object transforms are cloned. */
function ImportedAsset({ asset, focused }: { asset: KenneyAsset; focused: boolean }) {
  const { scene } = useGLTF(asset.url, false);
  const { model, offset } = useMemo(() => {
    const model = scene.clone(true);
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    return { model, offset: [-center.x, -bounds.min.y, -center.z] as [number, number, number] };
  }, [scene]);
  return <group name={asset.name} position={focused ? [0, 0, 0] : [...asset.position]}>
    <group scale={KENNEY_SCALE}>
      <primitive object={model} position={offset} dispose={null} />
    </group>
  </group>;
}

export default function AssetShowcase() {
  const [selected, setSelected] = useState("all");
  const { active } = useProgress();
  const assets = selected === "all" ? KENNEY_ASSETS : KENNEY_ASSETS.filter((asset) => asset.id === selected);
  return <main className="asset-showcase">
    <header className="asset-showcase-heading">
      <div><p className="asset-eyebrow">WISHFISHING · DEVELOPMENT ONLY</p><h1>Kenney Nature Kit</h1><p>Original materials · shared {KENNEY_SCALE}× scale · daylight review</p></div>
      <a href={KENNEY_SOURCE} target="_blank" rel="noreferrer">Official source · CC0</a>
    </header>
    <nav className="asset-choices" aria-label="Asset selection">
      <button type="button" aria-pressed={selected === "all"} onClick={() => setSelected("all")}>All six models</button>
      {KENNEY_ASSETS.map((asset) => <button key={asset.id} type="button" aria-pressed={selected === asset.id} onClick={() => setSelected(asset.id)}>{asset.name}</button>)}
    </nav>
    <p className="asset-instructions">Drag to orbit · scroll to zoom · select a model for a closer view. Switching views resets the camera.</p>
    <p className="asset-view-label" role="status">{active ? "Loading models…" : selected === "all" ? "Overview · back row: trees · front row: rocks and bush" : assets[0]?.name}</p>
    <section className="asset-canvas" aria-label="Kenney model showcase">
      <ShowcaseBoundary>
        <Canvas key={selected} frameloop="demand" dpr={[1, 1.5]} camera={{ position: [2, 6, 14], fov: 40, near: 0.01, far: 100 }} gl={{ antialias: true, powerPreference: "low-power" }}>
          <color attach="background" args={["#e3ece8"]} />
          <hemisphereLight args={["#fff7e6", "#718475", 0.7]} />
          <directionalLight position={[-4, 8, 5]} color="#fff1d6" intensity={1.1} />
          <Environment resolution={64} frames={1}>
            <color attach="background" args={["#526b5e"]} />
            <Lightformer intensity={0.8} position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={15} />
            <Lightformer intensity={0.6} position={[-8, 4, 3]} rotation={[0, Math.PI / 2, 0]} scale={12} />
            <Lightformer intensity={0.4} position={[8, 3, -4]} rotation={[0, -Math.PI / 2, 0]} scale={12} />
          </Environment>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#a5b7a0" roughness={1} /></mesh>
          <OrbitControls makeDefault enableDamping={false} minDistance={0.5} maxDistance={40} minPolarAngle={0.1} maxPolarAngle={Math.PI / 2 - 0.02} />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={selected === "all" ? 0.85 : 1.35} maxDuration={0}>
              <group>{assets.map((asset) => <ImportedAsset key={asset.id} asset={asset} focused={selected !== "all"} />)}</group>
            </Bounds>
          </Suspense>
        </Canvas>
      </ShowcaseBoundary>
    </section>
    <div className="asset-legend" aria-label="Overview model positions">
      {KENNEY_ASSETS.map((asset, index) => <p key={asset.id}><span>{index < 3 ? "Back" : "Front"} {["left", "center", "right"][index % 3]}</span> {asset.name}</p>)}
    </div>
    <footer>Six original GLB models from Nature Kit 2.1. This preview does not change the fishing environment.</footer>
  </main>;
}
