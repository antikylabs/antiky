/**
 * Give the DSL a `sampler2DArray`, so a set of tiles can be layers instead of one packed image.
 *
 * WGSL has had `texture_2d_array<f32>` and `textureSample(t, s, uv, layer)` since 1.0, WebGPU has
 * `depthOrArrayLayers` on `GPUTextureDescriptor` and `'2d-array'` on `GPUTextureBindingLayout`, and
 * `copyExternalImageToTexture` takes a `z` origin. Every piece of this already exists in the
 * platform; clean BroMetal 0.18.0 simply has no type that reaches it. Its sampler types are `sampler2D`
 * and `sampler3D`, the runtime creates textures as `size: [width, height]`, and the bind group
 * layout hard-codes `viewDimension: entry.type === 'sampler3D' ? '3d' : '2d'`.
 *
 * Why it matters: an atlas mipped as one image averages across tile boundaries at the coarse
 * levels, which is why an atlas needs a gutter at all. Layers delete the defect rather than
 * mitigating it — each layer's mip chain is built from that layer alone, so there is no adjacent
 * tile in the same image to average into.
 *
 * **`sampler3D` is not a substitute.** A 3D texture's mips blend along Z as well, so slices would
 * average into each other: the same defect by a different route. That is why this adds a type
 * rather than reusing one.
 *
 * ## The 11 files `sampler3D` touches, and what each one needed
 *
 * `sampler3D` appears at 29 sites. Every one was read; three did not want the array type, and
 * saying which is the point of this note.
 *
 * - `dsl/types` — GPU_TYPES, the `Sampler2DArray` brand, `GpuValue`. Yes.
 * - `dsl/builtins` — a third `texture()` overload taking a layer. Yes.
 * - `compiler/parse` — the uniform-record type check and the helper-parameter annotation map. Yes.
 * - `compiler/ir` — `IrType`. Yes.
 * - `compiler/analyze` — the `texture()` signature and the "sampler variables are not supported"
 *   guard. Yes.
 * - `compiler/layout` — component count, uniform kind, and the two places that give a sampler a
 *   binding pair instead of a slot in the uniform block. Yes.
 * - `compiler/emit-wgsl` — the declaration, the helper parameter expansion, and the call. Yes.
 * - `runtime/uniforms` — `UniformValue`. Yes (the type only; `checkUniformValue` never sees a
 *   sampler, because the runtime routes samplers to `textureBindings` before it is reached).
 * - `runtime/webgpu` — the bind group layout, the placeholder, the setter, per-layer mips and the
 *   texture builder. Yes, and this is where the real work is.
 * - `compiler/emit-glsl` — **no.** Nothing in `dist/` imports it; `compileShaderSource` emits WGSL
 *   only. Adding an array type to a backend no code path reaches would ship untested GLSL that
 *   claims to work. It belongs in the same change that revives that backend, if it is revived.
 * - `runtime/texture` — `createTextureArray` and `loadTextureArray` are new rather than edits, so
 *   there was no `sampler3D` site to follow. `createTexture3D`'s validation shape is followed
 *   instead: check the caller's data before touching the device, and name the mistake.
 *
 * ## Two comments in the code being changed, and what happened to them
 *
 * Both survive intact and both are extended rather than replaced.
 *
 * 1. *"A 2D view cannot fill a slot the layout declared as 3d — WebGPU rejects the bind group
 *    outright rather than ignoring it — so an unset sampler3D needs a volume of its own to fall
 *    back on."* Entirely correct, and it is the reason an unset `sampler2DArray` needs a layered
 *    placeholder too. The patch adds one for exactly the stated reason.
 * 2. *"A sampler parameter becomes two: WGSL keeps the texture and the sampler as separate
 *    objects."* Correct and unchanged; the array type expands the same way.
 *
 * ## Two shapes chosen deliberately
 *
 * `generateWebgpuMipmaps` takes a layer count and renders one chain per layer, reading and writing
 * a view pinned to a single layer. It cannot be a loop over the existing function because the
 * existing function's views are unqualified, and an unqualified view of a layered texture is a
 * `2d-array` view — which is both an invalid render attachment and, as a source, exactly the
 * cross-layer read this change exists to make impossible.
 *
 * `buildWebgpuTextureArray` takes a `GPUDevice` rather than a renderer, and
 * `createWebgpuTextureArray` is the one-line wrapper that looks the device up. That is the same
 * shape `generateWebgpuMipmaps` and `mipmapKit` already use in this file, and it is what lets the
 * upload plan be asserted without a GPU.
 *
 * The sampler descriptor repeats `lodMinClamp`/`lodMaxClamp` rather than sharing a builder with
 * `createWebgpuTexture`. The two are separate upstream contributions and either may be retired
 * first, so neither module may depend on the other's text. Unset stays undefined, which WebGPU
 * treats as omitted.
 *
 * **Upstream: not submitted.** The owner deferred upstream submission for this pass.
 * Retire only after a future focused pull request is merged, Antiky installs a published BroMetal
 * release containing this behavior, and the clean-package behavior test passes without this patch.
 * Then remove this module, drop it from PATCHES in ../patch-brometal.mjs and the scripts allowlist
 * in ../tests/repository-policy.test.mjs, clean-install, and rerun the behavior and full tests.
 */
