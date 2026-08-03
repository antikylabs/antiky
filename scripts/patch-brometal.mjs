import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.resolve(import.meta.dirname, '../packages/demos/node_modules/brometal');
const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));

if (metadata.version !== '0.14.0') {
  throw new Error(`Expected BroMetal 0.14.0, found ${metadata.version}. Review the cut-out patch before upgrading.`);
}

async function replace(relativePath, before, after) {
  const file = path.join(packageRoot, relativePath);
  const source = await readFile(file, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`BroMetal patch target changed: ${relativePath}`);
  await writeFile(file, source.replace(before, after));
}

await replace(
  'dist/dsl/builtins.js',
  "export function texture() {\n    return gpuOnly('texture');\n}\n",
  "export function texture() {\n    return gpuOnly('texture');\n}\nexport function discard() {\n    return gpuOnly('discard');\n}\n",
);
await replace(
  'dist/dsl/builtins.d.ts',
  'export declare function texture(sampler: Sampler3D, uvw: Vec3): Vec4;\n',
  'export declare function texture(sampler: Sampler3D, uvw: Vec3): Vec4;\nexport declare function discard(): void;\n',
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
await replace(
  'dist/runtime/context.js',
  'BroMetal requires it — shaders are compiled to WGSL and compute passes have no WebGL equivalent.',
  'BroMetal requires it — shaders and compute passes run on WebGPU.',
);
