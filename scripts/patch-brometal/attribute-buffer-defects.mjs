/**
 * Two defects in per-frame attribute buffer handling.
 *
 * 1. A second upload in one frame overwrote the first. `queue.writeBuffer` is
 *    ordered against the frame's single submit, not against the draws inside it,
 *    so every draw read whatever was written last. Uploads now append at an
 *    offset and each draw binds its vertex buffers where its own data is — the
 *    method the uniform ring in the same file already used.
 * 2. A buffer that grew mid-frame was destroyed while a recorded draw still
 *    referred to it, failing the whole submit with "used in submit while
 *    destroyed". Replaced buffers are now retired and destroyed at the next
 *    frame boundary.
 *
 * Both are reachable from one program that uploads more than once per frame.
 *
 * **Upstream: https://github.com/ericdrowell/brometal/pull/7 — open on 2026-08-16.**
 * webgpu: correct two defects in per-frame attribute buffer handling
 *
 * Retire only after Antiky installs a published BroMetal release that contains this behavior and
 * the clean-package behavior test passes without this patch. Then remove this module, drop it from
 * PATCHES in ../patch-brometal.mjs and the scripts allowlist in
 * ../tests/repository-policy.test.mjs, clean-install, and rerun the BroMetal behavior and full tests.
 */
export const name = 'attribute-buffer-defects';

export async function apply({ replace }) {
  // Retire list, plus per-frame offset bookkeeping on the upload path.
  await replace(
    'dist/runtime/webgpu.js',
    `    const uploadAttribute = (entry, data) => {
        if (data.length % entry.size !== 0) {
            throw new Error(\`BroMetal: attribute data length \${data.length} is not a multiple of \${entry.size} components per element\`);
        }
        const states = entry.divisor === 1 ? instanceStates : vertexStates;
        let state = states.get(entry.name);
        if (state === undefined || state.capacity < data.byteLength) {
            state?.buffer.destroy();
            state = {
                buffer: device.createBuffer({
                    size: data.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                }),
                capacity: data.byteLength,
                elementCount: 0,
            };
            states.set(entry.name, state);
        }
        state.elementCount = data.length / entry.size;
        device.queue.writeBuffer(state.buffer, 0, data);
    };`,
    `    const retired = [];
    const uploadAttribute = (entry, data) => {
        if (data.length % entry.size !== 0) {
            throw new Error(\`BroMetal: attribute data length \${data.length} is not a multiple of \${entry.size} components per element\`);
        }
        const states = entry.divisor === 1 ? instanceStates : vertexStates;
        let state = states.get(entry.name);
        const repeat = state !== undefined && state.frame === internals.frame;
        const offset = repeat ? state.writtenThisFrame : 0;
        const needed = offset + data.byteLength;
        if (state === undefined || state.capacity < needed) {
            const grown = Math.max(needed, (state?.capacity ?? 0) * 2);
            const replacement = device.createBuffer({
                size: grown,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            if (state !== undefined) {
                retired.push(state.buffer);
                state.buffer = replacement;
                state.capacity = grown;
            }
            else {
                state = {
                    buffer: replacement,
                    capacity: grown,
                    elementCount: 0,
                    offset: 0,
                    writtenThisFrame: 0,
                    frame: -1,
                };
                states.set(entry.name, state);
            }
        }
        state.elementCount = data.length / entry.size;
        state.offset = offset;
        state.writtenThisFrame = offset + data.byteLength;
        state.frame = internals.frame;
        device.queue.writeBuffer(state.buffer, offset, data);
    };`,
  );

  // Release retired buffers at the frame boundary, before any early exit.
  await replace(
    'dist/runtime/webgpu.js',
    `            if (internals.frame !== lastFrame) {
                // New frame: restart the slot ring. Forcing a write keeps this frame's
                // ascending slots from ever overwriting an offset already referenced.
                lastFrame = internals.frame;
                slot = -1;
                uniformsDirty = true;
            }`,
    `            if (internals.frame !== lastFrame) {
                // New frame: restart the slot ring. Forcing a write keeps this frame's
                // ascending slots from ever overwriting an offset already referenced.
                // The GPU has the previous frame, so buffers it retired are safe now.
                lastFrame = internals.frame;
                for (const buffer of retired) {
                    buffer.destroy();
                }
                retired.length = 0;
                slot = -1;
                uniformsDirty = true;
            }`,
  );

  // Bind at the offset holding this draw's data, not at 0.
  await replace(
    'dist/runtime/webgpu.js',
    '                pass.setVertexBuffer(slot, states.get(entry.name).buffer);',
    `                const attributeState = states.get(entry.name);
                pass.setVertexBuffer(slot, attributeState.buffer, attributeState.offset);`,
  );
}
