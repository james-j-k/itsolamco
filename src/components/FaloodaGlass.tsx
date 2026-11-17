// A hand-drawn falooda glass in Falooda Nation's colours: pink rose syrup, cream,
// fruit, jelly and a cherry on top, with a few berries drifting around it.
// Pure SVG, so it costs no image download and stays sharp at any size.
import { useId } from "react";

export default function FaloodaGlass({ className }: { className?: string }) {
  // Each copy of the drawing needs its own gradient and clip names: the home page holds two copies (one
  // for phones, one for laptops) and, with shared names, the hidden copy's gradients would be the ones used.
  const uid = useId().replace(/:/g, "");
  const glass = "M56 104 L204 104 L178 296 Q176 312 160 312 L100 312 Q84 312 82 296 Z";
  return (
    <svg viewBox="0 0 260 380" className={className} role="img" aria-label="A falooda dessert glass topped with ice cream and a cherry">
      <defs>
        <clipPath id={`fn-glass-clip-${uid}`}>
          <path d={glass} />
        </clipPath>
        <linearGradient id={`fn-rose-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F59BC0" />
          <stop offset="1" stopColor="#D8478F" />
        </linearGradient>
        <linearGradient id={`fn-syrup-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E0569B" />
          <stop offset="1" stopColor="#B8307A" />
        </linearGradient>
        <linearGradient id={`fn-shine-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`fn-scoop-${uid}`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FBE3D6" />
        </radialGradient>
        <radialGradient id={`fn-scoop-pink-${uid}`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#FFD3E3" />
          <stop offset="1" stopColor="#F28DB6" />
        </radialGradient>
      </defs>

      {/* soft floor shadow */}
      <ellipse cx="130" cy="354" rx="74" ry="10" fill="#CA4D8C" opacity="0.16" />

      {/* stem and foot */}
      <path d="M120 312 H140 V338 Q140 344 150 346 H110 Q120 344 120 338 Z" fill="#FFFFFF" opacity="0.85" />
      <ellipse cx="130" cy="348" rx="44" ry="8" fill="#FFFFFF" opacity="0.9" />

      {/* the dessert, clipped to the glass */}
      <g clipPath={`url(#fn-glass-clip-${uid})`}>
        <rect x="40" y="104" width="180" height="220" fill="#FFF8FB" />
        {/* whipped cream */}
        <path d="M40 104 H220 V130 Q200 142 180 130 Q160 144 140 130 Q120 144 100 130 Q80 144 60 130 Q50 136 40 130 Z" fill="#FFFFFF" />
        {/* strawberry pieces and mango cubes in rose syrup */}
        <rect x="40" y="128" width="180" height="40" fill={`url(#fn-rose-${uid})`} />
        <path d="M68 138 l16 -4 l8 14 l-18 6 z" fill="#E5395B" />
        <path d="M150 134 l18 2 l-2 16 l-18 -3 z" fill="#E5395B" />
        <path d="M112 146 l14 -6 l9 10 l-12 8 z" fill="#E5395B" />
        <rect x="92" y="136" width="14" height="14" rx="2" fill="#FFC93C" transform="rotate(14 99 143)" />
        <rect x="170" y="146" width="13" height="13" rx="2" fill="#FFC93C" transform="rotate(-18 176 152)" />
        <rect x="58" y="152" width="12" height="12" rx="2" fill="#FFC93C" transform="rotate(26 64 158)" />
        {/* vanilla ice cream */}
        <rect x="40" y="168" width="180" height="40" fill="#FFF3E6" />
        <path d="M40 168 Q60 178 80 168 Q100 180 120 168 Q140 180 160 168 Q180 180 200 168 Q210 174 220 168 V176 H40 Z" fill="#FFE9D6" />
        {/* rose milk with basil seeds */}
        <rect x="40" y="206" width="180" height="42" fill={`url(#fn-rose-${uid})`} />
        {[
          [78, 218], [96, 232], [118, 222], [138, 236], [158, 220], [176, 234], [104, 242], [150, 244], [88, 228],
        ].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="3.2" ry="2.2" fill="#3b1f2e" transform={`rotate(${i * 25} ${x} ${y})`} />
        ))}
        {/* jelly cubes and vermicelli */}
        <rect x="40" y="246" width="180" height="34" fill="#FFE3EE" />
        <rect x="86" y="252" width="20" height="20" rx="4" fill="#FF7FA8" opacity="0.9" />
        <rect x="122" y="256" width="18" height="18" rx="4" fill="#7ED6C8" opacity="0.9" />
        <rect x="152" y="250" width="20" height="20" rx="4" fill="#FF7FA8" opacity="0.9" />
        <path d="M70 252 q12 8 0 18 M180 254 q-12 8 0 18 M104 270 q10 4 22 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* thick syrup at the bottom */}
        <rect x="40" y="278" width="180" height="50" fill={`url(#fn-syrup-${uid})`} />
      </g>

      {/* glass edge, shine and rim */}
      <path d={glass} fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" opacity="0.95" />
      <path d="M72 112 L90 112 L108 292 L98 292 Z" fill={`url(#fn-shine-${uid})`} />
      <ellipse cx="130" cy="104" rx="74" ry="7" fill="#FFFFFF" opacity="0.9" />

      {/* scoops above the rim */}
      <circle cx="98" cy="92" r="30" fill={`url(#fn-scoop-${uid})`} />
      <circle cx="162" cy="88" r="32" fill={`url(#fn-scoop-pink-${uid})`} />
      <path d="M78 84 q10 -10 24 -6 M142 80 q12 -10 28 -4" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.65" />
      {/* syrup drizzle */}
      <path d="M84 102 q4 14 12 6 q6 12 12 -2 M148 100 q4 16 14 6 q6 12 14 -4" stroke="#D8478F" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* cherry */}
      <path d="M130 52 Q132 34 150 26" stroke="#3a7d4e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="129" cy="62" r="13" fill="#D61F4E" />
      <circle cx="124" cy="57" r="4" fill="#fff" opacity="0.5" />
      {/* sprinkles */}
      {[
        [82, 70, "#FFC93C", 20], [112, 60, "#139186", -30], [176, 66, "#FFC93C", 40], [196, 86, "#139186", 10], [66, 94, "#E5395B", 60],
        [146, 56, "#6B3FA0", -20], [118, 76, "#E5395B", 35], [186, 108, "#FFC93C", -45],
      ].map(([x, y, c, r], i) => (
        <rect key={i} x={x as number} y={y as number} width="9" height="3.6" rx="1.8" fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
      ))}

      {/* berries drifting around the glass */}
      <g className="fn-float">
        <circle cx="34" cy="176" r="15" fill="#E5395B" />
        <path d="M26 164 q8 -8 16 0" stroke="#3a7d4e" strokeWidth="3" fill="none" strokeLinecap="round" />
        {[[28, 176], [36, 182], [40, 172], [30, 186]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.3" fill="#FFE3A3" />
        ))}
      </g>
      <g className="fn-float-slow">
        <circle cx="230" cy="214" r="12" fill="#5B3FA0" />
        <circle cx="226" cy="210" r="3.5" fill="#fff" opacity="0.4" />
        <circle cx="244" cy="238" r="9" fill="#6B4BB5" />
      </g>
      <g className="fn-float-slow">
        <rect x="14" y="248" width="22" height="22" rx="4" fill="#FFC93C" transform="rotate(18 25 259)" />
      </g>
      <g className="fn-float">
        <circle cx="224" cy="132" r="7" fill="#139186" />
        <circle cx="214" cy="160" r="5" fill="#FFC93C" />
      </g>
    </svg>
  );
}
