import { createPlane } from 'brometal';
import type { PipelineDefinition, TextureSource } from '@antiky/framework/render-driver';

import onboardingShader from './shaders/onboarding.shader.gen.ts';
import {
  RELAY_ONBOARDING_PRESENTATION,
  RELAY_ONBOARDING_ROWS,
} from './onboarding-cues.ts';

type OverlayCanvas = Readonly<{
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}>;

export type RelayOnboardingDependencies = Readonly<{
  createCanvas(width: number, height: number, errorMessage: string): OverlayCanvas;
}>;

const ONBOARDING_DEPENDENCIES: RelayOnboardingDependencies = Object.freeze({
  createCanvas(width, height, errorMessage) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error(errorMessage);
    return { canvas, context };
  },
});

export type RelayOnboardingOverlay = Readonly<{
  /** Textures the driver should own: the legend panel and the two result plates. */
  textures: Record<string, TextureSource>;
  pipeline: PipelineDefinition;
  statusPipeline: PipelineDefinition;
  /** Uniforms for the legend draw, recomputed each frame from the fade. */
  uniforms(opacity: number): Record<string, number>;
  /** Uniforms for the result plate, or null while the run is still playing. */
  statusUniforms(status: 'playing' | 'won' | 'lost', time: number): Record<string, unknown> | null;
}>;

export function createRelayOnboardingOverlay(
  dependencies: RelayOnboardingDependencies = ONBOARDING_DEPENDENCIES,
): RelayOnboardingOverlay {
  const { canvas, context } = dependencies.createCanvas(
    1_024,
    128,
    'Unable to create the Blackout Relay control legend.',
  );
  context.fillStyle = 'rgba(8, 12, 11, 0.82)';
  context.fillRect(0, 0, 1_024, 128);
  context.strokeStyle = 'rgba(126, 149, 126, 0.72)';
  context.lineWidth = 3;
  context.strokeRect(3, 3, 1_018, 122);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '600 26px ui-monospace, SFMono-Regular, Menlo, monospace';
  RELAY_ONBOARDING_ROWS.forEach((row, index) => {
    context.fillStyle = index === 0 ? '#d5d4bd' : '#c8d4b2';
    context.fillText(row.join('   '), 512, 35 + index * 58);
  });

  const statusCanvas = (title: string, detail: string, accent: string): HTMLCanvasElement => {
    const status = dependencies.createCanvas(1_024, 192, 'Unable to create the relay result panel.');
    // Goal 08's re-skin. The old panel was a hairline accent stroke around terminal type, which
    // reads as debug output. A soft vignette plate whose glow carries the accent reads as part of
    // the night scene's light language instead.
    const plate = status.context.createRadialGradient(512, 96, 40, 512, 96, 620);
    plate.addColorStop(0, 'rgba(16, 24, 22, 0.94)');
    plate.addColorStop(0.8, 'rgba(10, 16, 14, 0.82)');
    plate.addColorStop(1, 'rgba(8, 12, 11, 0)');
    status.context.fillStyle = plate;
    status.context.fillRect(0, 0, 1_024, 192);
    status.context.textAlign = 'center';
    status.context.textBaseline = 'middle';
    status.context.shadowColor = accent;
    status.context.shadowBlur = 26;
    status.context.font = '700 52px Georgia, ui-serif, serif';
    status.context.fillStyle = accent;
    status.context.fillText(title, 512, 68);
    status.context.shadowBlur = 0;
    status.context.font = '500 26px Georgia, ui-serif, serif';
    status.context.fillStyle = '#ded9c2';
    status.context.fillText(detail, 512, 138);
    return status.canvas;
  };

  const geometry = createPlane({ width: 2, height: 2 });
  const overlayOptions = { filter: 'smooth', wrap: 'clamp' } as const;
  const quadSetup = (program: { attributes: never; setIndices(indices: never): void }): void => {
    const attributes = program.attributes as unknown as Record<string, { set(value: unknown): void }>;
    attributes.aPosition!.set(geometry.positions);
    attributes.aUv!.set(geometry.uvs);
    program.setIndices(geometry.indices as never);
  };

  return Object.freeze({
    textures: {
      'onboarding-legend': { source: canvas, options: overlayOptions },
      'onboarding-won': {
        source: statusCanvas('RELIQUARY RESTORED', 'RELEASE + CLICK TO RELAY AGAIN', '#e6c477'),
        options: overlayOptions,
      },
      'onboarding-lost': {
        source: statusCanvas('PRISM FRACTURED', 'RELEASE + CLICK TO REIGNITE', '#ed6470'),
        options: overlayOptions,
      },
    } as Record<string, TextureSource>,
    pipeline: {
      shader: onboardingShader,
      options: { blend: 'alpha' },
      setup(program) {
        quadSetup(program as never);
        const uniforms = program.uniforms as unknown as Record<string, { set(value: unknown): void }>;
        uniforms.uScale!.set(RELAY_ONBOARDING_PRESENTATION.scale);
        uniforms.uOffset!.set(RELAY_ONBOARDING_PRESENTATION.offset);
      },
    } satisfies PipelineDefinition,
    statusPipeline: {
      shader: onboardingShader,
      options: { blend: 'alpha' },
      setup(program) {
        quadSetup(program as never);
        const uniforms = program.uniforms as unknown as Record<string, { set(value: unknown): void }>;
        uniforms.uScale!.set([0.48, 0.14]);
        uniforms.uOffset!.set([0, 0.08]);
      },
    } satisfies PipelineDefinition,
    uniforms(opacity: number) {
      return { uOpacity: opacity };
    },
    statusUniforms(status, time) {
      if (status === 'playing') return { uOpacity: 0 };
      return {
        uAtlas: { texture: status === 'won' ? 'onboarding-won' : 'onboarding-lost' },
        uOpacity: 0.94 + Math.sin(time * 2.6) * 0.06,
      };
    },
  });
}
