import { Item, MatchState, Player, Team } from "./types";

function shuffle<T>(arr: T[], rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 팀당 10장: 검4 쌍검1 방패3 맨손2
const TEAM_DECK: Item[] = [
  "SWORD",
  "SWORD",
  "SWORD",
  "SWORD",
  "TWIN",
  "SHIELD",
  "SHIELD",
  "SHIELD",
  "BARE",
  "BARE",
];

function dealTwoEach(playerIds: string[]) {
  const deck = shuffle(TEAM_DECK);
  const dealt: Record<string, [Item, Item]> = {};
  for (let i = 0; i < playerIds.length; i++) {
    dealt[playerIds[i]] = [deck[i * 2], deck[i * 2 + 1]];
  }
  return dealt;
}

function mkAIProfile(i: number) {
  const base = (i % 5) / 4; // 0..1
  return {
    aggression: 0.35 + 0.35 * base,
    bluffRate: 0.20 + 0.25 * (1 - base),
    challengeRate: 0.10 + 0.12 * base,
    caution: 0.35 + 0.25 * (1 - base),
  };
}

export function createInitialState(): MatchState {
  const names = ["YOU", "AI-1", "AI-2", "AI-3", "AI-4", "AI-5", "AI-6", "AI-7", "AI-8", "AI-9"];
  const ids = names.map((_, i) => `p${i}`);

  const veritaIds = ids.slice(0, 5);
  const falsoIds = ids.slice(5);

  const leaderV = veritaIds[Math.floor(Math.random() * veritaIds.length)];
  const leaderF = falsoIds[Math.floor(Math.random() * falsoIds.length)];

  const dealV = dealTwoEach(veritaIds);
  const dealF = dealTwoEach(falsoIds);

  const players: Player[] = ids.map((id, i) => {
    const team: Team = veritaIds.includes(id) ? "VERITA" : "FALSO";
    const [a, b] = (team === "VERITA" ? dealV[id] : dealF[id])!;
    const [left, right] = Math.random() < 0.5 ? [a, b] : [b, a];

    return {
      id,
      name: names[i],
      isHuman: i === 0,
      team,
      alive: true,
      left,
      right,
      isLeader: id === leaderV || id === leaderF,
      ai: i === 0 ? { aggression: 0, bluffRate: 0, challengeRate: 0, caution: 0 } : mkAIProfile(i),
    };
  });

  const shieldDurability: Record<string,number> = {};
    for (const p of players) {
        shieldDurability[`${p.id}:L`] = 3;
        shieldDurability[`${p.id}:R`] = 3;
    }

  const orderV = shuffle(veritaIds);
  const orderF = shuffle(falsoIds);

  const roundStartTeam: Team = Math.random() < 0.5 ? "VERITA" : "FALSO";

  return {
    difficulty: 'NORMAL',

    phase: "SETUP",
    round: 1,
    roundStartTeam,
    actingTeam: roundStartTeam,
    players,
    attackOrder: { VERITA: orderV, FALSO: orderF },
    idx: { VERITA: 0, FALSO: 0 },
    attackedThisRound: { VERITA: new Set(), FALSO: new Set() },

    currentAttackerId: null,
    currentTargetId: null,
    pendingAttack: null,
    lastDeclaration: null,

    shieldDurability,

    log: [
  `Order VERITA: ${orderV
    .map(id => players.find(p => p.id === id)?.name)
    .join(", ")}`,

  `Order FALSO: ${orderF
    .map(id => players.find(p => p.id === id)?.name)
    .join(", ")}`,

  `Round 1 start team: ${roundStartTeam}`,
  `Leaders are hidden.`,
  `Difficulty: NORMAL`,
],
    winnerTeam: null,
  };
}