export const name = 'texture-array-sampler';

export async function apply({ replace }) {
  await applyDslTypes(replace);
  await applyCompiler(replace);
  await applyRuntime(replace);
  await applyExports(replace);
}

/** The DSL surface: the type name a shader may write, and the handle it becomes in shader code. */
async function applyDslTypes(replace) {
  await replace(
    'dist/dsl/types.js',
    `    'sampler2D',
    'sampler3D',
    'storage',
];`,
    `    'sampler2D',
    'sampler3D',
    'sampler2DArray',
    'storage',
];`,
  );

  await replace(
    'dist/dsl/types.d.ts',
    `export declare const GPU_TYPES: readonly ["float", "vec2", "vec3", "vec4", "mat4", "sampler2D", "sampler3D", "storage"];`,
    `export declare const GPU_TYPES: readonly ["float", "vec2", "vec3", "vec4", "mat4", "sampler2D", "sampler3D", "sampler2DArray", "storage"];`,
  );

  await replace(
    'dist/dsl/types.d.ts',
    `export interface Sampler3D {
    readonly __brand: 'Sampler3D';
}`,
    `export interface Sampler3D {
    readonly __brand: 'Sampler3D';
}
/**
 * A stack of same-sized 2D textures, sampled with a vec2 and a layer index.
 *
 * Unlike a 3D texture, layers never blend into each other: filtering and the mip chain both stay
 * inside the layer named by the index. That is what makes this the right shape for an atlas — each
 * tile is its own layer, so a coarse mip cannot average in the tile next door, and the tile needs
 * no gutter to protect it.
 */
export interface Sampler2DArray {
    readonly __brand: 'Sampler2DArray';
}`,
  );

  await replace(
    'dist/dsl/types.d.ts',
    `T extends 'sampler3D' ? Sampler3D : Storage<unknown>;`,
    `T extends 'sampler3D' ? Sampler3D : T extends 'sampler2DArray' ? Sampler2DArray : Storage<unknown>;`,
  );

  await replace(
    'dist/dsl/builtins.d.ts',
    `import type { Sampler2D, Sampler3D, Storage, Vec2, Vec3, Vec4 } from './types.js';`,
    `import type { Sampler2D, Sampler2DArray, Sampler3D, Storage, Vec2, Vec3, Vec4 } from './types.js';`,
  );

  await replace(
    'dist/dsl/builtins.d.ts',
    `export declare function texture(sampler: Sampler3D, uvw: Vec3): Vec4;`,
    `export declare function texture(sampler: Sampler3D, uvw: Vec3): Vec4;
/** Layer \`layer\` of an array texture, at \`uv\`. The index is rounded toward zero, as WGSL does. */
export declare function texture(sampler: Sampler2DArray, uv: Vec2, layer: number): Vec4;`,
  );
}

