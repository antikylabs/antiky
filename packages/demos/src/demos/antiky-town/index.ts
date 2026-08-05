import { createTownDemoFactory } from '../brometal-town/index.ts';
import { createAntikyTownDemoFactory } from './composition.ts';

export {
  ANTIKY_TOWN_WORLD_ID,
  MARKET_LAMP_WEST_01_ID,
  PROOF_POINT_LIGHT_ID,
} from './content/point-lights.ts';
export { createAntikyTownDemoFactory } from './composition.ts';

const factory = createAntikyTownDemoFactory(createTownDemoFactory);

export default factory;
