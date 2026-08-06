#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { API_AREAS, SYMBOL_DESCRIPTIONS } from './framework-api-reference-content.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frameworkRoot = resolve(repositoryRoot, 'packages/framework');
const frameworkSourceRoot = resolve(frameworkRoot, 'src');
const frameworkEntry = resolve(frameworkSourceRoot, 'index.ts');
const docsRoot = resolve(repositoryRoot, 'docs/user-facing-docs/framework');
const generatorPath = 'scripts/generate-framework-api-reference.mjs';
const printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed,
  removeComments: true,
});

function fail(message) {
  throw new Error(`Framework API reference: ${message}`);
}

function publicModifiers(modifiers) {
  return modifiers?.filter((modifier) => (
    modifier.kind !== ts.SyntaxKind.ExportKeyword
    && modifier.kind !== ts.SyntaxKind.DefaultKeyword
  ));
}

function isPrivate(member) {
  return member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword) ?? false;
}

function signatureMember(member) {
  if (isPrivate(member)) return null;
  if (ts.isConstructorDeclaration(member)) {
    return ts.factory.updateConstructorDeclaration(
      member,
      publicModifiers(member.modifiers),
      member.parameters,
      undefined,
    );
  }
  if (ts.isMethodDeclaration(member)) {
    return ts.factory.updateMethodDeclaration(
      member,
      publicModifiers(member.modifiers),
      member.asteriskToken,
      member.name,
      member.questionToken,
      member.typeParameters,
      member.parameters,
      member.type,
      undefined,
    );
  }
  if (ts.isGetAccessorDeclaration(member)) {
    return ts.factory.updateGetAccessorDeclaration(
      member,
      publicModifiers(member.modifiers),
      member.name,
      member.parameters,
      member.type,
      undefined,
    );
  }
  if (ts.isSetAccessorDeclaration(member)) {
    return ts.factory.updateSetAccessorDeclaration(
      member,
      publicModifiers(member.modifiers),
      member.name,
      member.parameters,
      undefined,
    );
  }
  return member;
}

function signatureNode(declaration) {
  if (ts.isFunctionDeclaration(declaration)) {
    return ts.factory.updateFunctionDeclaration(
      declaration,
      publicModifiers(declaration.modifiers),
      declaration.asteriskToken,
      declaration.name,
      declaration.typeParameters,
      declaration.parameters,
      declaration.type,
      undefined,
    );
  }
  if (ts.isClassDeclaration(declaration)) {
    return ts.factory.updateClassDeclaration(
      declaration,
      publicModifiers(declaration.modifiers),
      declaration.name,
      declaration.typeParameters,
      declaration.heritageClauses,
      declaration.members.map(signatureMember).filter(Boolean),
    );
  }
  if (ts.isVariableDeclaration(declaration)) {
    const statement = declaration.parent.parent;
    if (!ts.isVariableStatement(statement)) fail(`cannot render variable ${declaration.name.getText()}`);
    return ts.factory.updateVariableStatement(
      statement,
      publicModifiers(statement.modifiers),
      statement.declarationList,
    );
  }
  if (ts.isTypeAliasDeclaration(declaration)) {
    return ts.factory.updateTypeAliasDeclaration(
      declaration,
      publicModifiers(declaration.modifiers),
      declaration.name,
      declaration.typeParameters,
      declaration.type,
    );
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return ts.factory.updateInterfaceDeclaration(
      declaration,
      publicModifiers(declaration.modifiers),
      declaration.name,
      declaration.typeParameters,
      declaration.heritageClauses,
      declaration.members,
    );
  }
  fail(`unsupported declaration kind ${ts.SyntaxKind[declaration.kind]}`);
}

function declarationKind(declaration) {
  if (ts.isFunctionDeclaration(declaration)) return 'function';
  if (ts.isClassDeclaration(declaration)) return 'class';
  if (ts.isVariableDeclaration(declaration)) return 'constant';
  if (ts.isTypeAliasDeclaration(declaration)) return 'type';
  if (ts.isInterfaceDeclaration(declaration)) return 'interface';
  return 'unknown';
}

function renderSignature(declaration) {
  return printer.printNode(
    ts.EmitHint.Unspecified,
    signatureNode(declaration),
    declaration.getSourceFile(),
  ).trim();
}