/** Parse, analyze, layout and emit. The type has to survive all four to reach WGSL. */
async function applyCompiler(replace) {
  await replace(
    'dist/compiler/ir.d.ts',
    `export type IrType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat4' | 'sampler2D' | 'sampler3D' | 'storage' | 'bool';`,
    `export type IrType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat4' | 'sampler2D' | 'sampler3D' | 'sampler2DArray' | 'storage' | 'bool';`,
  );

  await replace(
    'dist/compiler/parse.d.ts',
    `export type HelperType = "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D" | "sampler3D";`,
    `export type HelperType = "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D" | "sampler3D" | "sampler2DArray";`,
  );

  await replace(
    'dist/compiler/parse.js',
    `            Sampler2D: "sampler2D",
            Sampler3D: "sampler3D",`,
    `            Sampler2D: "sampler2D",
            Sampler3D: "sampler3D",
            Sampler2DArray: "sampler2DArray",`,
  );

  // Samplers are uniforms only; an attribute or varying cannot carry one. The array type is no
  // different, so it joins the same guard rather than getting an exemption.
  await replace(
    'dist/compiler/parse.js',
    `        if ((typeName === "mat4" ||
            typeName === "sampler2D" ||
            typeName === "sampler3D") &&
            !options.allowMat4) {`,
    `        if ((typeName === "mat4" ||
            typeName === "sampler2D" ||
            typeName === "sampler3D" ||
            typeName === "sampler2DArray") &&
            !options.allowMat4) {`,
  );

  // Three arguments rather than two. WGSL's layer is an integer and this DSL has only floats, so
  // the signature takes a float and the emitter narrows it at the call.
  await replace(
    'dist/compiler/analyze.js',
    `        signature: 'texture(sampler, uv) expects a sampler2D with a vec2, or a sampler3D with a vec3',
        check: (args) => args.length === 2 &&
            ((args[0].type === 'sampler2D' && args[1].type === 'vec2') ||
                (args[0].type === 'sampler3D' && args[1].type === 'vec3'))
            ? 'vec4'
            : null,`,
    `        signature: 'texture(sampler, uv) expects a sampler2D with a vec2, a sampler3D with a vec3, '
            + 'or a sampler2DArray with a vec2 and a float layer',
        check: (args) => (args.length === 2 &&
            ((args[0].type === 'sampler2D' && args[1].type === 'vec2') ||
                (args[0].type === 'sampler3D' && args[1].type === 'vec3')))
            || (args.length === 3 &&
                args[0].type === 'sampler2DArray' &&
                args[1].type === 'vec2' &&
                args[2].type === 'float')
            ? 'vec4'
            : null,`,
  );

  await replace(
    'dist/compiler/analyze.js',
    `    if (expr.type === 'sampler2D' || expr.type === 'sampler3D') {
        throw errorAt(ctx.sourceFile, declaration, \`sampler variables are not supported — pass the sampler uniform directly to texture()\`);`,
    `    if (expr.type === 'sampler2D' || expr.type === 'sampler3D' || expr.type === 'sampler2DArray') {
        throw errorAt(ctx.sourceFile, declaration, \`sampler variables are not supported — pass the sampler uniform directly to texture()\`);`,
  );

  await replace(
    'dist/compiler/layout.js',
    `    sampler2D: 1,
    sampler3D: 1,
    storage: 1,
};`,
    `    sampler2D: 1,
    sampler3D: 1,
    sampler2DArray: 1,
    storage: 1,
};`,
  );

  await replace(
    'dist/compiler/layout.js',
    `    sampler2D: '1i',
    sampler3D: '1i',
    storage: '1i',
};`,
    `    sampler2D: '1i',
    sampler3D: '1i',
    sampler2DArray: '1i',
    storage: '1i',
};`,
  );

  // A sampler takes a binding pair instead of a slot in the uniform block, whatever its dimension.
  // Spelling the set once stops the two lists from drifting apart, which is the failure a third
  // member makes likely.
  await replace(
    'dist/compiler/layout.js',
    `const UNIFORM_KINDS = {`,
    `/** Uniform types that bind as a texture rather than as bytes in the uniform block. */
const SAMPLER_TYPES = new Set(['sampler2D', 'sampler3D', 'sampler2DArray']);
const UNIFORM_KINDS = {`,
  );

  await replace(
    'dist/compiler/layout.js',
    `        if (type === 'sampler2D' || type === 'sampler3D' || type === 'storage') {`,
    `        if (SAMPLER_TYPES.has(type) || type === 'storage') {`,
  );

  await replace(
    'dist/compiler/layout.js',
    `        if (entry.type === 'sampler2D' || entry.type === 'sampler3D') {
            entry.textureBinding = nextBinding++;
            entry.samplerBinding = nextBinding++;`,
    `        if (SAMPLER_TYPES.has(entry.type)) {
            entry.textureBinding = nextBinding++;
            entry.samplerBinding = nextBinding++;`,
  );

  await applyEmitWgsl(replace);
}

