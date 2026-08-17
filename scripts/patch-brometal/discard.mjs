/**
 * Add discard() to the shader DSL.
 *
 * Clean BroMetal 0.18.0 has no way to kill a fragment. Alpha-cut foliage, decals and any cut-out
 * material need one. This threads discard() through the builtins, the public surface, the
 * analyzer, the WGSL emitter and the optimizer, and makes calling it as an expression an error
 * rather than silently producing a value.
 *
 * **Upstream: https://github.com/ericdrowell/brometal/pull/5 — open on 2026-08-16.**
 * shader dsl: add discard() for cut-out fragments
 *
 * Retire only after Antiky installs a published BroMetal release that contains this behavior and
 * the clean-package behavior test passes without this patch. Then remove this module, drop it from
 * PATCHES in ../patch-brometal.mjs and the scripts allowlist in
 * ../tests/repository-policy.test.mjs, clean-install, and rerun the BroMetal behavior and full tests.
 */
export const name = 'discard';

export async function apply({ replace, replaceSection }) {
  await replace(
    'dist/dsl/builtins.js',
    "export function texture() {\n    return gpuOnly('texture');\n}\n",
    "export function texture() {\n    return gpuOnly('texture');\n}\nexport function discard() {\n    return gpuOnly('discard');\n}\n",
  );
  await replace(
    'dist/dsl/builtins.d.ts',
    'export declare function texture(sampler: Sampler2D, uv: Vec2): Vec4;\n',
    'export declare function texture(sampler: Sampler2D, uv: Vec2): Vec4;\nexport declare function discard(): void;\n',
  );
  await replace(
    'dist/index.js',
    'distance, dot, exp,',
    'distance, discard, dot, exp,',
  );
  await replace(
    'dist/index.d.ts',
    'distance, dot, exp,',
    'distance, discard, dot, exp,',
  );
  await replace(
    'dist/compiler/analyze.js',
    'function lowerMutation(ctx, scope, expr, options) {\n',
    "function lowerMutation(ctx, scope, expr, options) {\n    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'discard') {\n        if (ctx.stage !== 'fragment') {\n            throw errorAt(ctx.sourceFile, expr, 'discard() is only valid in fragment()');\n        }\n        if (expr.arguments.length > 0) {\n            throw errorAt(ctx.sourceFile, expr, 'discard() takes no arguments');\n        }\n        return { kind: 'discard' };\n    }\n",
  );
  await replace(
    'dist/compiler/analyze.js',
    "    const callee = node.expression.text;\n    if (scope.lookup(callee) !== undefined) {\n",
    "    const callee = node.expression.text;\n    if (callee === 'discard') {\n        throw errorAt(ctx.sourceFile, node, 'discard() produces no value — call it as its own statement');\n    }\n    if (scope.lookup(callee) !== undefined) {\n",
  );
  await replace(
    'dist/compiler/emit-wgsl.js',
    "            case 'storageWrite':\n                lines.push(`${indent}${statement.buffer}[u32(${emitExpr(statement.index, ctx, 0)})] = ${emitExpr(statement.value, ctx, 0)};`);\n                break;\n",
    "            case 'storageWrite':\n                lines.push(`${indent}${statement.buffer}[u32(${emitExpr(statement.index, ctx, 0)})] = ${emitExpr(statement.value, ctx, 0)};`);\n                break;\n            case 'discard':\n                lines.push(`${indent}discard;`);\n                break;\n",
  );
  await replace(
    'dist/compiler/optimize.js',
    "        case 'storageWrite':\n            return { ...statement, index: foldExpr(statement.index), value: foldExpr(statement.value) };\n",
    "        case 'storageWrite':\n            return { ...statement, index: foldExpr(statement.index), value: foldExpr(statement.value) };\n        case 'discard':\n            return statement;\n",
  );
}
