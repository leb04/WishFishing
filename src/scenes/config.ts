export type SceneTheme = "light" | "dark";
export type Point3 = [number, number, number];

// The pond lighting palettes are independent of the interface colors.
export const SCENE_PALETTES = {
  light: {
    sky: "#78c4f4", fog: "#afd3df", water: "#127fbb", deepWater: "#0d5f97", shallowWater: "#4aa6ae", glint: "#ddf4ed",
    sand: "#d5c492", shore: "#96ae60", hill: "#7e9d7f", farHill: "#8eafb0", distantPeak: "#a9c7d3",
    foliage: "#3c6e58", bark: "#756657", rock: "#a1aba1",
    celestial: "#fff0bf", cloud: "#e4eee8", rod: "#2d494b", grip: "#ae8257", metal: "#d7e1df", line: "#f5f6db",
    ambient: 1.65, sunlight: 2.1,
  },
  dark: {
    sky: "#102539", fog: "#18394a", water: "#194957", deepWater: "#103442", shallowWater: "#326975", glint: "#7abdc3",
    sand: "#596657", shore: "#2b4b50", hill: "#254650", farHill: "#365566", distantPeak: "#4b6579",
    foliage: "#40695e", bark: "#514a48", rock: "#536876",
    celestial: "#e4ecdf", cloud: "#344c61", rod: "#77989d", grip: "#b38e67", metal: "#a8cbd0", line: "#b6d9da",
    ambient: 1.3, sunlight: 1.6,
  },
  dawn: {
    sky: "#91a8bd", fog: "#b4aaa4", water: "#34748a", deepWater: "#235668", shallowWater: "#5c8d91", glint: "#ffd9b1",
    sand: "#c8aa88", shore: "#7e967d", hill: "#778c91", farHill: "#969aa4", distantPeak: "#b0a5ad",
    foliage: "#527667", bark: "#7b645b", rock: "#879494",
    celestial: "#ffe0ab", cloud: "#efc7b2", rod: "#40595c", grip: "#ac805e", metal: "#d3e1df", line: "#f5ebd4",
    ambient: 1.44, sunlight: 1.85,
  },
  dusk: {
    sky: "#a27591", fog: "#a28291", water: "#465d80", deepWater: "#2a425f", shallowWater: "#717e9d", glint: "#ffd2a8",
    sand: "#b89a8a", shore: "#6a777b", hill: "#5c647c", farHill: "#7d738c", distantPeak: "#958399",
    foliage: "#576974", bark: "#65545b", rock: "#74778e",
    celestial: "#ffbd8c", cloud: "#d8a09c", rod: "#576779", grip: "#b38b71", metal: "#d8cdcd", line: "#f3decc",
    ambient: 1.28, sunlight: 1.62,
  },
} satisfies Record<SceneTheme | "dawn" | "dusk", Record<string, string | number>>;

export type SceneLighting = keyof typeof SCENE_PALETTES;
export type ScenePalette = (typeof SCENE_PALETTES)[SceneLighting];

export const CAMERA = {
  position: [0, 2.7, 7] as Point3,
  target: [0, 1.9, -8] as Point3,
  near: 0.1,
  far: 360,
  fov: 52,
  portraitFov: 58,
};
export const BOBBER: Point3 = [-0.35, 0.15, -8];
export const ROD_TIP: Point3 = [-0.8, 1.7, -6];

export function getFraming(aspect: number) {
  return {
    fov: aspect < 1 ? CAMERA.portraitFov : CAMERA.fov,
    // Keep the grip near the right edge without losing it in portrait framing.
    rodOrigin: [Math.min(1.65, Math.max(0.35, aspect * 1.2)), 1.4, 4] as Point3,
  };
}

export function shouldAnimateScene(options: {
  visible: boolean; inView: boolean; suspended: boolean; reducedMotion: boolean; paused: boolean;
}): boolean {
  return options.visible && options.inView && !options.suspended && !options.reducedMotion && !options.paused;
}