async function applyEmitWgsl(replace) {
  // One table instead of a two-way ternary repeated at each site. A third dimension is exactly the
  // change a `? '3d' : '2d'` cannot absorb without silently answering '2d' for the new type.
  await replace(
    'dist/compiler/emit-wgsl.js',
    `    sampler3D: '(sampler3D has no WGSL value type)',
    storage: '(storage has no WGSL value type)',
    bool: 'bool',
};`,
    `    sampler3D: '(sampler3D has no WGSL value type)',
    sampler2DArray: '(sampler2DArray has no WGSL value type)',
    storage: '(storage has no WGSL value type)',
    bool: 'bool',
};
/** The WGSL texture dimension each sampler type declares as. */
const TEXTURE_DIMENSIONS = {
    sampler2D: '2d',
    sampler3D: '3d',
    sampler2DArray: '2d_array',
};
const isSamplerType = (type) => TEXTURE_DIMENSIONS[type] !== undefined;`,
  );

  await replace(
    'dist/compiler/emit-wgsl.js',
    `    const blockMembers = layout.uniforms.filter((entry) => entry.type !== 'sampler2D' && entry.type !== 'sampler3D' && entry.type !== 'storage');`,
    `    const blockMembers = layout.uniforms.filter((entry) => !isSamplerType(entry.type) && entry.type !== 'storage');`,
  );

  await replace(
    'dist/compiler/emit-wgsl.js',
    `        if (entry.type === 'sampler2D' || entry.type === 'sampler3D') {
            const dimension = entry.type === 'sampler3D' ? '3d' : '2d';
            lines.push(\`@group(0) @binding(\${entry.textureBinding}) var \${entry.name} : texture_\${dimension}<f32>;\`);`,
    `        if (isSamplerType(entry.type)) {
            const dimension = TEXTURE_DIMENSIONS[entry.type];
            lines.push(\`@group(0) @binding(\${entry.textureBinding}) var \${entry.name} : texture_\${dimension}<f32>;\`);`,
  );

  await replace(
    'dist/compiler/emit-wgsl.js',
    `        uniforms: new Set(Object.keys(ir.uniforms).filter((name) => ir.uniforms[name] !== 'sampler2D' &&
            ir.uniforms[name] !== 'sampler3D' &&
            ir.uniforms[name] !== 'storage')),`,
    `        uniforms: new Set(Object.keys(ir.uniforms).filter((name) => !isSamplerType(ir.uniforms[name]) &&
            ir.uniforms[name] !== 'storage')),`,
  );

  await replace(
    'dist/compiler/emit-wgsl.js',
    `    const params = helper.params
        .map((param) => param.type === 'sampler2D' || param.type === 'sampler3D'
        ? \`\${param.name} : texture_\${param.type === 'sampler3D' ? '3d' : '2d'}<f32>, \${param.name}_sampler : sampler\`
        : \`\${param.name} : \${WGSL_TYPES[param.type]}\`)
        .join(', ');`,
    `    const params = helper.params
        .map((param) => isSamplerType(param.type)
        ? \`\${param.name} : texture_\${TEXTURE_DIMENSIONS[param.type]}<f32>, \${param.name}_sampler : sampler\`
        : \`\${param.name} : \${WGSL_TYPES[param.type]}\`)
        .join(', ');`,
  );

  await replace(
    'dist/compiler/emit-wgsl.js',
    `    const rendered = args
        .map((arg) => (arg.type === 'sampler2D' || arg.type === 'sampler3D') && arg.kind === 'ident'
        ? \`\${arg.name}, \${arg.name}_sampler\`
        : emitExpr(arg, ctx, 0))
        .join(', ');`,
    `    const rendered = args
        .map((arg) => isSamplerType(arg.type) && arg.kind === 'ident'
        ? \`\${arg.name}, \${arg.name}_sampler\`
        : emitExpr(arg, ctx, 0))
        .join(', ');`,
  );

  // The layer argument. WGSL takes an integer index and the DSL has only floats, so it is narrowed
  // here rather than making every caller write the conversion.
  await replace(
    'dist/compiler/emit-wgsl.js',
    `        const uv = emitExpr(args[1], ctx, 0);
        // textureSample needs uniform control flow / implicit derivatives —
        // vertex stages must sample an explicit level instead.
        return ctx.stage === 'fragment'
            ? \`textureSample(\${sampler.name}, \${sampler.name}_sampler, \${uv})\`
            : \`textureSampleLevel(\${sampler.name}, \${sampler.name}_sampler, \${uv}, 0.0)\`;`,
    `        const uv = emitExpr(args[1], ctx, 0);
        const layer = args.length > 2 ? \`, i32(\${emitExpr(args[2], ctx, 0)})\` : '';
        // textureSample needs uniform control flow / implicit derivatives —
        // vertex stages must sample an explicit level instead.
        return ctx.stage === 'fragment'
            ? \`textureSample(\${sampler.name}, \${sampler.name}_sampler, \${uv}\${layer})\`
            : \`textureSampleLevel(\${sampler.name}, \${sampler.name}_sampler, \${uv}\${layer}, 0.0)\`;`,
  );
}