function loadProgram() {
  const configPath = resolve(frameworkRoot, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    fail(ts.formatDiagnostic(config.error, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => repositoryRoot,
      getNewLine: () => '\n',
    }));
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, frameworkRoot);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    fail(`framework TypeScript must compile before docs can be generated.\n${ts.formatDiagnosticsWithColorAndContext(
      diagnostics,
      {
        getCanonicalFileName: (name) => relative(repositoryRoot, name),
        getCurrentDirectory: () => repositoryRoot,
        getNewLine: () => '\n',
      },
    )}`);
  }
  return program;
}

function publicExports(program) {
  const sourceFile = program.getSourceFile(frameworkEntry);
  if (!sourceFile) fail('cannot load packages/framework/src/index.ts');
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) fail('cannot resolve the framework entry module');

  return checker.getExportsOfModule(moduleSymbol).map((exportSymbol) => {
    const symbol = exportSymbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(exportSymbol)
      : exportSymbol;
    const declaration = symbol.declarations?.find((candidate) => (
      candidate.getSourceFile().fileName.startsWith(frameworkSourceRoot)
    ));
    if (!declaration) fail(`cannot resolve declaration for ${exportSymbol.name}`);
    return {
      name: exportSymbol.name,
      source: relative(frameworkSourceRoot, declaration.getSourceFile().fileName).replaceAll('\\', '/'),
      position: declaration.getStart(declaration.getSourceFile()),
      kind: declarationKind(declaration),
      signature: renderSignature(declaration),
    };
  });
}

function validateContent(exports) {
  const configuredSources = new Set();
  for (const area of API_AREAS) {
    if (!area.slug.startsWith('api-') || area.modules.length === 0) {
      fail(`invalid area configuration for ${area.title}`);
    }
    for (const module of area.modules) {
      if (configuredSources.has(module.source)) fail(`source ${module.source} appears in more than one area`);
      configuredSources.add(module.source);
    }
  }

  const publicNames = new Set(exports.map((entry) => entry.name));
  const undocumented = exports.filter((entry) => !SYMBOL_DESCRIPTIONS[entry.name]);
  const staleDescriptions = Object.keys(SYMBOL_DESCRIPTIONS).filter((name) => !publicNames.has(name));
  const unassigned = exports.filter((entry) => !configuredSources.has(entry.source));
  if (undocumented.length > 0) {
    fail(`add descriptions for new exports: ${undocumented.map((entry) => entry.name).join(', ')}`);
  }
  if (staleDescriptions.length > 0) {
    fail(`remove descriptions for missing exports: ${staleDescriptions.join(', ')}`);
  }
  if (unassigned.length > 0) {
    fail(`assign public source modules to an API area: ${[...new Set(unassigned.map((entry) => entry.source))].join(', ')}`);
  }
}

