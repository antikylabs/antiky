const FRAGMENTED_INPUTS = ['Files', 'Terminal', 'Screenshots'] as const;
const EXPLICIT_INPUTS = ['Structured state', 'Commands', 'Diagnostics', 'Capture'] as const;

export default function ChangedAssumptionDiagram() {
  return (
    <figure className="assumption-diagram wrap" aria-label="Two development contexts">
      <div className="assumption-context assumption-context-fragmented">
        <p>Common inputs</p>
        <div className="assumption-inputs">
          {FRAGMENTED_INPUTS.map((input) => <span key={input}>{input}</span>)}
        </div>
        <span className="assumption-path" aria-hidden="true" />
        <strong>Reconstruct context</strong>
        <small>Useful fragments assembled by the participant</small>
      </div>
      <span className="assumption-versus" aria-hidden="true">versus</span>
      <div className="assumption-context assumption-context-explicit">
        <p>System interfaces</p>
        <div className="assumption-inputs">
          {EXPLICIT_INPUTS.map((input) => <span key={input}>{input}</span>)}
        </div>
        <span className="assumption-path" aria-hidden="true" />
        <strong>Shared explicit interfaces</strong>
        <small>Context the system can expose directly</small>
      </div>
    </figure>
  );
}
