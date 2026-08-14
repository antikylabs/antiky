export const API_AREAS = Object.freeze([
  {
    slug: 'identity',
    title: 'Identity API',
    summary: 'Create and validate stable UUIDv7 identities for worlds, entities, commands, and sessions.',
    useWhen: 'Use branded IDs at storage and command boundaries so different identity kinds cannot be mixed accidentally.',
    guide: { href: '../framework/point-lights.md#keep-ids-stable', label: 'Point lights: Keep IDs stable' },
    exampleDescription: '`savedWorldId` is an unknown value read from persisted game data. Create an ID for a new record; parse an ID that already exists.',
    example: `import { createEntityId, parseWorldId } from '@antiky/framework';

const entityId = createEntityId();
const worldId = parseWorldId(savedWorldId);`,
    modules: [
      {
        source: 'identity/ids.ts',
        title: 'Stable IDs',
        description: 'Create IDs for new records and parse unknown values when they cross a file, network, or tool boundary.',
      },
    ],
  },
  {
    slug: 'engine-session',
    title: 'Engine session API',
    summary: 'Run deterministic fixed-step systems and expose safe pause, resume, single-step, command, and disposal controls.',
    useWhen: 'Use one session as the authority for a running world when simulation timing must stay independent from display timing.',
    guide: { href: '../framework/engine-sessions.md', label: 'Run a fixed-step game session' },
    exampleDescription: '`sessionId` and `worldId` are stable IDs. `move` is game logic; the host supplies elapsed time and current input each frame.',
    example: `import { createEngineSession } from '@antiky/framework';

const session = createEngineSession({
  sessionId,
  worldId,
  runtimeInstanceId: 'game-runtime-1',
  systems: [{ id: 'movement', run: ({ input }) => move(input) }],
  captureInput: (input) => Object.freeze({ ...input }),
});

session.advance(elapsedSeconds, currentInput);`,
    modules: [
      {
        source: 'sessions/engine-session/runtime.ts',
        title: 'Create a session',
        description: 'Create the stateful session once, then drive it through the returned `EngineSession` interface.',
      },
      {
        source: 'sessions/engine-session/contract.ts',
        title: 'Session contract',
        description: 'Use these records and result codes to integrate game systems, controls, commands, status, and owned services.',
      },
      {
        source: 'sessions/engine-session/protocol.ts',
        title: 'Protocol validation',
        description: 'Parse session values received from another process before trusting them as framework records.',
      },
    ],
  },
  {
    slug: 'inspection',
    title: 'Inspection API',
    summary: 'Publish immutable runtime snapshots, bounded world views, and declared event history to development tools.',
    useWhen: 'Use inspection as a read-only adapter boundary; keep live engine objects, credentials, and renderer resources out of it.',
    guide: { href: '../framework/inspection.md', label: 'Publish runtime inspection' },
    exampleDescription: 'Create the initial immutable snapshot before exposing the store to development adapters.',
    example: `import {
  INSPECTION_SCHEMA_VERSION,
  createInspectionSnapshot,
  createInspectionStore,
} from '@antiky/framework';

const store = createInspectionStore(createInspectionSnapshot({
  schemaVersion: INSPECTION_SCHEMA_VERSION,
  runtime: { instanceId: 'game-runtime-1', lifecycle: 'running' },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 0 },
    render: { owner: 'framework' },
  },
}));`,
    modules: [
      {
        source: 'inspection/snapshot.ts',
        title: 'Runtime snapshots',
        description: 'Validate a complete runtime view and publish its latest value to subscribers in sequence order.',
      },
      {
        source: 'inspection/world.ts',
        title: 'World views',
        description: 'Describe bounded entity, relationship, component, and store data without exposing mutable engine state.',
      },
      {
        source: 'inspection/event-recorder.ts',
        title: 'Bounded event recorder',
        description: 'Retain the newest events within a capacity, number them without reuse, and build the history envelope with its counts and drop accounting derived rather than hand-assembled.',
      },
      {
        source: 'inspection/events.ts',
        title: 'Event history',
        description: 'Describe accepted domain facts together with their ordering and retention policy.',
      },
    ],
  },
  {
    slug: 'point-light-core',
    title: 'Point-light core API',
    summary: 'Validate point-light records and manage the authoritative lights for one world.',
    useWhen: 'Use records for isolated values and the authoring service when lights need stable identity, revisions, history, and renderer handoff.',
    guide: { href: '../framework/point-lights.md', label: 'Add point lights' },
    exampleDescription: 'Create validated component records before placing them in a point-light authoring service.',
    example: `import {
  POINT_LIGHT_SCHEMA_VERSION,
  TRANSFORM_SCHEMA_VERSION,
  createPointLight,
  createTransform,
} from '@antiky/framework';

const transform = createTransform({
  schemaVersion: TRANSFORM_SCHEMA_VERSION,
  position: [0, 2, 0],
});
const light = createPointLight({
  schemaVersion: POINT_LIGHT_SCHEMA_VERSION,
  color: [1, 0.6, 0.3],
  radius: 4,
  power: 1,
});`,
    modules: [
      {
        source: 'point-light/records.ts',
        title: 'Light records',
        description: 'Create immutable transforms and point lights from unknown input, applying defaults and numeric bounds.',
      },
      {
        source: 'point-light/service.ts',
        title: 'Authoring service',
        description: 'Own a world’s lights, accept ordered authoring commands, expose projections, and rebuild state from facts.',
      },
    ],
  },
  {
    slug: 'point-light-commands',
    title: 'Point-light command API',
    summary: 'Validate versioned power-change commands, trusted execution context, results, and accepted facts.',
    useWhen: 'Use these parsers at tool or process boundaries; create trusted context in the host instead of accepting authority from a command.',
    guide: { href: '../framework/point-lights.md#change-power-while-the-game-runs', label: 'Point lights: Change power' },
    exampleDescription: '`untrustedCommand` comes from a file, tool, or request boundary. `lights` is the world’s authoring service, and `trustedContext` is created by the host.',
    example: `import { parseSetPointLightPowerCommand } from '@antiky/framework';

const command = parseSetPointLightPowerCommand(untrustedCommand);
const result = lights.submitPointLightPower(command, trustedContext);

if (result.code !== 'ACCEPTED' && result.code !== 'NO_OP') {
  handleRejectedCommand(result.code);
}`,
    modules: [
      {
        source: 'point-light/commands.ts',
        title: 'Commands and facts',
        description: 'Parse external values before submission and branch on stable result codes rather than human-readable messages.',
      },
    ],
  },
  {
    slug: 'point-light-integration',
    title: 'Point-light integration API',
    summary: 'Project authored lights into runtime, renderer, inspection, world, and event views.',
    useWhen: 'Use these adapters to keep framework records independent from renderer objects while giving tools a consistent read-only model.',
    guide: { href: '../framework/point-lights.md#send-changes-to-your-renderer', label: 'Point lights: Renderer integration' },
    exampleDescription: '`lights` is a `PointLightAuthoringService`; `rendererLights` is your renderer adapter. Acknowledge only after every renderer update succeeds.',
    example: `import { inspectPointLightWorld } from '@antiky/framework';

const { world, events } = inspectPointLightWorld(lights);
const changes = lights.readPointLightRenderChanges();

for (const light of changes.pointLights) {
  rendererLights.setBasePower(light.renderSlot, light.power);
}
lights.acknowledgePointLightRenderChanges(changes.eventSequence);`,
    modules: [
      {
        source: 'point-light/projections.ts',
        title: 'Runtime and renderer projections',
        description: 'Build immutable projections and read only the render slots whose authored values changed.',
      },
      {
        source: 'point-light/inspection.ts',
        title: 'Feature inspection',
        description: 'Validate or derive the complete read-only point-light state used by framework inspection.',
      },
      {
        source: 'point-light/world-inspection.ts',
        title: 'World inspection adapter',
        description: 'Map point-light state to generic world stores, component summaries, and event history.',
      },
    ],
  },
  {
    slug: 'game-host',
    title: 'Game host API',
    packageEntry: '@antiky/framework/game',
    summary: 'Mount one portable game module with host-owned canvas, input, timing, measurements, inspection, and cleanup.',
    useWhen: 'Use this entry to define a game module or a delivery host without importing CLI, Studio, website, or server code into the game.',
    guide: { href: '../framework/game-modules.md', label: 'Build a game module' },
    exampleDescription: 'The host supplies platform services. The game returns one instance that accepts presentation time and supports cleanup.',
    example: `import type { GameModuleEntry } from '@antiky/framework/game';

const mountGame: GameModuleEntry = ({ canvas, movement, pointer }) => ({
  frame(platformTimeSeconds) {
    updateGame({ movement, pointer, platformTimeSeconds });
    drawGame(canvas);
  },
  dispose() {
    disposeGame();
  },
});

export default mountGame;`,
    modules: [
      {
        source: 'game/contract.ts',
        title: 'Game contract, import-free',
        description: 'Re-exported here so the game entry stays one import. `@antiky/framework/contract` is the same types with nothing behind them.',
      },
      {
        source: 'game/host.ts',
        title: 'Game module and host contract',
        description: 'Keep platform work in the host and expose only semantic game input, measurements, inspection, presentation, and cleanup.',
      },
    ],
  },
  {
    slug: 'resources',
    title: 'Resource disposal API',
    summary: 'Own a set of resources and release them in reverse order, reporting every failure rather than the first.',
    useWhen: 'Use one scope wherever construction acquires several things that must be released together, especially when a partial construction has to be unwound.',
    guide: { href: '../framework/engine-sessions.md', label: 'Run a fixed-step game session' },
    exampleDescription: '`loadTexture` and `createProgram` each acquire something that must be released. If the program fails to link, the texture is still released and the construction fault is what the caller sees.',
    example: `import { createDisposalScope } from '@antiky/framework';

const scope = createDisposalScope();
try {
  const texture = scope.adopt(loadTexture(source));
  const program = scope.adopt(createProgram(texture));
  return { program, dispose: () => scope.dispose() };
} catch (cause) {
  scope.rollback(cause);
}`,
    modules: [
      {
        source: 'resources/disposal-scope.ts',
        title: 'Disposal scope',
        description: 'Adopt resources as they are acquired, release them newest first, and unwind a failed construction without losing the fault that caused it.',
      },
    ],
  },
  {
    slug: 'random',
    title: 'Seeded randomness API',
    summary: 'Draw reproducible pseudo-random values from an explicit seed, with forks that do not depend on draw order.',
    useWhen: 'Use one seeded stream wherever a simulation needs randomness, so a run replays exactly and its state digest means something.',
    guide: { href: '../framework/engine-sessions.md', label: 'Run a fixed-step game session' },
    exampleDescription: '`seed` is an explicit simulation input, carried in the snapshot. Forking by label keeps two subsystems independent of each other\'s draw order.',
    example: `import { createRandomStream } from '@antiky/framework';

const random = createRandomStream(seed);
const scatter = random.fork(1);
const damage = random.fork(2);

const offset = scatter.unit();`,
    modules: [
      {
        source: 'random/seeded-random.ts',
        title: 'Seeded random streams',
        description: 'Hash integers reproducibly and draw from a seeded stream whose forks depend on their label alone.',
      },
    ],
  },
  {
    slug: 'input',
    title: 'Latched input API',
    summary: 'Hold a one-shot action from the frame it was pressed until a fixed step consumes it, counting a held button once.',
    useWhen: 'Use one latch per discrete action whenever input is sampled per rendered frame but consumed per fixed step.',
    guide: { href: '../framework/game-modules.md', label: 'Build a game module' },
    exampleDescription: 'The host samples every frame; the session may complete no steps in a frame, so the press has to survive until one runs.',
    example: `import { createLatchedAction } from '@antiky/framework';

const jump = createLatchedAction();

jump.capture(pointer.down);
const advance = session.advance({ elapsedSeconds, input: { jump: jump.read() } });
jump.consume(advance.completedSteps);`,
    modules: [
      {
        source: 'input/latched-action.ts',
        title: 'Latched action buffer',
        description: 'Capture a press once per edge, keep it across frames that complete no step, and clear it when one does.',
      },
    ],
  },
  {
    slug: 'game-contract',
    title: 'Game contract API',
    packageEntry: '@antiky/framework/contract',
    summary: 'The shape of a game module and the context a host supplies it, with nothing imported behind it.',
    useWhen: 'Use this entry when a module needs only the contract, so it does not pull in the inspection snapshot or the point-light type graph to learn what a game looks like.',
    guide: { href: '../framework/game-modules.md', label: 'Build a game module' },
    exampleDescription: 'The same contract as the game host entry, obtainable on its own. `mode` lets a game degrade for a thumbnail; the seven-field pointer carries press and drag state, not just a position.',
    example: `import type { GameModuleEntry } from '@antiky/framework/contract';

const mountGame: GameModuleEntry = ({ canvas, pointer, mode }) => ({
  frame(platformTimeSeconds) {
    if (mode !== 'thumbnail') updateGame({ pointer, platformTimeSeconds });
    drawGame(canvas);
  },
  dispose() {
    disposeGame();
  },
});

export default mountGame;`,
    modules: [
      {
        source: 'game/contract.ts',
        title: 'Game contract, import-free',
        description: 'The shape of a game module and the context a host supplies it, with zero imports so it can be taken on its own.',
      },
    ],
  },
]);

