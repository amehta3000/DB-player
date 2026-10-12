const KEYS: [string, string][] = [
  ['Space / K', 'Play / pause'],
  ['J / L', 'Back / forward 10s'],
  ['← / →', 'Back / forward 5s'],
  ['N / P', 'Next / previous track'],
  ['0 – 9', 'Jump to 0% – 90%'],
  ['S', 'Shuffle'],
  ['R', 'Repeat: off → all → one'],
  ['M', 'Mute'],
  ['↑ / ↓', 'Volume'],
];

export function Shortcuts({ onClose }: { onClose(): void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel shortcuts" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        <dl>
          {KEYS.map(([k, v]) => (
            <div key={k}>
              <dt>
                {k.split(' ').map((part, i) => (part === '/' || part === '–' ? <span key={i}> {part} </span> : <kbd key={i}>{part}</kbd>))}
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button className="btn secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
