import {
  IdValidationError,
  parseEntityId,
  parseWorldId,
  type CommandId,
  type EntityId,
  type WorldId,
} from '../identity/ids.ts';
import {
  MAX_POINT_LIGHT_COMMAND_BYTES,
  MAX_POINT_LIGHT_COMMAND_RESULTS,
  MAX_POINT_LIGHT_POWER_FACTS,
  POINT_LIGHT_COMMAND_PROTOCOL_VERSION,
  POINT_LIGHT_COMMAND_VERSION,
  POINT_LIGHT_EDIT_PERMISSION,
  POINT_LIGHT_FACT_SCHEMA_VERSION,
  POINT_LIGHT_POWER_SET_FACT_TYPE,
  POINT_LIGHT_RESULT_SCHEMA_VERSION,
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  encodedJsonByteLength,
  parseCorrectPointLightPowerRequest,
  parsePointLightCommandContext,
  parsePointLightPowerSetFact,
  parseSetPointLightPowerCommand,
  type PointLightCommandContext,
  type PointLightCommandContextInput,
  type PointLightCommandResult,
  type PointLightCommandResultCode,
  type PointLightPowerSetFact,
  type SetPointLightPowerCommand,
} from './commands.ts';
import {
  PointLightProjectionValidationError,
  createPointLightStateSnapshot,
  parsePointLightRenderBindings,
  parsePointLightRuntimeInstanceId,
  readRenderChanges,
  type PointLightRenderBinding,
  type PointLightRenderChanges,
  type PointLightStateSnapshot,
} from './projections.ts';
import {
  MAX_POINT_LIGHT_POWER,
  MIN_POINT_LIGHT_POWER,
  PointLightValidationError,
  createPointLight,
  createTransform,
  type PointLight,
  type Transform,
} from './records.ts';

export const MAX_POINT_LIGHTS = 256;
export const MAX_POINT_LIGHT_LABEL_LENGTH = 128;

export type PointLightAuthoringRecordInput = Readonly<{
  entityId: unknown;
  label: unknown;
  revision: unknown;
  transform: unknown;
  pointLight: unknown;
}>;

export type PointLightAuthoringRecord = Readonly<{
  worldId: WorldId;
  entityId: EntityId;
  label: string;
  revision: number;
  transform: Transform;
  pointLight: PointLight;
}>;

export interface PointLightAuthoringService {
  readonly worldId: WorldId;
  listPointLights(): readonly PointLightAuthoringRecord[];
  getPointLight(entityId: unknown): PointLightAuthoringRecord | undefined;
  submitPointLightPower(
    command: unknown,
    context: PointLightCommandContextInput | unknown,
  ): PointLightCommandResult;
  correctPointLightPower(
    request: unknown,
    context: PointLightCommandContextInput | unknown,
  ): PointLightCommandResult;
  listPointLightPowerFacts(): readonly PointLightPowerSetFact[];
  listPointLightCommandResults(): readonly PointLightCommandResult[];
  readPointLightState(): PointLightStateSnapshot;
  readPointLightRenderChanges(): PointLightRenderChanges;
  acknowledgePointLightRenderChanges(eventSequence: number): boolean;
  replayPointLightPowerFacts(facts: unknown): PointLightStateSnapshot;
  rebuildPointLightState(): PointLightStateSnapshot;
  dispose(): void;
}

export type PointLightServiceErrorCode =
  | 'INVALID_POINT_LIGHT_SERVICE'
  | 'DUPLICATE_ENTITY_ID';

export class PointLightServiceValidationError extends Error {
  constructor(
    readonly code: PointLightServiceErrorCode,
    message: string,
    readonly path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = 'PointLightServiceValidationError';
  }
}

export class PointLightReplayError extends Error {
  readonly code = 'EVENT_SEQUENCE_ERROR';

  constructor(message: string, readonly eventSequence: number | null) {
    super(message);
    this.name = 'PointLightReplayError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(
  message: string,
  path: string,
  code: PointLightServiceErrorCode = 'INVALID_POINT_LIGHT_SERVICE',
): never {
  throw new PointLightServiceValidationError(code, message, path);
}

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('Expected an object', path);
  }
  return value as UnknownRecord;
}

function checkKeys(value: UnknownRecord, required: readonly string[], path: string): void {
  const allowed = new Set(required);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('Unknown field', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('Missing field', `${path}.${key}`);
  }
}

