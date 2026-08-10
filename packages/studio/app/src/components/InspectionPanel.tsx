import { useState } from 'react';

import type { DevelopmentSnapshotV2 } from '@antiky/cli/development';

import { CountBadge, EmptyState, JsonRecord, Panel, Tabs } from './primitives.tsx';

type Inspection = NonNullable<DevelopmentSnapshotV2['inspection']>;
type World = NonNullable<Inspection['world']>;
type Entity = World['entities'][number];

const labels = ['Hierarchy', 'Stores', 'Snapshot'] as const;

function ComponentRecord({ component }: Readonly<{ component: Entity['components'][number] }>) {
  return (
    <details className="component-record">
      <summary>
        <code>{component.typeId}</code>
        <span>v{component.schemaVersion}</span>
      </summary>
      <p>{component.summary}</p>
      <JsonRecord value={component.data} />
    </details>
  );
}

function EntityBranch({
  entity,
  childrenByParent,
  entityById,
}: Readonly<{
  entity: Entity;
  childrenByParent: ReadonlyMap<string, readonly string[]>;
  entityById: ReadonlyMap<string, Entity>;
}>) {
  const children = childrenByParent.get(entity.entityId) ?? [];
  return (
    <li>
      <details className="entity-record" open>
        <summary>
          <span className="entity-label">{entity.label}</span>
          <span className="record-meta">r{entity.revision} · {entity.components.length} components</span>
        </summary>
        <code className="record-id">{entity.entityId}</code>
        <div className="component-list">
          {entity.components.length === 0
            ? <span className="quiet-note">No published component summaries</span>
            : entity.components.map((component) => (
              <ComponentRecord component={component} key={component.typeId} />
            ))}
        </div>
        {children.length > 0 && (
          <ul className="entity-tree child-tree">
            {children.map((entityId) => {
              const child = entityById.get(entityId);
              return child && (
                <EntityBranch
                  childrenByParent={childrenByParent}
                  entity={child}
                  entityById={entityById}
                  key={entityId}
                />
              );
            })}
          </ul>
        )}
      </details>
    </li>
  );
}

function HierarchyView({ world }: Readonly<{ world: World }>) {
  const entityById = new Map(world.entities.map((entity) => [entity.entityId, entity]));
  const parentByChild = new Map(world.relationships.map((relationship) => (
    [relationship.childEntityId, relationship.parentEntityId]
  )));
  const mutableChildren = new Map<string, string[]>();
  for (const relationship of world.relationships) {
    const children = mutableChildren.get(relationship.parentEntityId) ?? [];
    children.push(relationship.childEntityId);
    mutableChildren.set(relationship.parentEntityId, children);
  }
  const roots = world.entities.filter((entity) => !parentByChild.has(entity.entityId));

  return (
    <div className="inspection-view">
      <div className="view-summary">
        <span>World <code>{world.worldId}</code></span>
        <CountBadge {...world.counts.entities} />
      </div>
      {world.incomplete && <p className="warning-note">This is an incomplete bounded world view.</p>}
      <ul className="entity-tree root-tree">
        {roots.map((entity) => (
          <EntityBranch
            childrenByParent={mutableChildren}
            entity={entity}
            entityById={entityById}
            key={entity.entityId}
          />
        ))}
      </ul>
    </div>
  );
}

function StoresView({ world }: Readonly<{ world: World }>) {
  return (
    <div className="inspection-view store-list">
      <div className="view-summary">
        <span>Named semantic stores</span>
        <CountBadge {...world.counts.stores} />
      </div>
      {world.stores.length === 0 ? (
        <EmptyState title="No published stores">The runtime has not published a semantic store view.</EmptyState>
      ) : world.stores.map((store) => (
        <details className="store-record" key={store.storeId} open>
          <summary>
            <span>{store.label}</span>
            <span className="record-meta">{store.kind} · {store.counts.retained}/{store.counts.available}</span>
          </summary>
          <code className="record-id">{store.storeId}</code>
          {store.incomplete && <p className="warning-note">This store view is incomplete.</p>}
          <div className="store-entries">
            {store.entries.map((entry) => (
              <details className="store-entry" key={entry.key}>
                <summary>{entry.key}</summary>
                {entry.entityId && <code className="record-id">Entity {entry.entityId}</code>}
                <JsonRecord value={entry.data} />
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export function InspectionPanel({
  snapshot,
  stale,
}: Readonly<{ snapshot: DevelopmentSnapshotV2 | null; stale: boolean }>) {
  const [active, setActive] = useState<(typeof labels)[number]>('Hierarchy');
  const world = snapshot?.inspection?.world;
  const count = world?.counts.entities.retained ?? 0;

  return (
    <Panel
      actions={<span className="panel-state">{count} entities{stale ? ' · stale' : ''}</span>}
      className="inspection-panel"
      title="Inspection"
      workspaceArea="inspection"
    >
      <Tabs active={active} label="Inspection views" labels={labels} onSelect={(label) => setActive(label as typeof active)} />
      <div className="inspection-body">
        {stale && <div className="stale-banner">Retained snapshot — not current</div>}
        <div hidden={active !== 'Hierarchy'} role="tabpanel">
          {world ? <HierarchyView world={world} /> : (
            <EmptyState title="No world inspection">
              Connect a compatible runtime to inspect its complete published hierarchy.
            </EmptyState>
          )}
        </div>
        <div hidden={active !== 'Stores'} role="tabpanel">
          {world ? <StoresView world={world} /> : (
            <EmptyState title="No store inspection">No semantic store view is available.</EmptyState>
          )}
        </div>
        <div hidden={active !== 'Snapshot'} role="tabpanel">
          {snapshot ? <JsonRecord value={snapshot} /> : (
            <EmptyState title="No inspection snapshot">No development snapshot is available.</EmptyState>
          )}
        </div>
      </div>
    </Panel>
  );
}
