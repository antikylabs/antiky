import {
  createPlane,
  createProgram,
  createTexture,
  type Renderer,
} from 'brometal';

import onboardingShader from './shaders/onboarding.shader.gen';
import { RELAY_ONBOARDING_CUES } from './onboarding-cues.ts';

export type RelayOnboardingOverlay = Readonly<{
  setOpacity(opacity: number): void;
  draw(): void;
  dispose(): void;
}>;

export function createRelayOnboardingOverlay(renderer: Renderer): RelayOnboardingOverlay {
  const canvas = document.createElement('canvas');
  canvas.width = 1_024;
  canvas.height = 208;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Unable to create the Blackout Relay control legend.');
  context.fillStyle = 'rgba(8, 12, 11, 0.82)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(126, 149, 126, 0.72)';
  context.lineWidth = 3;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '600 23px ui-monospace, SFMono-Regular, Menlo, monospace';
  RELAY_ONBOARDING_CUES.forEach((cue, index) => {
    context.fillStyle = cue.kind === 'charge'
      ? '#b9d3b8'
      : cue.kind === 'deposit' ? '#d1b786' : '#d5d4bd';
    context.fillText(cue.label, canvas.width / 2, 32 + index * 48);
  });

  const geometry = createPlane({ width: 2, height: 2 });
  const texture = createTexture(renderer, canvas, { filter: 'smooth', wrap: 'clamp' });
  const program = createProgram(renderer, onboardingShader, { blend: 'alpha' });
  program.attributes.aPosition.set(geometry.positions);
  program.attributes.aUv.set(geometry.uvs);
  program.setIndices(geometry.indices);
  program.uniforms.uAtlas.set(texture);

  return Object.freeze({
    setOpacity(opacity: number): void {
      program.uniforms.uOpacity.set(opacity);
    },
    draw(): void {
      program.draw();
    },
    dispose(): void {
      program.dispose();
      texture.dispose();
    },
  });
}
