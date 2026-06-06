// SVG animal avatars for each agent character

function AceAvatar({ state, w = 84, h = 108 }) {
  return (
    <svg viewBox="0 0 56 72" width={w} height={h}>
      {/* Body */}
      <ellipse cx="28" cy="56" rx="14" ry="12" fill="#F59E0B"/>
      <ellipse cx="28" cy="56" rx="9" ry="8" fill="#FDE68A"/>
      {/* Tail */}
      <path d="M42 58 Q52 52 50 42 Q48 36 44 40" stroke="#F59E0B" strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* Neck */}
      <rect x="22" y="42" width="12" height="8" rx="3" fill="#F59E0B"/>
      {/* Head */}
      <circle cx="28" cy="34" r="16" fill="#F59E0B"/>
      {/* Fluffy cheeks */}
      <circle cx="14" cy="34" r="5" fill="#FBBF24" opacity="0.6"/>
      <circle cx="42" cy="34" r="5" fill="#FBBF24" opacity="0.6"/>
      {/* Left ear */}
      <ellipse cx="14" cy="22" rx="6" ry="9" fill="#F59E0B" transform="rotate(-15 14 22)"/>
      <ellipse cx="14" cy="22" rx="3.5" ry="5.5" fill="#FDE68A" transform="rotate(-15 14 22)"/>
      {/* Right ear */}
      <ellipse cx="42" cy="22" rx="6" ry="9" fill="#F59E0B" transform="rotate(15 42 22)"/>
      <ellipse cx="42" cy="22" rx="3.5" ry="5.5" fill="#FDE68A" transform="rotate(15 42 22)"/>
      {/* Eyes */}
      <circle cx="22" cy="32" r="3.5" fill="#1F2937"/>
      <circle cx="34" cy="32" r="3.5" fill="#1F2937"/>
      <circle cx="23" cy="31" r="1.2" fill="white"/>
      <circle cx="35" cy="31" r="1.2" fill="white"/>
      {/* Nose */}
      <ellipse cx="28" cy="37" rx="3" ry="2.5" fill="#92400E"/>
      {/* Mouth */}
      <path d="M24 40 Q28 44 32 40" stroke="#92400E" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Headphones */}
      <path d="M13 28 Q28 14 43 28" stroke="#374151" strokeWidth="2.5" fill="none"/>
      <rect x="9" y="26" width="7" height="9" rx="2" fill="#4B5563"/>
      <rect x="40" y="26" width="7" height="9" rx="2" fill="#4B5563"/>
      {/* Thinking dots */}
      {state === 'thinking' && (
        <g transform="translate(32, 14)">
          <circle cx="0" cy="0" r="2" fill="#F59E0B" className="dot-1"/>
          <circle cx="6" cy="-3" r="2" fill="#F59E0B" className="dot-2"/>
          <circle cx="12" cy="-1" r="2" fill="#F59E0B" className="dot-3"/>
        </g>
      )}
      {/* Done checkmark */}
      {state === 'done' && (
        <g transform="translate(34, 8)">
          <circle cx="8" cy="8" r="8" fill="#10B981"/>
          <path d="M4 8 L7 11 L13 5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

function VioletAvatar({ state, w = 84, h = 108 }) {
  return (
    <svg viewBox="0 0 56 72" width={w} height={h}>
      {/* Body */}
      <ellipse cx="28" cy="57" rx="12" ry="11" fill="#C084FC"/>
      <ellipse cx="28" cy="57" rx="7" ry="7" fill="#E9D5FF"/>
      {/* Tail */}
      <path d="M40 60 Q50 55 48 44 Q47 38 43 42" stroke="#A855F7" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      {/* Neck */}
      <rect x="23" y="44" width="10" height="7" rx="3" fill="#C084FC"/>
      {/* Head */}
      <circle cx="28" cy="32" r="15" fill="#E879F9"/>
      {/* Left ear */}
      <polygon points="13,18 8,6 20,14" fill="#E879F9"/>
      <polygon points="13,18 10,10 18,14" fill="#F0ABFC"/>
      {/* Right ear */}
      <polygon points="43,18 48,6 36,14" fill="#E879F9"/>
      <polygon points="43,18 46,10 38,14" fill="#F0ABFC"/>
      {/* Face white */}
      <ellipse cx="28" cy="34" rx="10" ry="9" fill="#FDF4FF"/>
      {/* Glasses */}
      <circle cx="22" cy="30" r="5.5" fill="none" stroke="#7C3AED" strokeWidth="1.5"/>
      <circle cx="34" cy="30" r="5.5" fill="none" stroke="#7C3AED" strokeWidth="1.5"/>
      <line x1="27.5" y1="30" x2="28.5" y2="30" stroke="#7C3AED" strokeWidth="1.5"/>
      <line x1="16.5" y1="28" x2="14" y2="27" stroke="#7C3AED" strokeWidth="1.5"/>
      <line x1="39.5" y1="28" x2="42" y2="27" stroke="#7C3AED" strokeWidth="1.5"/>
      {/* Eyes */}
      <circle cx="22" cy="30" r="2.5" fill="#1F2937"/>
      <circle cx="34" cy="30" r="2.5" fill="#1F2937"/>
      <circle cx="22.8" cy="29.2" r="0.9" fill="white"/>
      <circle cx="34.8" cy="29.2" r="0.9" fill="white"/>
      {/* Nose */}
      <ellipse cx="28" cy="35" rx="2" ry="1.5" fill="#C026D3"/>
      {/* Mouth */}
      <path d="M24.5 38 Q28 41.5 31.5 38" stroke="#A21CAF" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      {state === 'thinking' && (
        <g transform="translate(34, 12)">
          <circle cx="0" cy="0" r="2" fill="#A855F7" className="dot-1"/>
          <circle cx="6" cy="-3" r="2" fill="#A855F7" className="dot-2"/>
          <circle cx="12" cy="-1" r="2" fill="#A855F7" className="dot-3"/>
        </g>
      )}
      {state === 'done' && (
        <g transform="translate(34, 8)">
          <circle cx="8" cy="8" r="8" fill="#10B981"/>
          <path d="M4 8 L7 11 L13 5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

function MeiAvatar({ state, w = 84, h = 108 }) {
  return (
    <svg viewBox="0 0 56 72" width={w} height={h}>
      {/* Body */}
      <ellipse cx="28" cy="57" rx="13" ry="12" fill="#E5E7EB"/>
      <ellipse cx="28" cy="57" rx="9" ry="8" fill="white"/>
      {/* Black patches on arms */}
      <ellipse cx="15" cy="54" rx="5" ry="7" fill="#1F2937"/>
      <ellipse cx="41" cy="54" rx="5" ry="7" fill="#1F2937"/>
      {/* Neck */}
      <rect x="23" y="44" width="10" height="7" rx="3" fill="#E5E7EB"/>
      {/* Head */}
      <circle cx="28" cy="32" r="16" fill="#E5E7EB"/>
      {/* Panda ears */}
      <circle cx="14" cy="18" r="7" fill="#1F2937"/>
      <circle cx="42" cy="18" r="7" fill="#1F2937"/>
      <circle cx="14" cy="18" r="4" fill="#374151"/>
      <circle cx="42" cy="18" r="4" fill="#374151"/>
      {/* Face white */}
      <ellipse cx="28" cy="33" rx="11" ry="10" fill="white"/>
      {/* Eye patches */}
      <ellipse cx="21" cy="29" rx="5.5" ry="5" fill="#1F2937"/>
      <ellipse cx="35" cy="29" rx="5.5" ry="5" fill="#1F2937"/>
      {/* Eyes */}
      <circle cx="21" cy="29" r="3" fill="#1F2937"/>
      <circle cx="35" cy="29" r="3" fill="#1F2937"/>
      <circle cx="22" cy="28" r="1.2" fill="white"/>
      <circle cx="36" cy="28" r="1.2" fill="white"/>
      {/* Nose */}
      <ellipse cx="28" cy="35" rx="2.5" ry="2" fill="#9CA3AF"/>
      {/* Mouth */}
      <path d="M24 38.5 Q28 42 32 38.5" stroke="#6B7280" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Blushy cheeks */}
      <ellipse cx="15" cy="34" rx="4" ry="2.5" fill="#FBBF24" opacity="0.3"/>
      <ellipse cx="41" cy="34" rx="4" ry="2.5" fill="#FBBF24" opacity="0.3"/>
      {state === 'thinking' && (
        <g transform="translate(34, 10)">
          <circle cx="0" cy="0" r="2" fill="#6B7280" className="dot-1"/>
          <circle cx="6" cy="-3" r="2" fill="#6B7280" className="dot-2"/>
          <circle cx="12" cy="-1" r="2" fill="#6B7280" className="dot-3"/>
        </g>
      )}
      {state === 'done' && (
        <g transform="translate(34, 8)">
          <circle cx="8" cy="8" r="8" fill="#10B981"/>
          <path d="M4 8 L7 11 L13 5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

function LunaAvatar({ state, w = 84, h = 108 }) {
  return (
    <svg viewBox="0 0 56 72" width={w} height={h}>
      {/* Body */}
      <ellipse cx="28" cy="57" rx="12" ry="11" fill="#60A5FA"/>
      <ellipse cx="28" cy="57" rx="7" ry="7" fill="#BFDBFE"/>
      {/* Tail */}
      <path d="M40 62 Q50 57 48 46 Q47 40 43 44" stroke="#3B82F6" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      {/* Neck */}
      <rect x="23" y="44" width="10" height="7" rx="3" fill="#60A5FA"/>
      {/* Head */}
      <circle cx="28" cy="32" r="15" fill="#93C5FD"/>
      {/* Ears */}
      <polygon points="13,18 9,5 21,15" fill="#93C5FD"/>
      <polygon points="13,18 11,8 19,15" fill="#BFDBFE"/>
      <polygon points="43,18 47,5 35,15" fill="#93C5FD"/>
      <polygon points="43,18 45,8 37,15" fill="#BFDBFE"/>
      {/* Face */}
      <ellipse cx="28" cy="33" rx="10" ry="9" fill="#DBEAFE"/>
      {/* Eyes - focused */}
      <circle cx="22" cy="30" r="3.5" fill="#1E3A8A"/>
      <circle cx="34" cy="30" r="3.5" fill="#1E3A8A"/>
      <circle cx="23" cy="29" r="1.3" fill="white"/>
      <circle cx="35" cy="29" r="1.3" fill="white"/>
      {/* Nose */}
      <ellipse cx="28" cy="35" rx="2" ry="1.5" fill="#2563EB"/>
      {/* Mouth */}
      <path d="M25 38.5 Q28 41 31 38.5" stroke="#1D4ED8" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      {state === 'thinking' && (
        <g transform="translate(34, 12)">
          <circle cx="0" cy="0" r="2" fill="#3B82F6" className="dot-1"/>
          <circle cx="6" cy="-3" r="2" fill="#3B82F6" className="dot-2"/>
          <circle cx="12" cy="-1" r="2" fill="#3B82F6" className="dot-3"/>
        </g>
      )}
      {state === 'done' && (
        <g transform="translate(34, 8)">
          <circle cx="8" cy="8" r="8" fill="#10B981"/>
          <path d="M4 8 L7 11 L13 5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

function LeoAvatar({ state, w = 84, h = 108 }) {
  return (
    <svg viewBox="0 0 56 72" width={w} height={h}>
      {/* Body */}
      <ellipse cx="28" cy="57" rx="12" ry="11" fill="#FB923C"/>
      <ellipse cx="28" cy="57" rx="7" ry="7" fill="#FED7AA"/>
      {/* Tail */}
      <path d="M40 62 Q52 55 50 44 Q48 38 44 42" stroke="#F97316" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      {/* Tail tip */}
      <circle cx="50" cy="44" r="3" fill="#FDE68A"/>
      {/* Neck */}
      <rect x="23" y="44" width="10" height="7" rx="3" fill="#FB923C"/>
      {/* Head */}
      <circle cx="28" cy="32" r="15" fill="#FDBA74"/>
      {/* Ears */}
      <polygon points="13,18 9,5 21,15" fill="#FDBA74"/>
      <polygon points="13,18 11,8 19,15" fill="#FED7AA"/>
      <polygon points="43,18 47,5 35,15" fill="#FDBA74"/>
      <polygon points="43,18 45,8 37,15" fill="#FED7AA"/>
      {/* Face */}
      <ellipse cx="28" cy="33" rx="10" ry="9" fill="#FEF3C7"/>
      {/* Eyes - energetic wide */}
      <circle cx="22" cy="30" r="4" fill="#92400E"/>
      <circle cx="34" cy="30" r="4" fill="#92400E"/>
      <circle cx="23.5" cy="28.5" r="1.5" fill="white"/>
      <circle cx="35.5" cy="28.5" r="1.5" fill="white"/>
      {/* Nose */}
      <ellipse cx="28" cy="35" rx="2.5" ry="2" fill="#C2410C"/>
      {/* Big smile */}
      <path d="M22 38.5 Q28 44 34 38.5" stroke="#C2410C" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Whiskers */}
      <line x1="8" y1="34" x2="20" y2="35.5" stroke="#D97706" strokeWidth="0.8" opacity="0.6"/>
      <line x1="8" y1="37" x2="20" y2="37" stroke="#D97706" strokeWidth="0.8" opacity="0.6"/>
      <line x1="36" y1="35.5" x2="48" y2="34" stroke="#D97706" strokeWidth="0.8" opacity="0.6"/>
      <line x1="36" y1="37" x2="48" y2="37" stroke="#D97706" strokeWidth="0.8" opacity="0.6"/>
      {state === 'thinking' && (
        <g transform="translate(34, 12)">
          <circle cx="0" cy="0" r="2" fill="#F97316" className="dot-1"/>
          <circle cx="6" cy="-3" r="2" fill="#F97316" className="dot-2"/>
          <circle cx="12" cy="-1" r="2" fill="#F97316" className="dot-3"/>
        </g>
      )}
      {state === 'done' && (
        <g transform="translate(34, 8)">
          <circle cx="8" cy="8" r="8" fill="#10B981"/>
          <path d="M4 8 L7 11 L13 5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

function ArloAvatar({ state, w = 84, h = 108 }) {
  return (
    <svg viewBox="0 0 56 72" width={w} height={h}>
      {/* Body - big bear */}
      <ellipse cx="28" cy="56" rx="16" ry="14" fill="#CBD5E1"/>
      <ellipse cx="28" cy="56" rx="10" ry="9" fill="#E2E8F0"/>
      {/* Arms */}
      <ellipse cx="10" cy="55" rx="6" ry="9" fill="#CBD5E1" transform="rotate(10 10 55)"/>
      <ellipse cx="46" cy="55" rx="6" ry="9" fill="#CBD5E1" transform="rotate(-10 46 55)"/>
      {/* Neck */}
      <rect x="21" y="42" width="14" height="8" rx="3" fill="#CBD5E1"/>
      {/* Head - big round */}
      <circle cx="28" cy="30" r="18" fill="#CBD5E1"/>
      {/* Round ears */}
      <circle cx="12" cy="16" r="7" fill="#CBD5E1"/>
      <circle cx="12" cy="16" r="4.5" fill="#B0BCC8"/>
      <circle cx="44" cy="16" r="7" fill="#CBD5E1"/>
      <circle cx="44" cy="16" r="4.5" fill="#B0BCC8"/>
      {/* Face */}
      <ellipse cx="28" cy="32" rx="12" ry="11" fill="#E2E8F0"/>
      {/* Eyes - calm serious */}
      <circle cx="22" cy="27" r="3.5" fill="#334155"/>
      <circle cx="34" cy="27" r="3.5" fill="#334155"/>
      <circle cx="23" cy="26" r="1.2" fill="white"/>
      <circle cx="35" cy="26" r="1.2" fill="white"/>
      {/* Nose */}
      <ellipse cx="28" cy="33" rx="3.5" ry="2.5" fill="#475569"/>
      {/* Neutral mouth */}
      <path d="M24.5 37.5 Q28 39.5 31.5 37.5" stroke="#475569" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Badge on chest */}
      <rect x="23" y="52" width="10" height="7" rx="1" fill="#F59E0B"/>
      <text x="28" y="57.5" textAnchor="middle" fontSize="4" fill="#7C3501" fontWeight="bold">GUARD</text>
      {state === 'thinking' && (
        <g transform="translate(36, 8)">
          <circle cx="0" cy="0" r="2" fill="#64748B" className="dot-1"/>
          <circle cx="6" cy="-3" r="2" fill="#64748B" className="dot-2"/>
          <circle cx="12" cy="-1" r="2" fill="#64748B" className="dot-3"/>
        </g>
      )}
      {state === 'done' && (
        <g transform="translate(36, 6)">
          <circle cx="8" cy="8" r="8" fill="#10B981"/>
          <path d="M4 8 L7 11 L13 5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

function CharlieAvatar({ state, w = 84, h = 108 }) {
  return (
    <svg viewBox="0 0 56 72" width={w} height={h}>
      {/* Body - smaller puppy */}
      <ellipse cx="28" cy="58" rx="11" ry="10" fill="#D97706"/>
      <ellipse cx="28" cy="58" rx="7" ry="6.5" fill="#FDE68A"/>
      {/* Neck */}
      <rect x="23" y="46" width="10" height="7" rx="3" fill="#D97706"/>
      {/* Head */}
      <circle cx="28" cy="33" r="15" fill="#F59E0B"/>
      {/* Floppy ears */}
      <ellipse cx="12" cy="31" rx="5" ry="10" fill="#D97706" transform="rotate(-10 12 31)"/>
      <ellipse cx="44" cy="31" rx="5" ry="10" fill="#D97706" transform="rotate(10 44 31)"/>
      <ellipse cx="12" cy="31" rx="3" ry="6.5" fill="#FDE68A" transform="rotate(-10 12 31)"/>
      <ellipse cx="44" cy="31" rx="3" ry="6.5" fill="#FDE68A" transform="rotate(10 44 31)"/>
      {/* Face */}
      <ellipse cx="28" cy="35" rx="10" ry="9" fill="#FEF3C7"/>
      {/* Eyes - eager wide */}
      <circle cx="22" cy="30" r="4" fill="#1F2937"/>
      <circle cx="34" cy="30" r="4" fill="#1F2937"/>
      <circle cx="23.5" cy="28.5" r="1.5" fill="white"/>
      <circle cx="35.5" cy="28.5" r="1.5" fill="white"/>
      {/* Spots */}
      <circle cx="18" cy="25" r="2.5" fill="#B45309" opacity="0.5"/>
      {/* Nose */}
      <ellipse cx="28" cy="36" rx="2.5" ry="2" fill="#92400E"/>
      {/* Big happy mouth */}
      <path d="M22 40 Q28 45 34 40" stroke="#92400E" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Tongue */}
      <ellipse cx="28" cy="43" rx="3" ry="2" fill="#FCA5A5"/>
      {/* Headphones */}
      <path d="M14 27 Q28 14 42 27" stroke="#374151" strokeWidth="2.5" fill="none"/>
      <rect x="10" y="25" width="7" height="8" rx="2" fill="#4B5563"/>
      <rect x="39" y="25" width="7" height="8" rx="2" fill="#4B5563"/>
      {state === 'thinking' && (
        <g transform="translate(34, 10)">
          <circle cx="0" cy="0" r="2" fill="#D97706" className="dot-1"/>
          <circle cx="6" cy="-3" r="2" fill="#D97706" className="dot-2"/>
          <circle cx="12" cy="-1" r="2" fill="#D97706" className="dot-3"/>
        </g>
      )}
      {state === 'done' && (
        <g transform="translate(34, 8)">
          <circle cx="8" cy="8" r="8" fill="#10B981"/>
          <path d="M4 8 L7 11 L13 5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

function CocoAvatar({ state, w = 84, h = 108 }) {
  return (
    <svg viewBox="0 0 56 72" width={w} height={h}>
      {/* Suit jacket body */}
      <ellipse cx="28" cy="56" rx="14" ry="13" fill="#1F2937"/>
      {/* Shirt/tie */}
      <ellipse cx="28" cy="56" rx="6" ry="8" fill="white"/>
      <polygon points="28,48 26,58 28,60 30,58" fill="#DC2626"/>
      {/* Lapels */}
      <polygon points="22,46 15,58 22,58" fill="#374151"/>
      <polygon points="34,46 41,58 34,58" fill="#374151"/>
      {/* Neck */}
      <rect x="23" y="43" width="10" height="7" rx="3" fill="#FB923C"/>
      {/* Head */}
      <circle cx="28" cy="30" r="15" fill="#FB923C"/>
      {/* Tiger stripes on head */}
      <path d="M16 22 Q18 18 20 22" stroke="#92400E" strokeWidth="2" fill="none"/>
      <path d="M36 22 Q38 18 40 22" stroke="#92400E" strokeWidth="2" fill="none"/>
      <path d="M13 28 Q11 30 13 32" stroke="#92400E" strokeWidth="2" fill="none"/>
      <path d="M43 28 Q45 30 43 32" stroke="#92400E" strokeWidth="2" fill="none"/>
      {/* Ears */}
      <polygon points="13,18 9,5 21,14" fill="#FB923C"/>
      <polygon points="13,18 11,8 19,14" fill="#FED7AA"/>
      <polygon points="43,18 47,5 35,14" fill="#FB923C"/>
      <polygon points="43,18 45,8 37,14" fill="#FED7AA"/>
      {/* Face */}
      <ellipse cx="28" cy="32" rx="10" ry="9" fill="#FED7AA"/>
      {/* Tiger face stripes */}
      <path d="M18 30 Q20 28 22 30" stroke="#C2410C" strokeWidth="1.2" fill="none"/>
      <path d="M34 30 Q36 28 38 30" stroke="#C2410C" strokeWidth="1.2" fill="none"/>
      {/* Eyes - sharp/smart */}
      <circle cx="22" cy="28" r="3.5" fill="#1E1B4B"/>
      <circle cx="34" cy="28" r="3.5" fill="#1E1B4B"/>
      <circle cx="23" cy="27" r="1.2" fill="white"/>
      <circle cx="35" cy="27" r="1.2" fill="white"/>
      {/* Nose */}
      <ellipse cx="28" cy="33" rx="2.5" ry="2" fill="#C2410C"/>
      {/* Smirk */}
      <path d="M24 37 Q30 40 32 37" stroke="#9A3412" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Whiskers */}
      <line x1="10" y1="33" x2="21" y2="34.5" stroke="#C2410C" strokeWidth="0.8" opacity="0.5"/>
      <line x1="10" y1="36" x2="21" y2="36" stroke="#C2410C" strokeWidth="0.8" opacity="0.5"/>
      <line x1="35" y1="34.5" x2="46" y2="33" stroke="#C2410C" strokeWidth="0.8" opacity="0.5"/>
      <line x1="35" y1="36" x2="46" y2="36" stroke="#C2410C" strokeWidth="0.8" opacity="0.5"/>
      {state === 'thinking' && (
        <g transform="translate(34, 10)">
          <circle cx="0" cy="0" r="2" fill="#EF4444" className="dot-1"/>
          <circle cx="6" cy="-3" r="2" fill="#EF4444" className="dot-2"/>
          <circle cx="12" cy="-1" r="2" fill="#EF4444" className="dot-3"/>
        </g>
      )}
      {state === 'done' && (
        <g transform="translate(34, 8)">
          <circle cx="8" cy="8" r="8" fill="#10B981"/>
          <path d="M4 8 L7 11 L13 5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

const AVATAR_MAP = {
  dog: AceAvatar,
  cat_pink: VioletAvatar,
  panda: MeiAvatar,
  cat_blue: LunaAvatar,
  cat_orange: LeoAvatar,
  bear: ArloAvatar,
  puppy: CharlieAvatar,
  tiger: CocoAvatar,
}

const IMAGE_AVATARS = {
  puppy: '/avatars/charlie.png',
  parrot: '/avatars/sonic.png',
  tiger: '/avatars/coco.png',
  hamster: '/avatars/bean.png',
  fox: '/avatars/nova.png',
}

export default function AgentAvatar({ animal, state = 'idle', size }) {
  const imageUrl = IMAGE_AVATARS[animal]
  const w = size ?? 84
  const h = size != null ? Math.round(size * 108 / 84) : 108

  if (imageUrl) {
    return (
      <div className="relative flex items-center justify-center shrink-0" style={{ width: w, height: h }}>
        <img
          src={imageUrl}
          alt={animal}
          className="rounded-2xl object-cover border border-white/10 shadow-md bg-neutral-950/20"
          style={{ width: '92%', height: '92%' }}
        />
        {/* Thinking dots overlay */}
        {state === 'thinking' && (
          <div className="absolute top-1 right-1 bg-neutral-900/90 border border-amber-500/30 rounded-full px-1.5 py-0.5 shadow-md flex gap-0.5 z-10 scale-90 origin-top-right">
            <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse"/>
            <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse delay-75"/>
            <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse delay-150"/>
          </div>
        )}
        {/* Done checkmark overlay */}
        {state === 'done' && (
          <div className="absolute -top-1 -right-1 bg-emerald-500 border border-white/20 rounded-full w-5 h-5 flex items-center justify-center shadow-md z-10">
            <svg viewBox="0 0 12 12" className="w-3 h-3 stroke-white fill-none stroke-[2]" strokeLinecap="round">
              <path d="M2.5 6.5 L4.5 8.5 L9.5 3.5"/>
            </svg>
          </div>
        )}
      </div>
    )
  }

  const Component = AVATAR_MAP[animal] || AceAvatar
  return <Component state={state} w={w} h={h} />
}