/** The WebGPU side: the binding, the placeholder, per-layer mips, and the texture itself. */
async function applyRuntime(replace) {
  await replace(
    'dist/runtime/uniforms.d.ts',
    `T extends 'sampler2D' | 'sampler3D' ? BroMetalTexture`,
    `T extends 'sampler2D' | 'sampler3D' | 'sampler2DArray' ? BroMetalTexture`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `const TARGET_FORMAT = 'rgba16float';
const INTERNALS = new WeakMap();`,
    `const TARGET_FORMAT = 'rgba16float';
/**
 * The GPUTextureViewDimension each sampler type binds as.
 *
 * A table rather than a ternary because WebGPU validates the whole bind group or none of it: a view
 * whose dimension does not match the layout rejects the group outright, and a two-way \`? '3d' : '2d'\`
 * answers '2d' for any type it has not been taught about.
 */
const VIEW_DIMENSIONS = {
    sampler2D: '2d',
    sampler3D: '3d',
    sampler2DArray: '2d-array',
};
const isSamplerType = (type) => VIEW_DIMENSIONS[type] !== undefined;
const INTERNALS = new WeakMap();`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `        if (entry.type === 'sampler2D' || entry.type === 'sampler3D') {
            bglEntries.push({
                binding: entry.textureBinding,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                texture: { sampleType: 'float', viewDimension: entry.type === 'sampler3D' ? '3d' : '2d' },
            });`,
    `        if (isSamplerType(entry.type)) {
            bglEntries.push({
                binding: entry.textureBinding,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                texture: { sampleType: 'float', viewDimension: VIEW_DIMENSIONS[entry.type] },
            });`,
  );

  // The existing comment explains exactly why this is needed, and it applies unchanged to a layered
  // slot: a 2D view cannot fill one either.
  await replace(
    'dist/runtime/webgpu.js',
    `    const placeholderVolumeBinding = {
        view: placeholderVolume.createView({ dimension: '3d' }),
        sampler: placeholderSampler,
    };`,
    `    const placeholderVolumeBinding = {
        view: placeholderVolume.createView({ dimension: '3d' }),
        sampler: placeholderSampler,
    };
    // And an unset sampler2DArray needs a layered one, for the same reason.
    const placeholderLayer = device.createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture({ texture: placeholderLayer }, new Uint8Array([160, 160, 170, 255]), { bytesPerRow: 4, rowsPerImage: 1 }, { width: 1, height: 1, depthOrArrayLayers: 1 });
    const placeholderLayerBinding = {
        view: placeholderLayer.createView({ dimension: '2d-array' }),
        sampler: placeholderSampler,
    };
    const placeholderFor = {
        sampler2D: placeholderBinding,
        sampler3D: placeholderVolumeBinding,
        sampler2DArray: placeholderLayerBinding,
    };`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `            if (entry.type === 'sampler2D' || entry.type === 'sampler3D') {
                const fallback = entry.type === 'sampler3D' ? placeholderVolumeBinding : placeholderBinding;`,
    `            if (isSamplerType(entry.type)) {
                const fallback = placeholderFor[entry.type];`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `        if (entry.type === 'sampler2D' || entry.type === 'sampler3D') {
            uniforms[entry.name] = {`,
    `        if (isSamplerType(entry.type)) {
            uniforms[entry.name] = {`,
  );

  await applyMipmaps(replace);
  await applyTextureArray(replace);
}