export const SYMBOL_DESCRIPTIONS = Object.freeze({
  // Bounded event recording
  completeCounts: 'The counts block for a set whose every available item is also retained.',
  RecordedEvent: 'One retained event with its sequence number and timestamp.',
  EventHistoryDescriptor: 'What a caller must supply to turn retained events into a history envelope.',
  BoundedEventRecorder: 'A capped ring of simulation events that owns its own drop accounting.',
  createBoundedEventRecorder: 'Create a bounded recorder that keeps the newest events and reports what it dropped.',

  // Latched input
  LatchedAction: 'A one-shot action captured at display rate and consumed at simulation rate.',
  createLatchedAction: 'Create an edge-triggered action buffer that survives frames completing no step.',

  // Seeded randomness
  hash32: 'A reproducible 32-bit hash of one or two integers, using integer operations only.',
  hashUnit: 'The same hash mapped onto `[0, 1)`.',
  RandomStream: 'A seeded sequence that replays exactly and forks into independent child streams.',
  createRandomStream: 'Create a seeded stream for one simulation or one subsystem of it.',

  // Resource disposal
  DisposableResource: 'Anything that can be released. The only shape a disposal scope requires.',
  DisposalScope: 'Owns adopted resources and releases them newest first, collecting every failure.',
  createDisposalScope: 'Create a scope that adopts resources and releases them in reverse order.',
  ResourceTransaction: 'A completed all-or-nothing acquisition and the handle that releases it.',
  acquireTransactional: 'Acquire every resource in order, or release what was acquired and rethrow.',
  RendererResourceLifetime: 'A disposal scope that also owns the renderer, destroyed last and exactly once.',
  createRendererResourceLifetime: 'Create a scope whose renderer is destroyed after the resources borrowed from it.',
  // Identity
  WorldId: 'A branded UUIDv7 for one authored world.',
  EntityId: 'A branded UUIDv7 for one stable world entity.',
  CommandId: 'A branded UUIDv7 used to deduplicate and trace an authoring command.',
  SessionId: 'A branded UUIDv7 for one engine-session lifetime.',
  ID_KINDS: 'The identity kinds accepted by `generateId`.',
  IdKind: 'The union of supported identity-kind names.',
  IdForKind: 'Maps an `IdKind` to its branded string type.',
  UuidV7CreationSource: 'Deterministic timestamp and random bytes for tests or controlled ID generation.',
  IdValidationError: 'Thrown when UUIDv7 creation or parsing receives an invalid value; `code` is stable.',
  isUuidV7: 'Checks whether an unknown value is a canonical lowercase UUIDv7 string without throwing.',
  createWorldId: 'Creates a new world ID, using secure platform randomness unless a source is supplied.',
  createEntityId: 'Creates a new entity ID, using secure platform randomness unless a source is supplied.',
  createCommandId: 'Creates a new command ID, using secure platform randomness unless a source is supplied.',
  createSessionId: 'Creates a new session ID, using secure platform randomness unless a source is supplied.',
  generateId: 'Creates the branded ID selected by an `IdKind`.',
  parseWorldId: 'Validates unknown input and returns it as a `WorldId`.',
  parseEntityId: 'Validates unknown input and returns it as an `EntityId`.',
  parseCommandId: 'Validates unknown input and returns it as a `CommandId`.',
  parseSessionId: 'Validates unknown input and returns it as a `SessionId`.',

  // Engine sessions
  createEngineSession: 'Creates the authoritative fixed-step session and validates its IDs, systems, input capture, and owned services.',
  ENGINE_SESSION_SCHEMA_VERSION: 'The schema version emitted in engine-session status records.',
  FIXED_STEP_SECONDS: 'The simulation duration accepted by every completed fixed step.',
  MAX_FRAME_ELAPSED_SECONDS: 'The most wall-clock time one frame can add to the fixed-step accumulator.',
  MAX_STEPS_PER_FRAME: 'The maximum fixed steps a single `advance` call can complete.',
  MAX_ENGINE_SYSTEMS: 'The maximum ordered systems in one engine session.',
  EnginePauseReason: 'The independent callers that can keep a session paused.',
  EngineSessionMode: 'The current lifecycle mode of an engine session.',
  EngineStepSource: 'Whether a completed step came from a frame or an explicit single-step control.',
  EngineSessionFaultSource: 'The callback boundary that caused a terminal session fault.',
  EngineSessionFault: 'A stable, non-sensitive summary of a failed engine callback.',
  EngineStepContext: 'The immutable input and clock data passed to each ordered system for one step.',
  EngineSystem: 'A stable system ID and its fixed-step callback.',
  EngineSessionOwnedService: 'A disposable service whose lifetime is owned by the session.',
  EngineSessionOptions: 'Construction options for IDs, ordered systems, immutable input capture, digesting, and owned services.',
  CompletedEngineStep: 'The last completed step, including captured input and an optional state digest.',
  EngineSessionStatus: 'Serializable inspection state for identity, mode, clocks, pause reasons, order, and revisions.',
  EngineFrameResultCode: 'Stable outcomes from `EngineSession.advance`.',
  EngineFrameResult: 'Counts accepted, discarded, accumulated, and completed frame work.',
  EngineControlResultCode: 'Stable outcomes from pause, resume, and single-step controls.',
  EngineControlResult: 'The session mode and control revision after a control request.',
  EngineCommandContext: 'The authoritative command sequence and world revision supplied to an operation.',
  EngineCommandOutcome: 'An operation result plus whether authoritative world state changed.',
  EngineCommandExecutionCode: 'Stable outcomes from the session command boundary.',
  EngineCommandExecution: 'The ordered result and world revision returned by `executeCommand`.',
  EngineSession: 'The main session interface for frames, controls, commands, status, and cleanup.',
  EngineSessionValidationError: 'Thrown for invalid session construction data; `code` and `path` support stable recovery.',
  EngineSessionDisposalError: 'Thrown after cleanup when one or more owned services fail to dispose.',
  parseEngineControlResult: 'Validates an unknown cross-process control result.',
  parseEngineSessionStatus: 'Validates an unknown cross-process session status.',

  // Runtime inspection
  INSPECTION_SCHEMA_VERSION: 'The schema version required by runtime inspection snapshots.',
  MAX_INSPECTION_DIAGNOSTICS: 'The maximum diagnostics retained in one snapshot.',
  MAX_DIAGNOSTIC_RELATED_IDS: 'The maximum related IDs attached to one diagnostic.',
  RuntimeLifecycle: 'The observable lifecycle states a game runtime can report.',
  DiagnosticSeverity: 'The display and urgency level of an inspection diagnostic.',
  DiagnosticSource: 'The framework boundary that produced a diagnostic.',
  InspectionDiagnosticInput: 'Mutable-friendly input shape accepted for one diagnostic.',
  InspectionRuntimeMeasurementsInput: 'Input frame measurements owned by the framework.',
  InspectionRenderMeasurementsInput: 'Optional renderer measurements accepted in a snapshot.',
  InspectionSnapshotInput: 'Complete input shape accepted by `createInspectionSnapshot`.',
  InspectionDiagnostic: 'An immutable validated diagnostic with a stable code and related IDs.',
  InspectionRuntimeMeasurements: 'Validated runtime frame measurements.',
  InspectionRenderMeasurements: 'Validated optional renderer measurements.',
  InspectionSnapshot: 'The immutable top-level runtime view shared by CLI, MCP, Studio, and tests.',
  InspectionUpdate: 'A published snapshot paired with its store-local sequence.',
  InspectionSubscriber: 'A callback invoked for each later inspection publication.',
  InspectionSource: 'Read-and-subscribe interface for consumers that cannot publish.',
  InspectionStore: 'Inspection source that can validate and publish a new snapshot.',
  InspectionValidationError: 'Thrown for an invalid snapshot; `code` and `path` identify the stable failure.',
  createInspectionSnapshot: 'Validates, copies, and freezes an entire runtime snapshot.',
  createInspectionStore: 'Keeps the latest validated snapshot and notifies subscribers in order.',

  // Generic world inspection
  WORLD_INSPECTION_SCHEMA_VERSION: 'The schema version required by generic world views.',
  MAX_WORLD_INSPECTION_ENTITIES: 'The maximum entity headers retained in one world view.',
  MAX_WORLD_INSPECTION_COMPONENTS: 'The maximum component summaries retained across a world view.',
  MAX_WORLD_INSPECTION_RELATIONSHIPS: 'The maximum parent-child relationships retained in one world view.',
  MAX_WORLD_INSPECTION_STORES: 'The maximum named stores retained in one world view.',
  MAX_WORLD_INSPECTION_STORE_ENTRIES: 'The maximum entries retained across all world stores.',
  InspectionCountInput: 'Available and retained counts supplied while building a bounded view.',
  WorldInspectionComponentInput: 'Untrusted component-summary input before JSON copying and validation.',
  WorldInspectionEntityInput: 'Untrusted entity header and component input.',
  ChildOfInspectionInput: 'Untrusted parent-child relationship input.',
  WorldInspectionStoreEntryInput: 'Untrusted key, optional entity link, and JSON store data.',
  WorldInspectionStoreInput: 'Untrusted named authoring, runtime, or render store input.',
  WorldInspectionInput: 'Complete untrusted input shape for a generic world view.',
  InspectionCount: 'Validated available and retained counts for bounded data.',
  WorldInspectionComponent: 'Immutable component type, version, summary, and bounded JSON data.',
  WorldInspectionEntity: 'Immutable entity identity, label, revision, and component summaries.',
  ChildOfInspection: 'Immutable real parent-child relationship between two entities.',
  WorldInspectionStoreEntry: 'Immutable store entry with optional stable entity identity.',
  WorldInspectionStore: 'Immutable bounded authoring, runtime, or render store view.',
  WorldInspection: 'Immutable generic view of world entities, relationships, and stores.',
  WorldInspectionValidationError: 'Thrown for an invalid world view; `code` and `path` identify the failure.',
  createWorldInspection: 'Validates, bounds, copies, and freezes a generic world view.',

  // Event inspection
  EVENT_HISTORY_SCHEMA_VERSION: 'The schema version required by event-history views.',
  MAX_EVENT_HISTORY_EVENTS: 'The maximum accepted facts retained in one inspection response.',
  MAX_EVENT_ENTITY_IDS: 'The maximum related entities recorded on one event.',
  EventHistoryEntryInput: 'Untrusted accepted-fact input before ID and JSON validation.',
  EventHistoryInput: 'Complete untrusted event history and retention declaration.',
  EventHistoryEntry: 'Immutable accepted fact with stable ordering, identities, revision, time, and data.',
  EventHistory: 'Immutable bounded fact list plus explicit lifetime, storage, and overflow rules.',
  EventHistoryValidationError: 'Thrown for invalid event history; `code` and `path` identify the failure.',
  createEventHistory: 'Validates ordering and retention, copies JSON data, and freezes event history.',

  // Point-light records and service
  TRANSFORM_SCHEMA_VERSION: 'The schema version required by transform records.',
  POINT_LIGHT_SCHEMA_VERSION: 'The schema version required by point-light records.',
  MIN_POINT_LIGHT_POWER: 'The lowest accepted point-light power.',
  MAX_POINT_LIGHT_POWER: 'The highest accepted point-light power.',
  MAX_WORLD_COORDINATE: 'The absolute bound for each transform position coordinate.',
  MAX_POINT_LIGHT_RADIUS: 'The largest accepted point-light radius in world units.',
  MAX_LINEAR_LIGHT_VALUE: 'The largest accepted linear RGB channel value.',
  Vector3: 'A read-only three-number tuple used for world positions.',
  LinearRgb: 'A read-only linear red, green, and blue tuple.',
  TransformInput: 'Transform input with an optional position that defaults to the origin.',
  PointLightInput: 'Point-light input with optional color, radius, and power defaults.',
  Transform: 'An immutable validated transform record.',
  PointLight: 'An immutable validated linear color, radius, and power record.',
  PointLightValidationError: 'Thrown for an invalid transform or light record; `code` and `path` identify the failure.',
  createTransform: 'Validates unknown input, applies the origin default, and returns an immutable transform.',
  createPointLight: 'Validates unknown input, applies light defaults, and returns an immutable point light.',
  MAX_POINT_LIGHTS: 'The maximum authored lights owned by one point-light service.',
  MAX_POINT_LIGHT_LABEL_LENGTH: 'The maximum trimmed label length for one authored light.',
  PointLightAuthoringRecordInput: 'Untrusted authored-light input before IDs, revisions, and component records are validated.',
  PointLightAuthoringRecord: 'Immutable authoritative light state with world and entity identity.',
  PointLightAuthoringService: 'The main interface for light reads, commands, facts, projections, replay, and cleanup.',
  PointLightServiceErrorCode: 'Stable construction errors for invalid service data or duplicate entities.',
  PointLightServiceValidationError: 'Thrown when point-light service construction fails, with stable `code` and `path`.',
  PointLightReplayError: 'Thrown when explicit fact replay breaks event-sequence ordering.',
  createPointLightAuthoringService: 'Creates one world-scoped light service from authored records and optional render bindings.',

  // Point-light commands
  POINT_LIGHT_COMMAND_PROTOCOL_VERSION: 'The outer protocol version required by point-light power requests.',
  POINT_LIGHT_COMMAND_VERSION: 'The payload version required by point-light power requests.',
  POINT_LIGHT_FACT_SCHEMA_VERSION: 'The schema version emitted for accepted power-set facts.',
  POINT_LIGHT_RESULT_SCHEMA_VERSION: 'The schema version emitted for command results.',
  MAX_POINT_LIGHT_COMMAND_BYTES: 'The maximum UTF-8 JSON size accepted for one power command.',
  MAX_POINT_LIGHT_COMMAND_RESULTS: 'The maximum command results retained by one service.',
  MAX_POINT_LIGHT_POWER_FACTS: 'The maximum accepted power facts retained by one service.',
  POINT_LIGHT_EDIT_PERMISSION: 'The permission required in trusted context to change point-light power.',
  SET_POINT_LIGHT_POWER_COMMAND_TYPE: 'The stable command discriminator for a power change.',
  POINT_LIGHT_POWER_SET_FACT_TYPE: 'The stable event discriminator for an accepted power change.',
  SetPointLightPowerCommand: 'A validated optimistic-concurrency command that requests a new power value.',
  CorrectPointLightPowerRequest: 'A request that restores the old value from an accepted command by creating another fact.',
  PointLightCommandContextInput: 'Host-supplied identity, permissions, receipt time, and runtime identity before validation.',
  PointLightCommandContext: 'Validated trusted authority and runtime context for command execution.',
  PointLightCommandResultCode: 'Stable accepted, no-op, validation, authority, ordering, and capacity outcomes.',
  PointLightPowerSetFact: 'Immutable accepted power change used for history, correction, and replay.',
  PointLightCommandResult: 'Immutable decision record for one submitted or corrected command.',
  PointLightCommandValidationError: 'Thrown by command parsers; `code` and `path` identify invalid input.',
  encodedJsonByteLength: 'Returns an encoded JSON byte count, or `null` when the value cannot be serialized.',
  parseSetPointLightPowerCommand: 'Validates an unknown power-change command, including size, versions, IDs, and fields.',
  parseCorrectPointLightPowerRequest: 'Validates an unknown correction request.',
  parsePointLightCommandContext: 'Validates host-created command authority and runtime context.',
  parsePointLightCommandResult: 'Validates an unknown command result received across a process boundary.',
  parsePointLightPowerSetFact: 'Validates an unknown accepted fact for inspection or replay.',

  // Point-light projections and inspection
  MAX_POINT_LIGHT_RENDER_SLOT: 'The largest numeric renderer slot accepted in a light binding.',
  PointLightRenderBinding: 'Connects one stable entity ID to one temporary renderer slot.',
  RuntimePointLight: 'The minimal runtime projection of entity, revision, and power.',
  RenderPointLight: 'The minimal renderer projection with its assigned slot.',
  PointLightStateSnapshot: 'Immutable authoring, runtime, and render projections at one event sequence.',
  PointLightRenderChanges: 'Only renderer-bound lights whose slots are currently dirty.',
  PointLightProjectionValidationError: 'Thrown for invalid runtime IDs, bindings, or projection state, with a stable path.',
  parsePointLightRuntimeInstanceId: 'Validates the bounded runtime identity used by point-light projections.',
  parsePointLightRenderBindings: 'Validates unique known entity bindings and unique renderer slots.',
  createPointLightStateSnapshot: 'Builds sorted authoring, runtime, and render projections for one sequence.',
  readRenderChanges: 'Selects dirty renderer slots from a point-light state snapshot.',
  POINT_LIGHT_INSPECTION_SCHEMA_VERSION: 'The schema version required by feature-specific point-light inspection.',
  PointLightInspectionInput: 'Complete untrusted point-light inspection input.',
  PointLightInspection: 'Immutable feature view of authoritative, runtime, renderer, and fact state.',
  PointLightInspectionValidationError: 'Thrown for invalid point-light inspection with stable `code` and `path`.',
  createPointLightInspection: 'Validates, cross-checks, copies, and freezes a complete point-light inspection view.',
  inspectPointLightService: 'Reads a point-light service and returns its validated feature inspection view.',
  POINT_LIGHT_AUTHORING_STORE_ID: 'The stable generic-world store ID for authored point-light records.',
  POINT_LIGHT_RUNTIME_STORE_ID: 'The stable generic-world store ID for runtime point-light projections.',
  POINT_LIGHT_RENDER_STORE_ID: 'The stable generic-world store ID for renderer point-light projections.',
  POINT_LIGHT_EVENT_SOURCE_ID: 'The stable event-history source ID for point-light authoring facts.',
  TRANSFORM_COMPONENT_TYPE_ID: 'The stable generic-world component type for a transform summary.',
  POINT_LIGHT_COMPONENT_TYPE_ID: 'The stable generic-world component type for a point-light summary.',
  PointLightWorldViews: 'The paired generic world and event views derived from point-light state.',
  createPointLightWorldViews: 'Validates feature inspection input and maps it to generic world and event views.',
  inspectPointLightWorld: 'Reads a point-light service and returns its generic world and event inspection views.',

  // Game module and host
  GamePointerInput: 'Current semantic pointer position, button state, and wheel input supplied by a game host.',
  GameMovementInput: 'Current normalized semantic movement input supplied by a game host.',
  GameHostMode: 'The presentation purpose selected by the host for one mounted game.',
  GameMeasurements: 'Optional bounded render measurements that a game reports to its host.',
  GameHostInspectionState: 'Host-owned lifecycle, canvas, frame, measurement, and error state used for one inspection snapshot.',
  GameInspectionDetails: 'Optional game-owned session and point-light state added to a host inspection snapshot.',
  GameSessionControlResult: 'One session-control result paired with the current serializable session status.',
  GameInspectionPort: 'Optional semantic inspection and control operations supplied by a mounted game.',
  createGameInspectionSnapshot: 'Combines validated host state with optional game state in one Framework inspection snapshot.',
  GameHostContext: 'Canvas, runtime identity, semantic input, mode, and measurement callback supplied when a host mounts a game.',
  GameInstance: 'One mounted game with presentation, cleanup, and optional inspection operations.',
  GameModuleEntry: 'The default game-module function that creates one game instance from a host context.',
});
