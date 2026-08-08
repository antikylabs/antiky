# Antiky Town

A self-contained Antiky game project. It owns its town renderer and combines it with an `EngineSession` and
point-light authoring behavior. The project contains game code only. A delivery host supplies the
canvas, platform input, timing, and development services.

Open `antiky-town.antiky` in Studio, or run:

```sh
npm run antiky -- dev --project packages/demos/antiky/antiky-town/antiky-town.antiky
```

`npm run build` compiles the portable module to `dist/antiky.game.js`.