async function applyMipmaps(replace) {
  await replace(
    'dist/runtime/webgpu.js',
    `/** Renders each mip level from the one above it, in a single command buffer. */
function generateWebgpuMipmaps(device, texture, levels) {
    const kit = mipmapKit(device);
    const encoder = device.createCommandEncoder();
    for (let level = 1; level < levels; level++) {
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }),
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });
        pass.setPipeline(kit.pipeline);
        pass.setBindGroup(0, device.createBindGroup({
            layout: kit.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }) },
                { binding: 1, resource: kit.sampler },
            ],
        }));
        pass.draw(3);
        pass.end();
    }
    device.queue.submit([encoder.finish()]);
}`,
    `/**
 * Renders each mip level from the one above it, in a single command buffer, one chain per layer.
 *
 * Every view names a single layer and a single level. That is not tidiness: an unqualified view of
 * a layered texture is a '2d-array' view, which is both an invalid render attachment and — as the
 * source — the one thing that would let a coarse mip of one layer read another. Pinning the layer
 * is what makes cross-layer bleeding impossible rather than merely unlikely, which is the whole
 * reason an atlas is worth splitting into layers at all.
 *
 * A plain 2D texture is the one-layer case and takes exactly the path it always did.
 */
export function generateWebgpuMipmaps(device, texture, levels, layers = 1) {
    const kit = mipmapKit(device);
    const encoder = device.createCommandEncoder();
    for (let layer = 0; layer < layers; layer++) {
        const slice = { baseArrayLayer: layer, arrayLayerCount: 1, dimension: '2d' };
        for (let level = 1; level < levels; level++) {
            const pass = encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: texture.createView({ ...slice, baseMipLevel: level, mipLevelCount: 1 }),
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            pass.setPipeline(kit.pipeline);
            pass.setBindGroup(0, device.createBindGroup({
                layout: kit.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: texture.createView({ ...slice, baseMipLevel: level - 1, mipLevelCount: 1 }) },
                    { binding: 1, resource: kit.sampler },
                ],
            }));
            pass.draw(3);
            pass.end();
        }
    }
    device.queue.submit([encoder.finish()]);
}`,
  );
}

