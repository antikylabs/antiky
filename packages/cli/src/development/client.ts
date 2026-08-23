import { readSessionDescriptor } from '../host/session/descriptor.ts';
import { loadAntikyProject } from '../project/node.ts';
import {
  createDevelopmentClient,
  type DevelopmentClient,
} from './browser-client.ts';
import type { DevelopmentSnapshot } from './types.ts';

export type { DevelopmentClient } from './browser-client.ts';

export async function connectDevelopmentClient(
  projectPath?: string,
): Promise<DevelopmentClient> {
  const project = await loadAntikyProject(projectPath);
  const descriptor = await readSessionDescriptor(project);
  return createDevelopmentClient({
    inspectionUrl: descriptor.inspectionUrl,
    developmentSessionId: descriptor.developmentSessionId,
    credential: descriptor.credential,
  });
}

export async function inspectDevelopmentSession(
  projectPath?: string,
): Promise<DevelopmentSnapshot> {
  const client = await connectDevelopmentClient(projectPath);
  return client.readDevelopmentSnapshot();
}