function readId<T>(operation: () => T, path: string): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof IdValidationError) fail(error.message, path);
    throw error;
  }
}

function readLabel(value: unknown, path: string): string {
  if (typeof value !== 'string') fail('Expected a label string', path);
  const label = value.trim();
  if (label.length === 0 || label.length > MAX_POINT_LIGHT_LABEL_LENGTH) {
    fail(`Expected 1 through ${MAX_POINT_LIGHT_LABEL_LENGTH} label characters`, path);
  }
  return label;
}

function readRevision(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('Expected a non-negative safe-integer revision', path);
  }
  return value as number;
}

function readComponent<T>(operation: () => T, path: string): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PointLightValidationError) {
      const suffix = error.path === '$' ? '' : error.path.slice(1);
      fail(error.message.replace(` at ${error.path}`, ''), `${path}${suffix}`);
    }
    throw error;
  }
}

function readPointLightRecord(
  worldId: WorldId,
  value: unknown,
  path: string,
): PointLightAuthoringRecord {
  const record = readObject(value, path);
  checkKeys(record, ['entityId', 'label', 'revision', 'transform', 'pointLight'], path);
  return Object.freeze({
    worldId,
    entityId: readId(() => parseEntityId(record.entityId), `${path}.entityId`),
    label: readLabel(record.label, `${path}.label`),
    revision: readRevision(record.revision, `${path}.revision`),
    transform: readComponent(() => createTransform(record.transform), `${path}.transform`),
    pointLight: readComponent(() => createPointLight(record.pointLight), `${path}.pointLight`),
  });
}

function recordWithPower(
  record: PointLightAuthoringRecord,
  power: number,
  revision: number,
): PointLightAuthoringRecord {
  return Object.freeze({
    ...record,
    revision,
    pointLight: createPointLight({
      schemaVersion: record.pointLight.schemaVersion,
      color: record.pointLight.color,
      radius: record.pointLight.radius,
      power,
    }),
  });
}

function immutableValues<T>(map: ReadonlyMap<EntityId, T>): readonly T[] {
  return Object.freeze([...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value));
}

type ResultInput = Readonly<{
  code: PointLightCommandResultCode;
  commandId?: CommandId | null;
  worldId?: WorldId | null;
  entityId?: EntityId | null;
  currentRevision?: number | null;
  resultingRevision?: number | null;
  eventSequence?: number | null;
  runtimeInstanceId?: string | null;
  duplicateOfCode?: PointLightCommandResultCode;
  fact?: PointLightPowerSetFact;
}>;

function createCommandResult(input: ResultInput): PointLightCommandResult {
  return Object.freeze({
    schemaVersion: POINT_LIGHT_RESULT_SCHEMA_VERSION,
    code: input.code,
    accepted: input.code === 'ACCEPTED',
    commandId: input.commandId ?? null,
    worldId: input.worldId ?? null,
    entityId: input.entityId ?? null,
    currentRevision: input.currentRevision ?? null,
    resultingRevision: input.resultingRevision ?? null,
    eventSequence: input.eventSequence ?? null,
    runtimeInstanceId: input.runtimeInstanceId ?? null,
    ...(input.duplicateOfCode === undefined
      ? {}
      : { duplicateOfCode: input.duplicateOfCode }),
    ...(input.fact === undefined ? {} : { fact: input.fact }),
  });
}

function replayFailure(message: string, eventSequence: number | null = null): never {
  throw new PointLightReplayError(message, eventSequence);
}

