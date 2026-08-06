import type { ReactNode } from 'react';

export type PanelProps = Readonly<{
  className: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}>;

export function Panel({ className, title, children, actions }: PanelProps) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <header className="panel-heading">
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">A</span>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export function Tabs({
  labels,
  active,
  label,
  onSelect,
}: Readonly<{
  labels: readonly string[];
  active: string;
  label: string;
  onSelect(label: string): void;
}>) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {labels.map((tabLabel) => (
        <button
          aria-selected={tabLabel === active}
          className={tabLabel === active ? 'active' : undefined}
          key={tabLabel}
          onClick={() => onSelect(tabLabel)}
          role="tab"
          tabIndex={tabLabel === active ? 0 : -1}
          type="button"
        >
          {tabLabel}
        </button>
      ))}
    </div>
  );
}

export function JsonRecord({ value }: Readonly<{ value: unknown }>) {
  return <pre className="json-record">{JSON.stringify(value, null, 2)}</pre>;
}

export function CountBadge({
  available,
  retained,
}: Readonly<{ available: number; retained: number }>) {
  return (
    <span className="count-badge">
      {retained}{available === retained ? '' : ` of ${available}`}
    </span>
  );
}

export function RetentionFact({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  const accessibleValue = typeof value === 'string' || typeof value === 'number'
    ? `${label} ${value}`
    : label;
  return (
    <span aria-label={accessibleValue} className="retention-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}
