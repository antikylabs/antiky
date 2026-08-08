# Town Study

A self-contained pure BroMetal game project. Its default entry owns the town simulation and rendering
code without depending on Antiky Framework. The Antiky CLI, Studio, website, or a test host supplies
the canvas and platform loop through a small structural module contract.

Open `town-study.antiky` in Studio, or run:

```sh
npm run antiky -- dev --project packages/demos/brometal/town-study/town-study.antiky
```

`npm run build` compiles the portable module to `dist/antiky.game.js`.
