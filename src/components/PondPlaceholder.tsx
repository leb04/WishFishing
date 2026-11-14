import { SCENE_PALETTES, type SceneLighting } from "../scenes/config";

export function PondPlaceholder({ lighting }: { lighting: SceneLighting }) {
  const palette = SCENE_PALETTES[lighting];
  return (
    <div className="pond-placeholder" aria-hidden="true">
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <rect width="1200" height="800" fill={palette.sky} />
        <circle cx={lighting === "dusk" ? 735 : 444} cy={lighting === "dawn" || lighting === "dusk" ? 270 : 168}
          r={lighting === "dark" ? 20 : 29} fill={palette.celestial} />
        <path
          className="pond-shore"
          style={{ fill: palette.shore }}
          d="M0 310 Q120 230 270 295 T540 280 T820 290 T1200 260 V800 H0 Z"
        />
        <path
          className="pond-water"
          style={{ fill: palette.water }}
          d="M0 350 Q300 330 600 350 T1200 350 V800 H0 Z"
        />
        <g className="pond-lines" fill="none" style={{ stroke: palette.glint }}>
          <path d="M70 420 H330 M820 400 H1050 M320 490 H530 M740 530 H1100 M60 630 H250 M440 665 H600" />
          <ellipse cx="620" cy="445" rx="43" ry="9" />
          <ellipse cx="620" cy="445" rx="70" ry="16" />
          <path
            d="M965 800 Q860 620 790 480 Q750 420 720 385"
            strokeWidth="8"
          />
          <path d="M720 385 Q655 370 620 439" />
        </g>
        <path className="pond-bobber" d="M620 430 V446" style={{ stroke: palette.celestial }} />
      </svg>
    </div>
  );
}
