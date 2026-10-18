/** One material pass: slowly warped, anti-aliased ripples and soft bobber rings. */
export const WATER_SHADER_DECLARATIONS = `
  varying vec3 vLakeWorld;
  uniform float uLakeTime;
  uniform float uLakeNight;
  uniform vec3 uLakeSky;
  uniform vec3 uLakeGlint;
  uniform vec2 uLakeBobber;
  float lakeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lakeNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(lakeHash(i), lakeHash(i + vec2(1.0, 0.0)), f.x),
      mix(lakeHash(i + vec2(0.0, 1.0)), lakeHash(i + vec2(1.0)), f.x), f.y);
  }
`;
export const WATER_SHADER_COLOR = `
  vec2 lakeP = vLakeWorld.xz;
  float lakeT = uLakeTime;
  float lakeN = lakeNoise(lakeP * 0.38 + vec2(lakeT * 0.018, -lakeT * 0.012));
  float lakeN2 = lakeNoise(lakeP * 1.1 + vec2(-lakeT * 0.02, lakeT * 0.011));
  float lakeWave = sin(dot(lakeP, vec2(2.3, 4.1)) + lakeN * 6.28 + lakeT * 0.25);
  float lakeCross = sin(dot(lakeP, vec2(-3.8, 2.7)) + lakeN2 * 5.0 - lakeT * 0.2);
  float lakeDetail = 1.0 - smoothstep(0.12, 0.7, fwidth(lakeP.x) + fwidth(lakeP.y));
  float lakeBobberDistance = distance(lakeP, uLakeBobber);
  float lakeCalm = smoothstep(0.45, 1.8, lakeBobberDistance);
  diffuseColor.rgb *= 0.98 + lakeN * 0.04 + (lakeWave + lakeCross) * 0.012 * lakeDetail * lakeCalm;
`;
export const WATER_SHADER_LIGHT = `
  vec3 lakeView = normalize(cameraPosition - vLakeWorld);
  float lakeFresnel = pow(1.0 - abs(lakeView.y), 3.0);
  outgoingLight = mix(outgoingLight, uLakeSky * mix(0.6, 0.4, uLakeNight), 0.035 + lakeFresnel * 0.13);
  float lakeShimmer = smoothstep(0.65, 0.95, lakeWave * lakeCross) * (0.4 + lakeN2 * 0.6) * lakeDetail * lakeCalm;
  outgoingLight += uLakeGlint * lakeShimmer * mix(0.025, 0.008, uLakeNight);
  float lakeRings = 0.0;
  for (int i = 0; i < 3; i++) {
    float phase = fract(lakeT * 0.18 + float(i) / 3.0);
    float radius = 0.22 + phase * 1.15;
    float width = 0.025 + phase * 0.025 + fwidth(lakeBobberDistance);
    float ring = exp(-pow((lakeBobberDistance - radius) / width, 2.0));
    lakeRings += ring * (1.0 - phase) * (1.0 - phase) * smoothstep(0.0, 0.1, phase);
  }
  outgoingLight += uLakeGlint * lakeRings * mix(0.1, 0.045, uLakeNight);
`;
