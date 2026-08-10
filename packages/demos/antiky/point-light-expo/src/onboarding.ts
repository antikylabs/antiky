import {
  createPlane,
  createProgram,
  createTexture,
  type BroMetalProgram,
  type BroMetalTexture,
  type Renderer,
} from 'brometal';

import onboardingShader from './shaders/onboarding.shader.gen.ts';
import {
  RELAY_ONBOARDING_PRESENTATION,
  RELAY_ONBOARDING_ROWS,
} from './onboarding-cues.ts';
import { createResourceScope } from './resource-lifetime.ts';

type OverlayCanvas = Readonly<{
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}>;

export type RelayOnboardingDependencies = Readonly<{
  createCanvas(width: number, height: number, errorMessage: string): OverlayCanvas;
  createTexture(renderer: Renderer, canvas: HTMLCanvasElement): BroMetalTexture;
  createProgram(renderer: Renderer): BroMetalProgram;
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
  createTexture: (renderer, canvas) => createTexture(renderer, canvas, {
    filter: 'smooth',
    wrap: 'clamp',
  }),
  createProgram: (renderer) => createProgram(renderer, onboardingShader, { blend: 'alpha' }),
});

export type RelayOnboardingOverlay = Readonly<{
  setOpacity(opacity: number): void;
  setStatus(status: 'playing' | 'won' | 'lost', time: number): void;
  draw(): void;
  drawStatus(): void;
  dispose(): void;
}>;

export function createRelayOnboardingOverlay(
  renderer: Renderer,
  dependencies: RelayOnboardingDependencies = ONBOARDING_DEPENDENCIES,
): RelayOnboardingOverlay {
  const resources = createResourceScope();
  try {
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
      context.fillText(row.map((cue) => cue.label).join('   '), 512, 35 + index * 58);
    });

    const geometry = createPlane({ width: 2, height: 2 });
    const texture = resources.register(dependencies.createTexture(renderer, canvas));
    const program = resources.register(dependencies.createProgram(renderer));
    program.attributes.aPosition!.set(geometry.positions);
    program.attributes.aUv!.set(geometry.uvs);
    program.setIndices(geometry.indices);
    program.uniforms.uAtlas!.set(texture);
    program.uniforms.uScale!.set(RELAY_ONBOARDING_PRESENTATION.scale);
    program.uniforms.uOffset!.set(RELAY_ONBOARDING_PRESENTATION.offset);

    const createStatusTexture = (title: string, detail: string, accent: string) => {
      const status = dependencies.createCanvas(
        1_024,
        192,
        'Unable to create the relay result panel.',
      );
      status.context.fillStyle = 'rgba(12, 18, 16, 0.9)';
      status.context.fillRect(0, 0, 1_024, 192);
      status.context.strokeStyle = accent;
      status.context.lineWidth = 6;
      status.context.strokeRect(5, 5, 1_014, 182);
      status.context.textAlign = 'center';
      status.context.textBaseline = 'middle';
      status.context.font = '700 48px ui-monospace, SFMono-Regular, Menlo, monospace';
      status.context.fillStyle = accent;
      status.context.fillText(title, 512, 68);
      status.context.font = '600 26px ui-monospace, SFMono-Regular, Menlo, monospace';
      status.context.fillStyle = '#e2e0ca';
      status.context.fillText(detail, 512, 138);
      return resources.register(dependencies.createTexture(renderer, status.canvas));
    };
    const wonTexture = createStatusTexture(
      'RELIQUARY RESTORED',
      'RELEASE + CLICK TO RELAY AGAIN',
      '#e6c477',
    );
    const lostTexture = createStatusTexture(
      'PRISM FRACTURED',
      'RELEASE + CLICK TO REIGNITE',
      '#ed6470',
    );
    const statusProgram = resources.register(dependencies.createProgram(renderer));
    statusProgram.attributes.aPosition!.set(geometry.positions);
    statusProgram.attributes.aUv!.set(geometry.uvs);
    statusProgram.setIndices(geometry.indices);
    statusProgram.uniforms.uAtlas!.set(wonTexture);
    statusProgram.uniforms.uScale!.set([0.48, 0.14]);
    statusProgram.uniforms.uOffset!.set([0, 0.08]);
    statusProgram.uniforms.uOpacity!.set(0);
    let visibleStatus: 'won' | 'lost' | null = null;

    return Object.freeze({
      setOpacity(opacity: number): void {
        program.uniforms.uOpacity!.set(opacity);
      },
      setStatus(status: 'playing' | 'won' | 'lost', time: number): void {
        if (status === 'playing') {
          visibleStatus = null;
          statusProgram.uniforms.uOpacity!.set(0);
          return;
        }
        if (status !== visibleStatus) {
          visibleStatus = status;
          statusProgram.uniforms.uAtlas!.set(status === 'won' ? wonTexture : lostTexture);
        }
        statusProgram.uniforms.uOpacity!.set(0.94 + Math.sin(time * 2.6) * 0.06);
      },
      draw(): void {
        program.draw();
      },
      drawStatus(): void {
        statusProgram.draw();
      },
      dispose(): void {
        resources.dispose();
      },
    });
  } catch (cause: unknown) {
    resources.rollback();
    throw cause;
  }
}
