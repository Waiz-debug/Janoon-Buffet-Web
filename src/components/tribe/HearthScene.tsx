import { motion } from "framer-motion";
import { useMemo } from "react";

/**
 * Hand-drawn night scene for the hero: string lights, hanging lanterns, a city
 * skyline of arches and minarets, and open-air grills glowing on the ground.
 * It renders behind the hero photo so the section reads beautifully even
 * before (or without) any photography.
 */
export function HearthScene({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 720"
      preserveAspectRatio="xMidYMax slice"
      className={className}
    >
      <defs>
        <linearGradient id="hearth-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1410" />
          <stop offset="55%" stopColor="#2a1d13" />
          <stop offset="100%" stopColor="#3d2716" />
        </linearGradient>
        <radialGradient id="hearth-horizon" cx="50%" cy="100%" r="70%">
          <stop offset="0%" stopColor="#c97a2b" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#8a4a1c" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hearth-bulb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe6a8" />
          <stop offset="45%" stopColor="#f6c46a" />
          <stop offset="100%" stopColor="#e29b34" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hearth-emberglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ff7b1c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sky + horizon warmth */}
      <rect width="1440" height="720" fill="url(#hearth-sky)" />
      <rect width="1440" height="720" fill="url(#hearth-horizon)" />

      {/* distant old-city skyline: domes, arches, minarets */}
      <g fill="#150f0b" opacity="0.92">
        <path d="M0 520 h1440 v200 H0 Z" />
        <path d="M120 520 v-90 a60 60 0 0 1 120 0 v90 Z" />
        <path d="M300 520 v-140 h14 v-42 h12 v42 h14 v140 Z" />
        <path d="M340 520 v-110 a70 70 0 0 1 140 0 v110 Z" />
        <path d="M520 520 v-150 h16 v-30 h10 v30 h16 v150 Z" />
        <path d="M600 520 v-95 a85 85 0 0 1 170 0 v95 Z" />
        <path d="M820 520 v-130 h14 v-46 h12 v46 h14 v130 Z" />
        <path d="M880 520 v-105 a68 68 0 0 1 136 0 v105 Z" />
        <path d="M1060 520 v-145 h16 v-36 h10 v36 h16 v145 Z" />
        <path d="M1120 520 v-90 a72 72 0 0 1 144 0 v90 Z" />
        <path d="M1320 520 v-160 h14 v-38 h12 v38 h14 v160 Z" />
      </g>

      {/* string lights strung across the terrace */}
      <g>
        <path
          d="M-40 120 C 240 220, 520 210, 760 130 S 1240 60, 1480 150"
          fill="none"
          stroke="#150f0b"
          strokeWidth="3"
        />
        <path
          d="M-40 250 C 260 340, 560 330, 800 250 S 1260 190, 1480 270"
          fill="none"
          stroke="#150f0b"
          strokeWidth="3"
        />
        {[
          [90, 152],
          [250, 196],
          [420, 208],
          [600, 186],
          [760, 148],
          [940, 122],
          [1120, 128],
          [1300, 156],
          [140, 282],
          [320, 318],
          [520, 322],
          [700, 292],
          [880, 268],
          [1080, 258],
          [1280, 284],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="26" fill="url(#hearth-bulb)" opacity="0.5" />
            <circle cx={x} cy={y} r="5" fill="#ffdf9e" />
          </g>
        ))}
      </g>

      {/* hanging lanterns */}
      <g>
        {[
          [360, 300],
          [720, 262],
          [1080, 306],
        ].map(([x, y]) => (
          <g key={x}>
            <line x1={x} y1={y - 120} x2={x} y2={y - 34} stroke="#150f0b" strokeWidth="3" />
            <path
              d={`M${x - 24} ${y - 34} h48 l-8 56 h-32 Z`}
              fill="#150f0b"
              stroke="#c98a3c"
              strokeWidth="2"
            />
            <circle cx={x} cy={y - 6} r="30" fill="url(#hearth-emberglow)" opacity="0.75" />
            <circle cx={x} cy={y - 6} r="7" fill="#ffcf7d" />
          </g>
        ))}
      </g>

      {/* open-air seating + live grills along the ground */}
      <g fill="#0f0b08">
        <path d="M0 640 h1440 v80 H0 Z" />
        <path d="M170 640 c0-34 44-34 44 0 Z" />
        <path d="M200 600 h16 v40 h-16 Z" />
        <path d="M130 610 h-96 v8 h96 Z" />
        <path d="M470 640 c0-40 52-40 52 0 Z" />
        <path d="M505 592 h18 v48 h-18 Z" />
        <path d="M420 604 h-100 v10 h100 Z" />
        <path d="M900 640 c0-36 48-36 48 0 Z" />
        <path d="M930 598 h16 v42 h-16 Z" />
        <path d="M860 610 h-96 v9 h96 Z" />
        <path d="M1230 640 c0-32 42-32 42 0 Z" />
        <path d="M1258 606 h15 v34 h-15 Z" />
        <path d="M1200 616 h-90 v8 h90 Z" />
      </g>

      {/* grill embers */}
      {[
        [330, 646],
        [700, 640],
        [1060, 650],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="62" fill="url(#hearth-emberglow)" opacity="0.9" />
          <path d={`M${x - 40} ${y + 18} h80 l-10 -26 h-60 Z`} fill="#120d09" />
        </g>
      ))}
    </svg>
  );
}

/** Slow-rising embers for a little hearth life above the scene. */
export function Embers({ count = 18 }: { count?: number }) {
  const embers = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        left: (index * 97) % 100,
        delay: (index % 9) * 0.7,
        duration: 7 + ((index * 13) % 7),
        size: 2 + (index % 3),
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((ember) => (
        <motion.span
          key={ember.id}
          className="absolute rounded-full bg-gold/70 blur-[1px]"
          style={{
            left: `${ember.left}%`,
            width: ember.size,
            height: ember.size,
            bottom: "-2%",
          }}
          animate={{ y: ["0vh", "-85vh"], opacity: [0, 0.8, 0] }}
          transition={{
            duration: ember.duration,
            delay: ember.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
