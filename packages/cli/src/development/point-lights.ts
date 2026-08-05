import {
  IdValidationError,
  parseEntityId,
  type EntityId,
} from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';
import type {
  DevelopmentPointLightDetails,
  DevelopmentPointLightList,
  DevelopmentSnapshot,
} from './types.ts';

function readPointLightInspection(snapshot: DevelopmentSnapshot) {
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
  snapshot: DevelopmentSnapshot,
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
  snapshot: DevelopmentSnapshot,
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

