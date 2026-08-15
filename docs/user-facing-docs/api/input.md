---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:de33d498218de015
---

# Latched input API

Hold a one-shot action from the frame it was pressed until a fixed step consumes it, counting a held button once.

Use one latch per discrete action whenever input is sampled per rendered frame but consumed per fixed step.

For the task-first workflow, read [Build a game module](../framework/game-modules.md). Import every API on this page from `@antiky/framework`.

## Example

The host samples every frame; the session may complete no steps in a frame, so the press has to survive until one runs.

```ts
import { createLatchedAction } from '@antiky/framework';

const jump = createLatchedAction();

jump.capture(pointer.down);
const advance = session.advance({ elapsedSeconds, input: { jump: jump.read() } });
jump.consume(advance.completedSteps);
```

## Latched action buffer

Capture a press once per edge, keep it across frames that complete no step, and clear it when one does.

### `LatchedAction`

A one-shot action captured at display rate and consumed at simulation rate.

```ts
type LatchedAction = Readonly<{
    capture(pressed: boolean): void;
    read(): boolean;
    consume(completedSteps: number): void;
}>;
```

### `createLatchedAction`

Create an edge-triggered action buffer that survives frames completing no step.

```ts
function createLatchedAction(): LatchedAction;
```
