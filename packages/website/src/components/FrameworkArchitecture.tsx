const CLIENTS = ['Game host', 'Studio', 'CLI', 'MCP adapter'] as const;
const BOUNDARIES = ['State + identity', 'Execution', 'Inspection', 'Commands'] as const;

export default function FrameworkArchitecture() {
  return (
    <figure className="framework-architecture wrap" aria-labelledby="framework-architecture-caption">
      <div
        className="architecture-diagram"
        role="img"
        aria-label="Planned Antiky architecture: game hosts, Studio, command-line tools, and the Model Context Protocol adapter use shared project services and Framework APIs for state, execution, inspection, and commands."
      >
        <div className="architecture-tier architecture-clients" aria-hidden="true">
          <span className="architecture-tier-label">Clients</span>
          <div>{CLIENTS.map((client) => <span key={client}>{client}</span>)}</div>
        </div>
        <span className="architecture-connector" aria-hidden="true">shared local contract</span>
        <div className="architecture-services" aria-hidden="true">
          <span>Project services</span>
          <strong>One development session</strong>
        </div>
        <span className="architecture-connector" aria-hidden="true">validated interfaces</span>
        <div className="architecture-tier architecture-framework" aria-hidden="true">
          <span className="architecture-tier-label">Framework</span>
          <div>{BOUNDARIES.map((boundary) => <span key={boundary}>{boundary}</span>)}</div>
        </div>
      </div>
      <figcaption id="framework-architecture-caption">
        Planned architecture. Some components are still in development.
      </figcaption>
    </figure>
  );
}
