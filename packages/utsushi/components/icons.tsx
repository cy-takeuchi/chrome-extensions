/** メニューで使うアイコン。色は currentColor */

const Stroke = ({ children }: { children: React.ReactNode }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** 6 つの点のつまみ */
export const GripIcon = () => (
  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
    {[3, 8, 13].flatMap((y) => [
      <circle key={`l${y}`} cx="2.5" cy={y} r="1.5" />,
      <circle key={`r${y}`} cx="7.5" cy={y} r="1.5" />,
    ])}
  </svg>
);

export const CopyIcon = () => (
  <Stroke>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </Stroke>
);

export const EditIcon = () => (
  <Stroke>
    <path d="M10.5 2.5l3 3-8 8H2.5v-3z" />
    <path d="M9 4l3 3" />
  </Stroke>
);

export const TrashIcon = () => (
  <Stroke>
    <path d="M2.5 4.5h11" />
    <path d="M6 4.5V3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5" />
    <path d="M4 4.5l.7 8.6a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.6" />
  </Stroke>
);
