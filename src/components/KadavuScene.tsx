// The poster's picture, drawn as shapes: a striped sunset, the sun going into the river, palms, a string of lights
// and a man in his vallam. `width` is the drawing's width in its own units, so a phone and a laptop each get a
// composition that fits instead of one picture cropped. `compact` is the short strip on the registration page:
// the same picture redrawn with a lower sky, so nothing has its top cut off.

function Palm({ x, y, s, lean = 0 }: { x: number; y: number; s: number; lean?: number }) {
  const fronds = [
    "M0 0 C -22 -22 -52 -18 -66 6",
    "M0 0 C -26 -6 -46 8 -54 32",
    "M0 0 C -12 -30 -34 -40 -52 -30",
    "M0 0 C 22 -24 52 -20 66 4",
    "M0 0 C 26 -8 46 6 54 30",
    "M0 0 C 10 -30 30 -40 48 -34",
    "M0 0 C -2 -22 4 -36 14 -42",
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#150F24" fill="none" strokeLinecap="round">
      <path d={`M0 0 C ${lean} 40 ${lean + 4} 90 ${lean} 150`} strokeWidth="10" />
      {fronds.map((d) => (
        <path key={d} d={d} strokeWidth="7" />
      ))}
    </g>
  );
}

export default function KadavuScene({ width, className, id, compact = false, deck = false }: { width: number; className?: string; id: string; compact?: boolean; deck?: boolean }) {
  // `deck` adds open water under the boat, for the happy hour tag on the home page banner
  const H = compact ? 206 : deck ? 400 : 360;
  const HORIZON = compact ? 112 : 232;
  const sunR = compact ? 70 : 108;
  // a palm's trunk is 150 units long: place the crown so the foot lands just below the horizon
  const palmY = (s: number) => HORIZON + 42 - 150 * s;
  const sunX = width * 0.72;
  const boatX = width * 0.3;
  const palmX = width - 40;
  // The string of lights runs from the tall palm down towards the speech bubble
  const bigPalm = compact ? 0.74 : 1.35;
  const from = { x: palmX, y: palmY(bigPalm) - 6 };
  const to = { x: width * 0.42, y: HORIZON * 0.65 };
  const bulbs = Array.from({ length: 8 }, (_, i) => {
    const t = (i + 1) / 9;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t + Math.sin(Math.PI * t) * 20 };
  });

  return (
    <svg className={className} viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {/* sky bands */}
      <rect width={width} height={H} fill="#7D2A5D" />
      <rect y={HORIZON * 0.3} width={width} height={HORIZON * 0.27} fill="#C93D4F" />
      <rect y={HORIZON * 0.57} width={width} height={HORIZON * 0.22} fill="#EB6F3A" />
      <rect y={HORIZON * 0.79} width={width} height={HORIZON * 0.21} fill="#F4A148" />

      {/* the sun, sliced */}
      <clipPath id={`${id}-sun`}>
        <rect width={width} height={HORIZON} />
      </clipPath>
      <g clipPath={`url(#${id}-sun)`}>
        <circle cx={sunX} cy={HORIZON} r={sunR} fill="#FFD56E" />
        {[0.59, 0.41, 0.23].map((up, i) => (
          <rect key={up} x={sunX - sunR * (1.11 - i * 0.17)} y={HORIZON - sunR * up} width={sunR * (2.22 - i * 0.34)} height={5 + i} rx="3" fill="#F4A148" />
        ))}
      </g>

      {/* far bank and river */}
      <path d={`M0 ${HORIZON} Q ${width * 0.28} ${HORIZON - 26} ${width * 0.6} ${HORIZON} T ${width} ${HORIZON - 8} V ${H} H 0 Z`} fill="#2B2146" />
      <rect y={HORIZON} width={width} height="30" fill="#3B2A57" />
      <rect y={HORIZON + 30} width={width} height={H - HORIZON - 30} fill="#2B2146" />

      {/* the sun on the water */}
      <g className="kd-shimmer">
        {[
          [108, 0, "#FFD56E"],
          [90, 1, "#F4A148"],
          [72, 2, "#F4A148"],
          [54, 3, "#EB6F3A"],
          [36, 4, "#EB6F3A"],
          [22, 5, "#C93D4F"],
        ].map(([half, i, c]) => (
          <rect key={i} x={sunX - (Number(half) * sunR) / 108} y={HORIZON + 8 + Number(i) * (compact ? 14 : 18)} width={(Number(half) * 2 * sunR) / 108} height="5" rx="2.5" fill={String(c)} />
        ))}
      </g>
      <rect x={width * 0.06} y={HORIZON + 78} width="96" height="2.5" fill="#5B4A80" />
      {!compact && <rect x={width * 0.44} y={HORIZON + 104} width="74" height="2.5" fill="#5B4A80" />}

      <Palm x={width * 0.09} y={palmY(compact ? 0.56 : 0.9)} s={compact ? 0.56 : 0.9} />
      <Palm x={width * 0.21} y={palmY(compact ? 0.36 : 0.55) - 4} s={compact ? 0.36 : 0.55} />

      {/* string of lights */}
      <path d={`M${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2 + 40} ${to.x} ${to.y}`} stroke="#150F24" strokeWidth="1.6" fill="none" />
      {bulbs.map((b, i) => (
        <g key={i} className="kd-twinkle" style={{ animationDelay: `${(i % 4) * 0.45}s` }}>
          <circle cx={b.x} cy={b.y + 6} r="11" fill="#FFE9A8" opacity="0.25" />
          <circle cx={b.x} cy={b.y + 6} r="4.5" fill="#FFE9A8" />
        </g>
      ))}

      <Palm x={palmX} y={palmY(bigPalm)} s={bigPalm} lean={6} />

      {/* the man in the vallam */}
      <g className="kd-bob">
        <path d={`M${boatX - 86} ${HORIZON + 62} H ${boatX + 86} C ${boatX + 62} ${HORIZON + 88} ${boatX - 62} ${HORIZON + 88} ${boatX - 86} ${HORIZON + 62} Z`} fill="#F2B544" />
        <circle cx={boatX} cy={HORIZON + 20} r="9" fill="#150F24" />
        <rect x={boatX - 8} y={HORIZON + 30} width="16" height="32" rx="3" fill="#150F24" />
        <path d={`M${boatX - 54} ${HORIZON + 92} L ${boatX + 56} ${HORIZON + 8}`} stroke="#150F24" strokeWidth="4.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
