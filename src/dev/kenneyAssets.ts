import { KENNEY_URLS } from "../scenes/kenneyAssetPaths";
const { pine, tallPine, oak, boulder, smallRock, bush } = KENNEY_URLS;

export const KENNEY_SOURCE = "https://kenney.nl/assets/nature-kit";
export const KENNEY_SCALE = 3;
export const KENNEY_ASSETS = [
  { id: "pine", name: "tree_pineDefaultA", url: pine, position: [-3.5, 0, -2] },
  { id: "tall-pine", name: "tree_pineTallA_detailed", url: tallPine, position: [0, 0, -2] },
  { id: "oak", name: "tree_oak", url: oak, position: [3.5, 0, -2] },
  { id: "boulder", name: "rock_largeA", url: boulder, position: [-3.5, 0, 2] },
  { id: "small-rock", name: "rock_smallC", url: smallRock, position: [0, 0, 2] },
  { id: "bush", name: "plant_bushDetailed", url: bush, position: [3.5, 0, 2] },
] as const;
export type KenneyAsset = (typeof KENNEY_ASSETS)[number];
