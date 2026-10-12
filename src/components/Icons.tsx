import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const PlayIcon = (p: P) => (
  <Svg {...p} stroke="none" fill="currentColor">
    <path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6Z" />
  </Svg>
);
export const PauseIcon = (p: P) => (
  <Svg {...p} stroke="none" fill="currentColor">
    <rect x="6" y="5" width="4.2" height="14" rx="1.2" />
    <rect x="13.8" y="5" width="4.2" height="14" rx="1.2" />
  </Svg>
);
export const NextIcon = (p: P) => (
  <Svg {...p} stroke="none" fill="currentColor">
    <path d="M5 6.3v11.4a.9.9 0 0 0 1.4.75l8.3-5.7a.9.9 0 0 0 0-1.5L6.4 5.55A.9.9 0 0 0 5 6.3Z" />
    <rect x="16.5" y="5" width="2.6" height="14" rx="1" />
  </Svg>
);
export const PrevIcon = (p: P) => (
  <Svg {...p} stroke="none" fill="currentColor" style={{ transform: 'scaleX(-1)' }}>
    <path d="M5 6.3v11.4a.9.9 0 0 0 1.4.75l8.3-5.7a.9.9 0 0 0 0-1.5L6.4 5.55A.9.9 0 0 0 5 6.3Z" />
    <rect x="16.5" y="5" width="2.6" height="14" rx="1" />
  </Svg>
);
export const Back10Icon = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4 4v4h4" />
    <text x="12.2" y="15.2" fontSize="7.2" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">10</text>
  </Svg>
);
export const Fwd10Icon = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M20 4v4h-4" />
    <text x="11.8" y="15.2" fontSize="7.2" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">10</text>
  </Svg>
);
export const ShuffleIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6c1.1 1.7 2.3 2.7 4.3 2.7H21" />
    <path d="M3 17h3.5c1.3 0 2.3-.4 3.1-1.2M13.4 8.2c.8-.8 1.8-1.2 3.1-1.2H21" />
    <path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5" />
  </Svg>
);
export const RepeatIcon = ({ one, ...p }: P & { one?: boolean }) => (
  <Svg {...p}>
    <path d="M4 11V9a3 3 0 0 1 3-3h13" />
    <path d="m17 3 3 3-3 3" />
    <path d="M20 13v2a3 3 0 0 1-3 3H4" />
    <path d="m7 21-3-3 3-3" />
    {one && <text x="12" y="14.6" fontSize="7" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">1</text>}
  </Svg>
);
export const VolumeIcon = ({ level, ...p }: P & { level: number }) => (
  <Svg {...p}>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5Z" fill="currentColor" stroke="none" />
    {level > 0 && <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />}
    {level > 0.5 && <path d="M18.2 6.5a8 8 0 0 1 0 11" />}
    {level === 0 && <path d="m16 9.5 5 5M21 9.5l-5 5" />}
  </Svg>
);
export const FolderIcon = (p: P) => (
  <Svg {...p} stroke="none">
    <path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h5.2l2 2.2H20a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18Z" fill="currentColor" />
  </Svg>
);
export const ChevronIcon = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const ChevronDownIcon = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const LinkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3.1-3.1a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3.1 3.1a4 4 0 0 0 5.7 5.7l1.2-1.2" />
  </Svg>
);
export const ExternalIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
);
export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const KeyboardIcon = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const ResumeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
    <path d="M3 4v4.5h4.5" />
    <path d="M10.5 9.2v5.6l4.4-2.8Z" fill="currentColor" stroke="none" />
  </Svg>
);
export const DownloadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </Svg>
);

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--blue)" />
      <path d="M12 9.5v13l10.5-6.5z" fill="#fff" />
    </svg>
  );
}