function sourceFingerprint(program) {
  const hash = createHash('sha256');
  const sources = program.getSourceFiles()
    .filter((source) => (
      source.fileName.startsWith(frameworkSourceRoot)
      && !source.fileName.endsWith('.test.ts')
    ))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
  for (const source of sources) {
    hash.update(relative(frameworkSourceRoot, source.fileName).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(source.text);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

function frontmatter(fingerprint) {
  return [
    '---',
    `generated: ${generatorPath}`,
    `frameworkSource: sha256:${fingerprint}`,
    '---',
    '',
  ];
}

function anchorFor(name) {
  return name.normalize('NFKD').toLowerCase().replace(/[^\p{Letter}\p{Number}_\s-]/gu, '').trim().replace(/\s+/g, '-');
}

function exportsForArea(exports, area) {
  const moduleOrder = new Map(area.modules.map((module, index) => [module.source, index]));
  return exports
    .filter((entry) => moduleOrder.has(entry.source))
    .sort((left, right) => (
      moduleOrder.get(left.source) - moduleOrder.get(right.source)
      || left.position - right.position
      || left.name.localeCompare(right.name)
    ));
}

function renderOverview(exports, fingerprint) {
  const lines = [
    ...frontmatter(fingerprint),
    '# Framework API reference',
    '',
    `This is the complete public API exported by \`@antiky/framework\`. It covers all ${exports.length} public symbols and links each exact TypeScript signature to the workflow that explains why you would use it.`,
    '',
    'Import from the package root. Submodule paths are implementation details and are not part of the public contract.',
    '',
    '## Quick start',
    '',
    '```ts',
    "import { createEngineSession } from '@antiky/framework';",
    '```',
    '',
    'Start with a task guide when you are building a feature. Use the pages below when you need an exact name, input shape, return type, limit, result code, or error.',
    '',
    '## Choose an API area',
    '',
    '| Area | Use it for | Workflow |',
    '| --- | --- | --- |',
  ];

  for (const area of API_AREAS) {
    lines.push(`| [${area.title}](${area.slug}.md) | ${area.summary} | [${area.guide.label}](${area.guide.href}) |`);
  }

  lines.push(
    '',
    '## Shared rules',
    '',
    '- Treat values from files, tools, requests, and other processes as `unknown`; pass them through the matching `parse*` or `create*` function.',
    '- Factory and parser results are validated immutable records. Replace a value through its owning service instead of mutating it.',
    '- Use exported schema and protocol constants instead of copying their numeric values into adapters.',
    '- Branch on stable result or error codes. Paths and messages explain invalid input to a person.',
    '- IDs remain stable across names, reloads, and renderer rebuilds. Runtime and render slots do not.',
    '- Call `dispose()` on an owning session or service when its runtime ends.',
    '',
    '## Public export index',
    '',
  );

  for (const area of API_AREAS) {
    const areaExports = exportsForArea(exports, area);
    const links = areaExports.map((entry) => (
      `[\`${entry.name}\`](${area.slug}.md#${anchorFor(entry.name)})`
    ));
    lines.push(`### ${area.title}`, '', links.join(' · '), '');
  }

  lines.push(
    '## Keeping the reference current',
    '',
    `These pages are generated by \`${generatorPath}\` from the framework entry point, source declarations, and concise purpose text. The source fingerprint above changes whenever reachable production framework source changes.`,
    '',
    'Run `npm run docs:api` after a framework change. `npm run docs:api:check` and framework tests reject missing descriptions, unassigned modules, or stale generated output. The website build regenerates the reference before publishing.',
    '',
  );
  return lines.join('\n');
}

function renderArea(area, exports, fingerprint) {
  const lines = [
    ...frontmatter(fingerprint),
    `# ${area.title}`,
    '',
    area.summary,
    '',
    area.useWhen,
    '',
    `For the task-first workflow, read [${area.guide.label}](${area.guide.href}). Import every API on this page from \`@antiky/framework\`.`,
    '',
    '## Example',
    '',
    '```ts',
    area.example,
    '```',
    '',
  ];

  const bySource = new Map();
  for (const entry of exportsForArea(exports, area)) {
    const entries = bySource.get(entry.source) ?? [];
    entries.push(entry);
    bySource.set(entry.source, entries);
  }

  for (const module of area.modules) {
    const moduleExports = bySource.get(module.source) ?? [];
    if (moduleExports.length === 0) fail(`area ${area.title} has no exports from ${module.source}`);
    lines.push(`## ${module.title}`, '', module.description, '');
    for (const entry of moduleExports) {
      lines.push(
        `### \`${entry.name}\``,
        '',
        SYMBOL_DESCRIPTIONS[entry.name],
        '',
        '```ts',
        entry.signature,
        '```',
        '',
      );
    }
  }

  return lines.join('\n');
}

function generatedPages(exports, fingerprint) {
  const pages = new Map([
    ['api-reference.md', renderOverview(exports, fingerprint)],
  ]);
  for (const area of API_AREAS) {
    pages.set(`${area.slug}.md`, renderArea(area, exports, fingerprint));
  }
  return pages;
}

async function checkPages(pages) {
  const stale = [];
  for (const [name, expected] of pages) {
    let actual;
    try {
      actual = await readFile(resolve(docsRoot, name), 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (actual !== expected) stale.push(name);
  }
  if (stale.length > 0) {
    fail(`generated output is stale: ${stale.join(', ')}. Run npm run docs:api.`);
  }
  console.log(`Framework API reference is current (${pages.size} pages).`);
}

async function writePages(pages) {
  for (const [name, source] of pages) {
    await writeFile(resolve(docsRoot, name), source, 'utf8');
  }
  console.log(`Generated ${pages.size} framework API reference pages.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check') || args.length > 1) {
    fail('usage: node scripts/generate-framework-api-reference.mjs [--check]');
  }
  const program = loadProgram();
  const exports = publicExports(program);
  validateContent(exports);
  const pages = generatedPages(exports, sourceFingerprint(program));
  if (args[0] === '--check') await checkPages(pages);
  else await writePages(pages);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
