import {
  IdValidationError,
  parseEntityId,
  type EntityId,
} from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';
import type {
  DevelopmentPointLightDetails,
  DevelopmentPointLightDetailsV2,
  DevelopmentPointLightList,
  DevelopmentPointLightListV2,
  DevelopmentSnapshot,
  DevelopmentSnapshotV2,
} from './types.ts';

function readPointLightInspection(snapshot: DevelopmentSnapshot | DevelopmentSnapshotV2) {
  const pointLights = snapshot.inspection?.pointLights;
  if (!pointLights) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime does not publish point-light inspection.',
    );
  }
  return pointLights;
}

function readEntityId(value: unknown): EntityId {
  try {
    return parseEntityId(value);
  } catch (cause: unknown) {
    if (cause instanceof IdValidationError) {
      throw new AntikyCliError(
        'ANTIKY_ARGUMENT_INVALID',
        'Point-light entity ID must be a canonical UUIDv7.',
      );
    }
    throw cause;
  }
}

export function projectDevelopmentPointLightList(
  snapshot: DevelopmentSnapshot | DevelopmentSnapshotV2,
): DevelopmentPointLightList {
  const inspection = readPointLightInspection(snapshot);
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: snapshot.developmentSessionId,
    runtimeInstanceId: inspection.runtime.instanceId,
    worldId: inspection.worldId,
    eventSequence: inspection.eventSequence,
    pointLights: inspection.authoring,
  });
}

export function projectDevelopmentPointLight(
  snapshot: DevelopmentSnapshot | DevelopmentSnapshotV2,
  entityIdInput: unknown,
): DevelopmentPointLightDetails {
  const inspection = readPointLightInspection(snapshot);
  const entityId = readEntityId(entityIdInput);
  const authoring = inspection.authoring.find((pointLight) => (
    pointLight.entityId === entityId
  ));
  const pointLight = authoring === undefined
    ? null
    : Object.freeze({
      authoring,
      runtime: inspection.runtime.pointLights.find((candidate) => (
        candidate.entityId === entityId
      ))!,
      render: inspection.render.pointLights.find((candidate) => (
        candidate.entityId === entityId
      )) ?? null,
      facts: Object.freeze(inspection.facts.filter((fact) => fact.entityId === entityId)),
    });
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: snapshot.developmentSessionId,
    runtimeInstanceId: inspection.runtime.instanceId,
    worldId: inspection.worldId,
    eventSequence: inspection.eventSequence,
    pointLight,
  });
}

function requireObservation(snapshot: DevelopmentSnapshotV2) {
  if (!snapshot.observation) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime has not published an observation.',
    );
  }
  return snapshot.observation;
}

export function projectDevelopmentPointLightListV2(
  snapshot: DevelopmentSnapshotV2,
): DevelopmentPointLightListV2 {
  const legacy = projectDevelopmentPointLightList(snapshot);
  return Object.freeze({
    schemaVersion: 2,
    observation: requireObservation(snapshot),
    worldId: legacy.worldId,
    eventSequence: legacy.eventSequence,
    pointLights: legacy.pointLights,
  });
}

export function projectDevelopmentPointLightV2(
  snapshot: DevelopmentSnapshotV2,
  entityIdInput: unknown,
): DevelopmentPointLightDetailsV2 {
  const legacy = projectDevelopmentPointLight(snapshot, entityIdInput);
  return Object.freeze({
    schemaVersion: 2,
    observation: requireObservation(snapshot),
    worldId: legacy.worldId,
    eventSequence: legacy.eventSequence,
    pointLight: legacy.pointLight,
  });
}
