/**
 * Map perspective depth to WebGPU's zero-to-one clip range.
 *
 * Clean BroMetal 0.18.0 uses the OpenGL negative-one-to-one projection terms even though its only
 * renderer is WebGPU. With a right-handed view, that maps the near plane to -1 instead of 0 and
 * wastes half of WebGPU's representable depth interval. The corrected terms map z=-near to 0 and
 * z=-far to 1 while leaving the public matrix shape and x/y projection unchanged.
 *
 * **Upstream: not submitted.** The owner deferred upstream submission for this pass.
 * Retire only after a future focused pull request is merged, Antiky installs a published BroMetal
 * release containing this correction, and the clean-package plane-mapping test passes without this
 * patch. Then remove this module, drop it from PATCHES in ../patch-brometal.mjs and the scripts
 * allowlist in ../tests/repository-policy.test.mjs, clean-install, and rerun the behavior and full
 * tests.
 */
export const name = 'webgpu-perspective-depth';

export async function apply({ replace }) {
  await replace(
    'dist/math/mat4.js',
    `    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = (2 * far * near) / (near - far);`,
    `    m[10] = far / (near - far);
    m[11] = -1;
    m[14] = (far * near) / (near - far);`,
  );
}
