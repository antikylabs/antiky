# Antiky monorepo

This repository contains the Antiky Labs website, public demos, and the emerging Antiky Framework as
npm workspaces.

## Packages

```text
packages/
├── website/    @antiky/website   Next.js site and site presentation
├── demos/      @antiky/demos     Demo catalog, runtime, renderers, art, and shaders
└── framework/  @antiky/framework Reusable framework capabilities extracted from demos
```

The dependency direction is intentional:

```text
website → demos → framework
```

- The website presents demos but does not own their rendering implementation.
- Demos depend on the framework and expose needs that justify new framework capabilities.
- The framework never depends on the website or demo packages.

## Install

```bash
npm install
```

Dependencies are installed once at the repository root and linked through npm workspaces.

## Development

Use the root dispatcher to start one workspace:

```bash
npm run dev -- website
npm run dev -- framework
npm run dev -- demos
npm run dev -- demos sprite-depth
```

The website and demo host run on `http://localhost:3010`. When a demo slug is supplied, demo mode
routes the root page directly to `/demos/<slug>`. A future demo such as `demo-pocket-monsters` will use
the same command after it is registered:

```bash
npm run dev -- demos demo-pocket-monsters
```

Equivalent shortcuts are available:

```bash
npm run dev:website
npm run dev:framework
npm run dev:demos -- sprite-depth
```

## Checks and builds

```bash
npm run typecheck
npm run build
npm run shaders
```

The website's development and production commands compile the demo shaders before starting Next.js.

## Adding a demo

1. Add shader sources under `packages/demos/src/shaders/` and run `npm run shaders`.
2. Add the renderer under `packages/demos/src/render/`.
3. Register its loader in `packages/demos/src/registry.ts`.
4. Add its public metadata to `packages/demos/src/catalog.ts`.
5. Run it with `npm run dev -- demos <slug>`.

`DemoStage` owns renderer creation, backend selection, the frame loop, visibility pausing, pointer
state, and teardown. Individual demos only build their rendering resources and draw.
