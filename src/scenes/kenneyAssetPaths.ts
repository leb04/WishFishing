import pine from "../dev/assets/kenney-nature/tree_pineDefaultA.glb?url";
import tallPine from "../dev/assets/kenney-nature/tree_pineTallA_detailed.glb?url";
import oak from "../dev/assets/kenney-nature/tree_oak.glb?url";
import boulder from "../dev/assets/kenney-nature/rock_largeA.glb?url";
import smallRock from "../dev/assets/kenney-nature/rock_smallC.glb?url&no-inline";
import bush from "../dev/assets/kenney-nature/plant_bushDetailed.glb?url";

export const KENNEY_URLS = { pine, tallPine, oak, boulder, smallRock, bush } as const;
export type NatureModel = keyof typeof KENNEY_URLS;