export function createPointLightAuthoringService(input: unknown): PointLightAuthoringService {
  const serviceInput = readObject(input, '$');
  checkKeys(
    serviceInput,
    ['worldId', 'pointLights', 'runtimeInstanceId', 'renderBindings'],
    '$',
  );
  const worldId = readId(() => parseWorldId(serviceInput.worldId), '$.worldId');
  if (!Array.isArray(serviceInput.pointLights)) {
    fail('Expected a point-light array', '$.pointLights');
  }
  if (serviceInput.pointLights.length > MAX_POINT_LIGHTS) {
    fail(`Expected at most ${MAX_POINT_LIGHTS} point lights`, '$.pointLights');
  }

  const initialMap = new Map<EntityId, PointLightAuthoringRecord>();
  serviceInput.pointLights.forEach((value, index) => {
    const pointLight = readPointLightRecord(worldId, value, `$.pointLights[${index}]`);
    if (initialMap.has(pointLight.entityId)) {
      fail(
        'Point-light entity IDs must be unique',
        `$.pointLights[${index}].entityId`,
        'DUPLICATE_ENTITY_ID',
      );
    }
    initialMap.set(pointLight.entityId, pointLight);
  });
  const initialRecords = immutableValues(initialMap);

  let runtimeInstanceId: string;
  let renderBindings: readonly PointLightRenderBinding[];
  try {
    runtimeInstanceId = parsePointLightRuntimeInstanceId(serviceInput.runtimeInstanceId);
    renderBindings = parsePointLightRenderBindings(serviceInput.renderBindings, initialRecords);
  } catch (error) {
    if (error instanceof PointLightProjectionValidationError) {
      fail(error.message.replace(` at ${error.path}`, ''), error.path);
    }
    throw error;
  }
  const bindingByEntity = new Map(renderBindings.map((binding) => [binding.entityId, binding]));

  let currentMap = new Map(initialMap);
  let eventSequence = 0;
  let dirtySlots = new Set<number>();
  let disposed = false;
  let state = createPointLightStateSnapshot(
    initialRecords,
    runtimeInstanceId,
    renderBindings,
    eventSequence,
    dirtySlots,
  );
  const facts: PointLightPowerSetFact[] = [];
  const results: PointLightCommandResult[] = [];
  const resultByCommand = new Map<CommandId, PointLightCommandResult>();

  const listPointLights = (): readonly PointLightAuthoringRecord[] => state.authoring;
  const getPointLight = (entityId: unknown): PointLightAuthoringRecord | undefined => (
    currentMap.get(parseEntityId(entityId))
  );
  const listPointLightPowerFacts = (): readonly PointLightPowerSetFact[] => (
    Object.freeze([...facts])
  );
  const listPointLightCommandResults = (): readonly PointLightCommandResult[] => (
    Object.freeze([...results])
  );

  const cacheResult = (result: PointLightCommandResult): PointLightCommandResult => {
    if (result.commandId !== null && results.length < MAX_POINT_LIGHT_COMMAND_RESULTS) {
      results.push(result);
      resultByCommand.set(result.commandId, result);
    }
    return result;
  };

  const resultFor = (
    command: SetPointLightPowerCommand,
    code: PointLightCommandResultCode,
    options: Omit<ResultInput, 'code' | 'commandId' | 'worldId' | 'entityId'> = {},
    cache = true,
  ): PointLightCommandResult => {
    const result = createCommandResult({
      code,
      commandId: command.commandId,
      worldId: command.worldId,
      entityId: command.entityId,
      runtimeInstanceId,
      eventSequence,
      ...options,
    });
    return cache ? cacheResult(result) : result;
  };

  const readTrustedContext = (
    value: unknown,
    command: SetPointLightPowerCommand,
  ): PointLightCommandContext | PointLightCommandResult => {
    let context: PointLightCommandContext;
    try {
      context = parsePointLightCommandContext(value);
    } catch {
      return resultFor(command, 'MISSING_PERMISSION');
    }
    if (!context.permissions.includes(POINT_LIGHT_EDIT_PERMISSION)) {
      return resultFor(command, 'MISSING_PERMISSION');
    }
    if (context.runtimeInstanceId !== runtimeInstanceId) {
      return resultFor(command, 'INVALID_COMMAND');
    }
    return context;
  };

  const submitPointLightPower = (
    commandInput: unknown,
    contextInput: unknown,
  ): PointLightCommandResult => {
    const bytes = encodedJsonByteLength(commandInput);
    if (bytes === null || bytes > MAX_POINT_LIGHT_COMMAND_BYTES) {
      return createCommandResult({ code: 'INVALID_COMMAND', runtimeInstanceId });
    }
    let command: SetPointLightPowerCommand;
    try {
      command = parseSetPointLightPowerCommand(commandInput);
    } catch {
      return createCommandResult({ code: 'INVALID_COMMAND', runtimeInstanceId });
    }
    if (disposed) return resultFor(command, 'INVALID_COMMAND', {}, false);

    const context = readTrustedContext(contextInput, command);
    if ('code' in context) return context;

    const priorResult = resultByCommand.get(command.commandId);
    if (priorResult) {
      return resultFor(command, 'DUPLICATE_COMMAND', {
        currentRevision: currentMap.get(command.entityId)?.revision ?? null,
        duplicateOfCode: priorResult.code,
      }, false);
    }
    if (
      results.length >= MAX_POINT_LIGHT_COMMAND_RESULTS
      || facts.length >= MAX_POINT_LIGHT_POWER_FACTS
    ) {
      return resultFor(command, 'HISTORY_CAPACITY_REACHED', {
        currentRevision: currentMap.get(command.entityId)?.revision ?? null,
      }, false);
    }
    if (command.worldId !== worldId) return resultFor(command, 'WORLD_NOT_FOUND');
    const current = currentMap.get(command.entityId);
    if (!current) return resultFor(command, 'ENTITY_NOT_FOUND');
    if (command.expectedRevision !== current.revision) {
      return resultFor(command, 'STALE_REVISION', { currentRevision: current.revision });
    }
    if (
      !Number.isFinite(command.data.power)
      || command.data.power < MIN_POINT_LIGHT_POWER
      || command.data.power > MAX_POINT_LIGHT_POWER
    ) {
      return resultFor(command, 'VALUE_OUT_OF_RANGE', { currentRevision: current.revision });
    }
    if (command.data.correctionOf !== undefined) {
      const corrected = facts.find((fact) => fact.sourceCommandId === command.data.correctionOf);
      if (
        !corrected
        || corrected.worldId !== command.worldId
        || corrected.entityId !== command.entityId
        || !Object.is(corrected.oldPower, command.data.power)
      ) {
        return resultFor(command, 'INVALID_COMMAND', { currentRevision: current.revision });
      }
    }
    if (Object.is(command.data.power, current.pointLight.power)) {
      return resultFor(command, 'NO_OP', {
        currentRevision: current.revision,
        resultingRevision: current.revision,
      });
    }

    const nextRevision = current.revision + 1;
    const nextSequence = eventSequence + 1;
    const fact: PointLightPowerSetFact = Object.freeze({
      schemaVersion: POINT_LIGHT_FACT_SCHEMA_VERSION,
      type: POINT_LIGHT_POWER_SET_FACT_TYPE,
      eventSequence: nextSequence,
      sourceCommandId: command.commandId,
      worldId,
      entityId: current.entityId,
      oldPower: current.pointLight.power,
      newPower: command.data.power,
      resultingRevision: nextRevision,
      receivedAt: context.receivedAt,
      ...(command.data.correctionOf === undefined
        ? {}
        : { correctionOf: command.data.correctionOf }),
    });
    const nextMap = new Map(currentMap);
    nextMap.set(current.entityId, recordWithPower(current, command.data.power, nextRevision));
    const nextDirtySlots = new Set(dirtySlots);
    const binding = bindingByEntity.get(current.entityId);
    if (binding) nextDirtySlots.add(binding.renderSlot);

    let nextState: PointLightStateSnapshot;
    try {
      nextState = createPointLightStateSnapshot(
        immutableValues(nextMap),
        runtimeInstanceId,
        renderBindings,
        nextSequence,
        nextDirtySlots,
      );
    } catch {
      return resultFor(command, 'EVENT_SEQUENCE_ERROR', { currentRevision: current.revision });
    }

    currentMap = nextMap;
    eventSequence = nextSequence;
    dirtySlots = nextDirtySlots;
    state = nextState;
    facts.push(fact);
    return resultFor(command, 'ACCEPTED', {
      currentRevision: current.revision,
      resultingRevision: nextRevision,
      eventSequence: nextSequence,
      fact,
    });
  };

  const correctPointLightPower = (
    requestInput: unknown,
    contextInput: unknown,
  ): PointLightCommandResult => {
    const bytes = encodedJsonByteLength(requestInput);
    if (bytes === null || bytes > MAX_POINT_LIGHT_COMMAND_BYTES) {
      return createCommandResult({ code: 'INVALID_COMMAND', runtimeInstanceId });
    }
    let request;
    try {
      request = parseCorrectPointLightPowerRequest(requestInput);
    } catch {
      return createCommandResult({ code: 'INVALID_COMMAND', runtimeInstanceId });
    }
    const corrected = facts.find((fact) => fact.sourceCommandId === request.correctedCommandId);
    if (!corrected) {
      const placeholder = Object.freeze({
        protocolVersion: POINT_LIGHT_COMMAND_PROTOCOL_VERSION,
        commandVersion: POINT_LIGHT_COMMAND_VERSION,
        type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
        commandId: request.commandId,
        worldId,
        entityId: initialRecords[0]?.entityId ?? parseEntityId(request.correctedCommandId),
        expectedRevision: request.expectedRevision,
        data: Object.freeze({ power: 0, correctionOf: request.correctedCommandId }),
      });
      return resultFor(placeholder, 'INVALID_COMMAND');
    }
    return submitPointLightPower(Object.freeze({
      protocolVersion: POINT_LIGHT_COMMAND_PROTOCOL_VERSION,
      commandVersion: POINT_LIGHT_COMMAND_VERSION,
      type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
      commandId: request.commandId,
      worldId: corrected.worldId,
      entityId: corrected.entityId,
      expectedRevision: request.expectedRevision,
      data: Object.freeze({
        power: corrected.oldPower,
        correctionOf: corrected.sourceCommandId,
      }),
    }), contextInput);
  };

  const replayPointLightPowerFacts = (factInput: unknown): PointLightStateSnapshot => {
    if (!Array.isArray(factInput)) replayFailure('Expected an ordered point-light fact array.');
    if (factInput.length > MAX_POINT_LIGHT_POWER_FACTS) {
      replayFailure(`Expected at most ${MAX_POINT_LIGHT_POWER_FACTS} point-light facts.`);
    }
    const replayMap = new Map(initialMap);
    const seenCommands = new Set<CommandId>();
    let sequence = 0;
    for (const value of factInput) {
      let fact: PointLightPowerSetFact;
      try {
        fact = parsePointLightPowerSetFact(value);
      } catch (error) {
        replayFailure(error instanceof Error ? error.message : 'Invalid point-light fact.');
      }
      const expectedSequence = sequence + 1;
      if (fact.eventSequence !== expectedSequence) {
        replayFailure(
          `Expected event sequence ${expectedSequence}; received ${fact.eventSequence}.`,
          fact.eventSequence,
        );
      }
      if (fact.worldId !== worldId) replayFailure('Point-light fact belongs to another world.', fact.eventSequence);
      if (seenCommands.has(fact.sourceCommandId)) {
        replayFailure('Point-light fact repeats a source command.', fact.eventSequence);
      }
      const current = replayMap.get(fact.entityId);
      if (!current) replayFailure('Point-light fact references an unknown entity.', fact.eventSequence);
      if (
        !Number.isFinite(fact.oldPower)
        || !Number.isFinite(fact.newPower)
        || fact.newPower < MIN_POINT_LIGHT_POWER
        || fact.newPower > MAX_POINT_LIGHT_POWER
        || !Object.is(fact.oldPower, current.pointLight.power)
        || fact.resultingRevision !== current.revision + 1
      ) {
        replayFailure('Point-light fact does not continue the current value and revision.', fact.eventSequence);
      }
      if (fact.correctionOf !== undefined && !seenCommands.has(fact.correctionOf)) {
        replayFailure('Point-light correction does not reference an earlier fact.', fact.eventSequence);
      }
      replayMap.set(
        fact.entityId,
        recordWithPower(current, fact.newPower, fact.resultingRevision),
      );
      seenCommands.add(fact.sourceCommandId);
      sequence = fact.eventSequence;
    }
    return createPointLightStateSnapshot(
      immutableValues(replayMap),
      runtimeInstanceId,
      renderBindings,
      sequence,
      [],
    );
  };

  const readPointLightState = (): PointLightStateSnapshot => state;
  const readPointLightRenderChanges = (): PointLightRenderChanges => readRenderChanges(state);
  const acknowledgePointLightRenderChanges = (sequence: number): boolean => {
    if (sequence !== eventSequence) return false;
    dirtySlots = new Set();
    state = createPointLightStateSnapshot(
      immutableValues(currentMap),
      runtimeInstanceId,
      renderBindings,
      eventSequence,
      dirtySlots,
    );
    return true;
  };
  const rebuildPointLightState = (): PointLightStateSnapshot => (
    replayPointLightPowerFacts(facts)
  );
  const dispose = (): void => {
    disposed = true;
  };

  return Object.freeze({
    worldId,
    listPointLights,
    getPointLight,
    submitPointLightPower,
    correctPointLightPower,
    listPointLightPowerFacts,
    listPointLightCommandResults,
    readPointLightState,
    readPointLightRenderChanges,
    acknowledgePointLightRenderChanges,
    replayPointLightPowerFacts,
    rebuildPointLightState,
    dispose,
  });
}
