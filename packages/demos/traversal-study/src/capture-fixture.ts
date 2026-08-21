import {
  createCaptureFixtureController,
  type CaptureFixtureController,
} from '@antiky/framework/game';

/** Game-owned presentation controls used only by bounded visual evidence captures. */
export function createTraversalCaptureFixture(): CaptureFixtureController {
  return createCaptureFixtureController({
    fixtureName: 'goal-19-evidence',
    sceneGroups: { 'scene-geometry': true },
    variants: { bloom: true, shadows: true, vignette: true },
    maximumCameraTranslation: 0.5,
  });
}
