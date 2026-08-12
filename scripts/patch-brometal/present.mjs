/**
 * Add renderer.present() for a single explicit frame.
 *
 * The runtime only exposes loop(), which owns requestAnimationFrame. A host that already has its
 * own frame loop cannot use it, and capture needs to draw exactly one frame on demand. present()
 * is loop()'s body without the scheduling.
 */
export const name = 'present';

export async function apply({ replace, replaceSection }) {
  await replace(
    'dist/runtime/context.js',
    'BroMetal requires it — shaders are compiled to WGSL and compute passes have no WebGL equivalent.',
    'BroMetal requires it — shaders and compute passes run on WebGPU.',
  );
  await replace(
    'dist/runtime/context.d.ts',
    '    loop(callback: (elapsedSeconds: number) => void): () => void;\n',
    '    present(callback: () => void): void;\n    loop(callback: (elapsedSeconds: number) => void): () => void;\n',
  );
  await replaceSection(
    'dist/runtime/webgpu.js',
    '        loop(callback) {\n',
    '        drawTo(target, draw, options = {}) {\n',
    `        present(callback) {
              if (needsResize || observer === null) {
                  needsResize = false;
                  resizeToDisplaySize(canvas, window.devicePixelRatio || 1);
                  if (depthTexture === null || depthTexture.width !== canvas.width || depthTexture.height !== canvas.height) {
                      depthTexture?.destroy();
                      depthTexture = device.createTexture({
                          size: [canvas.width, canvas.height],
                          format: 'depth24plus',
                          sampleCount: internals.sampleCount,
                          usage: GPUTextureUsage.RENDER_ATTACHMENT,
                      });
                      depthView = depthTexture.createView();
                      if (internals.sampleCount > 1) {
                          msaaTexture?.destroy();
                          msaaTexture = device.createTexture({
                              size: [canvas.width, canvas.height],
                              format,
                              sampleCount: internals.sampleCount,
                              usage: GPUTextureUsage.RENDER_ATTACHMENT,
                          });
                          msaaView = msaaTexture.createView();
                      }
                  }
              }
              internals.frame++;
              const [r, g, b, a] = internals.clearColor;
              const encoder = device.createCommandEncoder();
              const swapchainView = context.getCurrentTexture().createView();
              internals.pass = encoder.beginRenderPass({
                  colorAttachments: [
                      msaaView !== null
                          ? {
                              view: msaaView,
                              resolveTarget: swapchainView,
                              clearValue: { r, g, b, a },
                              loadOp: 'clear',
                              storeOp: 'discard',
                          }
                          : {
                              view: swapchainView,
                              clearValue: { r, g, b, a },
                              loadOp: 'clear',
                              storeOp: 'store',
                          },
                  ],
                  depthStencilAttachment: {
                      view: depthView,
                      depthClearValue: 1,
                      depthLoadOp: 'clear',
                      depthStoreOp: 'store',
                  },
              });
              internals.passFormat = format;
              internals.passSamples = internals.sampleCount;
              internals.passDepth = true;
              try {
                  callback();
              }
              finally {
                  internals.pass.end();
                  internals.pass = null;
                  device.queue.submit([encoder.finish()]);
              }
          },
          loop(callback) {
              let frameId = 0;
              let running = true;
              const startedAt = performance.now();
              const frame = (now) => {
                  if (!running)
                      return;
                  renderer.present(() => callback((now - startedAt) / 1000));
                  frameId = requestAnimationFrame(frame);
              };
              frameId = requestAnimationFrame(frame);
              const stop = () => {
                  running = false;
                  cancelAnimationFrame(frameId);
              };
              activeStops.add(stop);
              return () => {
                  stop();
                  activeStops.delete(stop);
              };
          },
  `,
  );
}