async function applyTextureArray(replace) {
  await replace(
    'dist/runtime/webgpu.js',
    `export function createWebgpuTexture(renderer, source, options) {`,
    `/**
 * A stack of same-sized images as one texture, each layer carrying its own mip chain.
 *
 * Takes a device rather than a renderer so the upload plan can be asserted without a GPU, which is
 * the same shape \`generateWebgpuMipmaps\` and \`mipmapKit\` already use in this file.
 */
export function buildWebgpuTextureArray(device, sources, options) {
    if (sources.length === 0) {
        throw new Error('BroMetal: a texture array needs at least one layer');
    }
    const sizeOf = (source) => ({
        width: 'width' in source ? source.width : 1,
        height: 'height' in source ? source.height : 1,
    });
    const { width, height } = sizeOf(sources[0]);
    // Every layer shares one GPUTexture, so a mismatch is the caller's mistake and not something to
    // paper over by scaling. WebGPU would report it as a copy-size failure detached from this call.
    sources.forEach((source, index) => {
        const size = sizeOf(source);
        if (size.width !== width || size.height !== height) {
            throw new Error(\`BroMetal: texture array layer \${index} is \${size.width}x\${size.height} but layer 0 is \${width}x\${height}\`);
        }
    });
    const smooth = options.filter !== 'nearest';
    const mipLevels = smooth ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1;
    const gpuTexture = device.createTexture({
        size: { width, height, depthOrArrayLayers: sources.length },
        mipLevelCount: mipLevels,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    sources.forEach((source, index) => {
        device.queue.copyExternalImageToTexture({ source: source, flipY: options.flipY ?? true }, { texture: gpuTexture, origin: { x: 0, y: 0, z: index } }, [width, height]);
    });
    if (mipLevels > 1) {
        generateWebgpuMipmaps(device, gpuTexture, mipLevels, sources.length);
    }
    const filter = smooth ? 'linear' : 'nearest';
    const address = options.wrap === 'clamp' ? 'clamp-to-edge' : 'repeat';
    const binding = {
        view: gpuTexture.createView({ dimension: '2d-array' }),
        sampler: device.createSampler({
            magFilter: filter,
            minFilter: filter,
            mipmapFilter: filter,
            addressModeU: address,
            addressModeV: address,
            maxAnisotropy: smooth ? Math.max(1, Math.floor(options.anisotropy ?? 1)) : 1,
            // Undefined is the same as omitted for a WebIDL dictionary member, so an unset clamp
            // keeps WebGPU's defaults.
            lodMinClamp: options.lodMinClamp,
            lodMaxClamp: options.lodMaxClamp,
        }),
    };
    const texture = {
        layers: sources.length,
        dispose() {
            gpuTexture.destroy();
        },
    };
    texture.__wgpu = binding;
    return texture;
}
export function createWebgpuTextureArray(renderer, sources, options) {
    return buildWebgpuTextureArray(webgpuInternals(renderer).device, sources, options);
}
export function createWebgpuTexture(renderer, source, options) {`,
  );

  await replace(
    'dist/runtime/texture.js',
    `import { createWebgpuTexture, createWebgpuTexture3D } from './webgpu.js';`,
    `import { createWebgpuTexture, createWebgpuTexture3D, createWebgpuTextureArray } from './webgpu.js';`,
  );

  await replace(
    'dist/runtime/texture.js',
    `export function createTexture(renderer, source, options = {}) {
    return createWebgpuTexture(renderer, source, options);
}`,
    `export function createTexture(renderer, source, options = {}) {
    return createWebgpuTexture(renderer, source, options);
}
/**
 * A stack of same-sized images as one texture, sampled with a layer index.
 *
 * Each layer is mipped on its own, so nothing a layer contains can reach any other layer at any
 * level. An atlas built this way needs no gutter between its tiles.
 */
export function createTextureArray(renderer, sources, options = {}) {
    return createWebgpuTextureArray(renderer, sources, options);
}
/** \`createTextureArray\` from a list of URLs, one layer per URL, in the order given. */
export async function loadTextureArray(renderer, urls, options = {}) {
    const bitmaps = await Promise.all(urls.map(async (url) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = url;
        try {
            await image.decode();
        }
        catch {
            throw new Error(\`BroMetal: failed to load texture '\${url}'\`);
        }
        return createImageBitmap(image);
    }));
    const texture = createTextureArray(renderer, bitmaps, options);
    // The decoded bitmaps have served their purpose and hold real memory until something closes
    // them. Nothing else can know when that moment arrived.
    for (const bitmap of bitmaps) bitmap.close();
    return texture;
}`,
  );

  await replace(
    'dist/runtime/texture.d.ts',
    `export interface BroMetalTexture {
    dispose(): void;
}`,
    `export interface BroMetalTexture {
    dispose(): void;
}
/** A texture array, which also reports how many layers a caller may index. */
export interface BroMetalTextureArray extends BroMetalTexture {
    readonly layers: number;
}`,
  );

  await replace(
    'dist/runtime/texture.d.ts',
    `export declare function loadTexture(renderer: Renderer, url: string, options?: TextureOptions): Promise<BroMetalTexture>;`,
    `export declare function loadTexture(renderer: Renderer, url: string, options?: TextureOptions): Promise<BroMetalTexture>;
/**
 * A stack of same-sized images as one texture, sampled with a layer index from a \`sampler2DArray\`.
 *
 * Each layer carries its own mip chain, so no level of one layer contains any part of another. That
 * is what lets an atlas drop its gutter: the tiles are not in the same image any more.
 *
 * Every layer must be the same size, which is checked before the device is touched.
 */
export declare function createTextureArray(renderer: Renderer, sources: readonly TexImageSource[], options?: TextureOptions): BroMetalTextureArray;
/** \`createTextureArray\` from a list of URLs, one layer per URL, in the order given. */
export declare function loadTextureArray(renderer: Renderer, urls: readonly string[], options?: TextureOptions): Promise<BroMetalTextureArray>;`,
  );
}

/** The package surface, so a consumer can reach any of this without a deep import. */
async function applyExports(replace) {
  await replace(
    'dist/index.js',
    `export { createTexture, createTexture3D, loadTexture } from './runtime/texture.js';`,
    `export { createTexture, createTexture3D, createTextureArray, loadTexture, loadTextureArray } from './runtime/texture.js';`,
  );

  await replace(
    'dist/index.d.ts',
    `export { createTexture, createTexture3D, loadTexture } from './runtime/texture.js';`,
    `export { createTexture, createTexture3D, createTextureArray, loadTexture, loadTextureArray } from './runtime/texture.js';`,
  );

  await replace(
    'dist/index.d.ts',
    `export type { BroMetalTexture, TextureOptions, VolumeSource } from './runtime/texture.js';`,
    `export type { BroMetalTexture, BroMetalTextureArray, TextureOptions, VolumeSource } from './runtime/texture.js';`,
  );

  await replace(
    'dist/index.d.ts',
    `Mat4, Sampler2D, Sampler3D, ShaderDefinition,`,
    `Mat4, Sampler2D, Sampler2DArray, Sampler3D, ShaderDefinition,`,
  );
}
