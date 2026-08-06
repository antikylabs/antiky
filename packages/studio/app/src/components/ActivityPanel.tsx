import { useState } from 'react';

import type {
  DevelopmentMcpCall,
  DevelopmentMcpCallLog,
  DevelopmentSnapshot,
} from '@antiky/cli/development';

import type { StudioIssue } from '../development/coordinator.ts';
import { EmptyState, JsonRecord, Panel, RetentionFact, Tabs } from './primitives.tsx';

const labels = ['Events', 'MCP calls', 'Diagnostics'] as const;

function EventsView({ snapshot }: Readonly<{ snapshot: DevelopmentSnapshot | null }>) {
  const history = snapshot?.inspection?.events;
  if (!history) {
    return (
      <EmptyState title="No accepted events">
        Event-sourcing facts appear here in source order after a runtime publishes them.
      </EmptyState>
    );
  }
  return (
    <div className="activity-view">
      <div className="retention-strip" aria-label="Event retention">
        <RetentionFact label="Source" value={history.sourceId} />
        <RetentionFact label="Lifetime" value={history.retention.lifetime} />
        <RetentionFact label="Storage" value={history.retention.storage} />
        <RetentionFact label="Overflow" value={history.retention.overflow} />
        <RetentionFact label="Capacity" value={history.retention.capacity} />
        <RetentionFact
          label="Retained"
          value={`${history.counts.retained}/${history.counts.available}`}
        />
        <RetentionFact label="Dropped" value={history.retention.droppedCount} />
      </div>
      {history.incomplete && <p className="warning-note">This event history is incomplete.</p>}
      <div className="activity-records">
        {history.events.length === 0 ? (
          <EmptyState title="No accepted events">This event source has no retained facts.</EmptyState>
        ) : history.events.map((event) => (
          <details className="activity-record" key={event.sequence}>
            <summary>
              <span className="sequence">#{event.sequence}</span>
              <span className="source">{history.sourceId}</span>
              <strong>{event.type}</strong>
              <time dateTime={event.occurredAt}>{event.occurredAt}</time>
            </summary>
            <div className="record-detail-grid">
              <code>Command {event.commandId}</code>
              <code>Revision {event.revision}</code>
              <code>Entities {event.entityIds.join(', ') || 'none'}</code>
            </div>
            <JsonRecord value={event.data} />
          </details>
        ))}
      </div>
    </div>
  );
}

function McpCallRecord({ call }: Readonly<{ call: DevelopmentMcpCall }>) {
  return (
    <details className="activity-record" key={call.sequence}>
      <summary>
        <span className="sequence">#{call.sequence}</span>
        <span className="source">MCP Tool</span>
        <strong>{call.toolName}</strong>
        <time dateTime={call.receivedAt}>{call.durationMilliseconds} ms</time>
      </summary>
      <div className="record-badges">
        <span className={`outcome-badge outcome-${call.outcome}`}>{call.outcome}</span>
        {call.redaction.applied && <span className="warning-badge">Redacted</span>}
        {call.truncation.applied && <span className="warning-badge">Truncated</span>}
      </div>
      <div className="record-detail-grid">
        <code>Call {call.callId}</code>
        <code>JSON-RPC {String(call.jsonRpcId)}</code>
        <code>Received {call.receivedAt}</code>
        {Object.entries(call.correlationIds).map(([key, value]) => (
          <code key={key}>{key} {value}</code>
        ))}
      </div>
      <h3>Arguments</h3>
      <JsonRecord value={call.arguments} />
      {call.result !== undefined && <><h3>Result</h3><JsonRecord value={call.result} /></>}
      {call.error !== undefined && <><h3>Error</h3><JsonRecord value={call.error} /></>}
      {call.redaction.applied && <p className="record-paths">Redacted: {call.redaction.paths.join(', ')}</p>}
      {call.truncation.applied && <p className="record-paths">Truncated: {call.truncation.paths.join(', ')}</p>}
    </details>
  );
}

function McpCallsView({ log }: Readonly<{ log: DevelopmentMcpCallLog | null }>) {
  if (!log) {
    return <EmptyState title="No MCP call log">No development-session Tool history is available.</EmptyState>;
  }
  return (
    <div className="activity-view">
      <div className="retention-strip" aria-label="MCP call retention">
        <RetentionFact label="Owner" value={log.owner} />
        <RetentionFact label="Scope" value={log.retention.scope} />
        <RetentionFact label="Capacity" value={log.retention.capacity} />
        <RetentionFact label="Retained" value={log.retention.retainedCount} />
        <RetentionFact
          label="Range"
          value={log.retention.firstSequence === null
            ? 'none'
            : `${log.retention.firstSequence}–${log.retention.lastSequence}`}
        />
        <RetentionFact label="Dropped" value={log.retention.droppedCount} />
      </div>
      <div className="activity-records">
        {log.calls.length === 0 ? (
          <EmptyState title="No MCP Tool calls">Handled Tool calls appear here in source order.</EmptyState>
        ) : log.calls.map((call) => <McpCallRecord call={call} key={call.callId} />)}
      </div>
    </div>
  );
}

function DiagnosticsView({
  snapshot,
  issue,
}: Readonly<{ snapshot: DevelopmentSnapshot | null; issue: StudioIssue | null }>) {
  const diagnostics = [
    ...(snapshot?.diagnostics ?? []),
    ...(snapshot?.inspection?.diagnostics ?? []),
  ];
  if (!issue && diagnostics.length === 0) {
    return <EmptyState title="No diagnostics">The CLI and Framework report no current diagnostics.</EmptyState>;
  }
  return (
    <div className="diagnostic-list">
      {issue && (
        <article className="diagnostic-record">
          <span className="warning-badge">Studio</span>
          <code>{issue.code}</code>
          <p>{issue.message}</p>
        </article>
      )}
      {diagnostics.map((diagnostic) => (
        <article className="diagnostic-record" key={diagnostic.id}>
          <span className={`severity-badge severity-${diagnostic.severity}`}>{diagnostic.severity}</span>
          <code>{diagnostic.owner} · {diagnostic.code}</code>
          <p>{diagnostic.message}</p>
        </article>
      ))}
    </div>
  );
}

export function ActivityPanel({
  snapshot,
  mcpCallLog,
  issue,
  stale,
}: Readonly<{
  snapshot: DevelopmentSnapshot | null;
  mcpCallLog: DevelopmentMcpCallLog | null;
  issue: StudioIssue | null;
  stale: boolean;
}>) {
  const [active, setActive] = useState<(typeof labels)[number]>('Events');
  return (
    <Panel
      actions={<span className="panel-state">Event and development-session history</span>}
      className="activity-panel"
      title="Activity"
    >
      <Tabs active={active} label="Activity views" labels={labels} onSelect={(label) => setActive(label as typeof active)} />
      <div className="activity-body">
        {stale && <div className="stale-banner">Retained activity — not current</div>}
        <div hidden={active !== 'Events'} role="tabpanel"><EventsView snapshot={snapshot} /></div>
        <div hidden={active !== 'MCP calls'} role="tabpanel"><McpCallsView log={mcpCallLog} /></div>
        <div hidden={active !== 'Diagnostics'} role="tabpanel">
          <DiagnosticsView issue={issue} snapshot={snapshot} />
        </div>
      </div>
    </Panel>
  );
}
