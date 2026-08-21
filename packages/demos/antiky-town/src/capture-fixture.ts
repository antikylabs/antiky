import {
  createCaptureFixtureController,
  type CaptureFixtureController,
} from '@antiky/framework/game';

/** Game-owned presentation controls used only by bounded visual evidence captures. */
export function createTownCaptureFixture(): CaptureFixtureController {
  return createCaptureFixtureController({
    fixtureName: 'goal-19-evidence',
    variants: {
      bloom: true,
      shadows: true,
      'tree-translucency': true,
      vignette: true,
    },
  });
}
