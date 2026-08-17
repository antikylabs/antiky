import {
  createCaptureFixtureController,
  type CaptureFixtureController,
} from '@antiky/framework/game';

/** Game-owned presentation controls used only by bounded visual evidence captures. */
export function createRelayCaptureFixture(): CaptureFixtureController {
  return createCaptureFixtureController({
    fixtureName: 'goal-19-evidence',
    sceneGroups: { 'scene-geometry': true },
    maximumCameraTranslation: 0.5,
  });
}
