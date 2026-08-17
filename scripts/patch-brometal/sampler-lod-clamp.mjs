/**
 * Let a texture cap the mip range it resolves to.
 *
 * `lodMinClamp` and `lodMaxClamp` are standard `GPUSamplerDescriptor` fields — this exposes an
 * existing WebGPU capability rather than inventing one. Clean BroMetal 0.18.0 builds its 2D sampler with
 * `magFilter`, `minFilter`, `mipmapFilter`, `addressModeU/V` and `maxAnisotropy`, so a caller can
 * choose *how* to filter but not *how far down the chain* to go, and there is no way to ask at all.
 *
 * Why it matters here: capping the chain is the cheap partial fix for atlas bleeding, because the
 * coarse levels are where a tile's neighbours have been averaged in. It is also what any caller
 * needs when a texture must never resolve below a known level — a UI sheet, a lookup table, or a
 * material whose lowest mips are meaningless.
 *
 * The clamps are forwarded only when the caller sets them. Passing `undefined` for a WebIDL
 * dictionary member is the same as omitting it, so an unset clamp leaves WebGPU's own defaults
 * (0 and 32) in place rather than this patch inventing a policy.
 *
 * **Upstream: not submitted.** The owner deferred upstream submission for this pass.
 * Retire only after a future focused pull request is merged, Antiky installs a published BroMetal
 * release containing this behavior, and the clean-package behavior test passes without this patch.
 * Then remove this module, drop it from PATCHES in ../patch-brometal.mjs and the scripts allowlist
 * in ../tests/repository-policy.test.mjs, clean-install, and rerun the behavior and full tests.
 */
export const name = 'sampler-lod-clamp';

export async function apply({ replace }) {
  await replace(
    'dist/runtime/texture.d.ts',
    '    anisotropy?: number;\n}\n',
    `    anisotropy?: number;
    /**
     * Narrow the mip range this texture may resolve to, as standard WebGPU
     * sampler clamps. Both are optional and unset means WebGPU's own defaults
     * (0 and 32), not a policy chosen here.
     *
     * \`lodMaxClamp: 0\` pins sampling to the base level, which is how a caller
     * asks for "never let this blur away" — an atlas whose coarse mips average
     * across tile boundaries, or a lookup table whose low mips are meaningless.
     */
    lodMinClamp?: number;
    lodMaxClamp?: number;
}
`,
  );

  // Only the 2D path. The 3D sampler is built separately and has no mip chain to clamp, and the
  // render-target sampler is not built from TextureOptions at all.
  await replace(
    'dist/runtime/webgpu.js',
    `        // Anisotropy needs linear filtering on every axis; the spec clamps the
        // request to whatever the adapter supports.
        maxAnisotropy: smooth ? Math.max(1, Math.floor(options.anisotropy ?? 1)) : 1,
    });`,
    `        // Anisotropy needs linear filtering on every axis; the spec clamps the
        // request to whatever the adapter supports.
        maxAnisotropy: smooth ? Math.max(1, Math.floor(options.anisotropy ?? 1)) : 1,
        // Undefined is the same as omitted for a WebIDL dictionary member, so an
        // unset clamp keeps WebGPU's defaults rather than a value chosen here.
        lodMinClamp: options.lodMinClamp,
        lodMaxClamp: options.lodMaxClamp,
    });`,
  );

  // An inverted range is a caller error that WebGPU reports as a validation failure detached from
  // the call that caused it. Failing at the createTexture call names the actual mistake.
  await replace(
    'dist/runtime/webgpu.js',
    `    const filter = smooth ? 'linear' : 'nearest';
    const address = options.wrap === 'clamp' ? 'clamp-to-edge' : 'repeat';
    const sampler = device.createSampler({`,
    `    const filter = smooth ? 'linear' : 'nearest';
    const address = options.wrap === 'clamp' ? 'clamp-to-edge' : 'repeat';
    if (options.lodMinClamp !== undefined && options.lodMaxClamp !== undefined
        && options.lodMinClamp > options.lodMaxClamp) {
        throw new Error(\`BroMetal: lodMinClamp (\${options.lodMinClamp}) is above lodMaxClamp (\${options.lodMaxClamp})\`);
    }
    const sampler = device.createSampler({`,
  );
}
