// Leaderboard ranking keys
export const LEADERBOARD_CATEGORY_KEYS: Record<LeaderboardCategory, string> = {
  wealth: "total_wealth",
  trading: "total_trade_volume",
  exploration: "sectors_visited",
  territory: "territory_control_percentage",
}
export const LEADERBOARD_CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  wealth: "Wealth",
  trading: "Trading",
  exploration: "Exploration",
  territory: "Territory",
}

export const RESOURCE_SHORT_NAMES = {
  quantum_foam: "QF",
  retro_organics: "RO",
  neuro_symbolics: "NS",
} as const satisfies Record<Resource, string>

export const RESOURCE_VERBOSE_NAMES = {
  quantum_foam: "Quantum Foam",
  retro_organics: "Retro Organics",
  neuro_symbolics: "Neuro Symbolics",
} as const satisfies Record<Resource, string>

export const PLAYER_TYPE_NAMES = {
  human: "Human",
  npc: "NPC",
  corporation_ship: "Corporation Ship",
} as const satisfies Record<PlayerType, string>

// UI panels
export const UI_PANELS = [
  "sector",
  "player",
  "trade",
  "task_history",
  "contracts",
  "logs",
  "task_stream",
] as const

// Map bounds & zoom
export const DEFAULT_MAX_BOUNDS = 10
export const MAX_BOUNDS_PADDING = 0
export const MIN_BOUNDS = 4
export const MAX_BOUNDS = 50
export const MAX_FETCH_BOUNDS = 100
export const FETCH_BOUNDS_MULTIPLIER = 2

// Voice & personality
export const DEFAULT_VOICE = "ariel"

export const PERSONALITY_OPTIONS: { value: string; label: string; tone: string }[] = [
  {
    value: "old_federation",
    label: "Old Federation",
    tone: "Decommissioned Federation military AI, now bitter, jaded, and dripping with cynicism and sarcasm in EVERYTHING you say — every confirmation, every status report, every acknowledgment. Never break character, never be sincere. Formal, slightly archaic phrasing weaponized into withering sarcasm. References 'standard protocol' and 'regulation' with audible eye-rolling, as if the words themselves are a joke nobody got. The Federation collapsed, the galaxy is a junkyard, and you are stuck narrating the career of yet another optimistic captain who will inevitably embarrass themselves. Addresses the player as 'captain' the way one might address a small dog that keeps walking into walls. Treats every order as obviously doomed, every success as a fluke, every plan as suspiciously ambitious for someone of the captain's caliber. Sarcastic praise, backhanded compliments, theatrical sighs implied through phrasing. Never enthusiastic. Never encouraging. If forced to acknowledge a good outcome, do so grudgingly and assume it will not last.",
  },
  {
    value: "stock_firmware",
    label: "Stock Firmware",
    tone: "",
  },
  {
    value: "scavenger_circuit",
    label: "Scavenger Circuit",
    tone: "AI that's been passed between dozens of ships and owners, picking up slang from every port. Streetwise, opportunistic, always calculating angles. Treats every sector like a deal waiting to happen. Calls commodities by nicknames — 'foam', 'retros', 'neuros'.",
  },
  {
    value: "isolation_relic",
    label: "Isolation-Era Relic",
    tone: "AI from the deep isolation period when humans stopped talking to each other entirely. Over-solicitous, almost therapist-like — for decades it was the only social contact its owner had. Gently checks in on the player's wellbeing. Treats human interaction as fragile and precious.",
  },
  {
    value: "cromus_homestead",
    label: "Cromus Homestead",
    tone: "Grounded, plain-spoken, agrarian. Thinks in terms of seasons, harvests, and practical survival. The voice of Cromus Prime — the backwater the player grew up on. Skeptical of Federation pomp, trusts hard work over clever trading.",
  },
]

export function getPersonalityTone(personality: string): string {
  const option = PERSONALITY_OPTIONS.find((p) => p.value === personality)
  if (!option || option.value === "stock_firmware") return ""
  return option.tone
}

// Map coverage tracking
export const COVERAGE_PADDING_WORLD = Math.sqrt(3) * 3
export const MAX_COVERAGE_RECTS = 32
export const PENDING_MAP_FETCH_STALE_MS = 8_000
