import { AttackDeclared, DefenseDeclared, Hand, MatchState, Team, Declaration, Difficulty } from "./types";

function p(s: MatchState, id: string) {
  const x = s.players.find((z) => z.id === id);
  if (!x) throw new Error("player not found");
  return x;
}

function enemyAliveIds(s: MatchState, team: Team) {
  return s.players.filter((x) => x.alive && x.team !== team).map((x) => x.id);
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randHand(): Hand {
  return Math.random() < 0.5 ? "L" : "R";
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function scaleByDifficulty(d: Difficulty) {
  switch (d) {
    case "EASY":
      return { aggression: 0.85, bluff: 0.70, challenge: 0.55, caution: 1.10 };
    case "HARD":
      return { aggression: 1.10, bluff: 1.05, challenge: 1.35, caution: 0.90 };
    default:
      return { aggression: 1.00, bluff: 1.00, challenge: 1.00, caution: 1.00 };
  }
}

export function aiChooseAttack(
  s: MatchState,
  attackerId: string,
  difficulty: Difficulty
):
  | { pass: true }
  | { pass: false; targetId: string; hand: Hand; declared: AttackDeclared } {
  const a = p(s, attackerId);
  const enemies = enemyAliveIds(s, a.team);
  if (enemies.length === 0) return { pass: true };

  const k = scaleByDifficulty(difficulty);

  const aggression = clamp01(a.ai.aggression * k.aggression);
  const bluffRate = clamp01(a.ai.bluffRate * k.bluff);
  const caution = clamp01(a.ai.caution * k.caution);

  const passChance = 0.30 * (1 - aggression) * (0.7 + 0.6 * caution);
  if (Math.random() < passChance) return { pass: true };

  const targetId = pick(enemies);
  const hand = randHand();

  const twinBias = difficulty === "HARD" ? 0.35 : difficulty === "EASY" ? 0.20 : 0.30;
  const declared: AttackDeclared = Math.random() < (1 - twinBias) ? "SWORD" : "TWIN";

  const bluff = Math.random() < bluffRate;
  const finalDeclared: AttackDeclared = bluff ? (declared === "SWORD" ? "TWIN" : "SWORD") : declared;

  return { pass: false, targetId, hand, declared: finalDeclared };
}

export function aiChooseDefense(
  s: MatchState,
  defenderId: string,
  difficulty: Difficulty
): { hand: Hand; declared: DefenseDeclared } {
  const d = p(s, defenderId);
  const k = scaleByDifficulty(difficulty);

  const bluffRate = clamp01(d.ai.bluffRate * k.bluff);
  const caution = clamp01(d.ai.caution * k.caution);

  const basePreferShield =
    difficulty === "HARD" ? 0.88 : difficulty === "EASY" ? 0.68 : 0.78;

  const preferShield = clamp01(basePreferShield + 0.10 * caution);
  const declared: DefenseDeclared = Math.random() < preferShield ? "SHIELD" : "BARE";

  const bluffMult = difficulty === "EASY" ? 0.22 : difficulty === "HARD" ? 0.40 : 0.32;
  const bluff = Math.random() < (bluffRate * bluffMult);
  const finalDeclared: DefenseDeclared = bluff ? (declared === "SHIELD" ? "BARE" : "SHIELD") : declared;

  return { hand: randHand(), declared: finalDeclared };
}

export function aiShouldChallenge(
  s: MatchState,
  byId: string,
  dec: Declaration,
  difficulty: Difficulty
): boolean {
  const me = p(s, byId);
  if (!me.alive) return false;

  const k = scaleByDifficulty(difficulty);

  let rate = clamp01(me.ai.challengeRate * k.challenge);

  const caution = clamp01(me.ai.caution * k.caution);
  rate *= (1 - 0.65 * caution);

  if (me.isLeader) rate *= 0.25;

  if (dec.kind === "ATTACK" && dec.declared === "TWIN") rate += (difficulty === "HARD" ? 0.020 : 0.012);
  if (dec.kind === "DEFENSE" && dec.declared === "SHIELD") rate += (difficulty === "HARD" ? 0.012 : 0.008);

  const actor = p(s, dec.actorId);
  if (actor.team === me.team) rate *= 0.55;

  rate = Math.min(rate, difficulty === "HARD" ? 0.18 : difficulty === "EASY" ? 0.10 : 0.13);

  return Math.random() < rate;
}