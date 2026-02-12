export type Team = "VERITA" | "FALSO";
export type Hand = "L" | "R";
export type Item = "SWORD" | "TWIN" | "SHIELD" | "BARE";

export type Difficulty = "EASY" | "NORMAL" | "HARD";

export type Phase =
  | "SETUP"
  | "ATTACK_DECLARE"
  | "CHALLENGE_ATTACK"
  | "DEFENSE_DECLARE"
  | "CHALLENGE_DEFENSE"
  | "RESOLVE"
  | "GAME_OVER";

export type AttackDeclared = "SWORD" | "TWIN";
export type DefenseDeclared = "SHIELD" | "BARE";

export type AttackDeclaration = {
  kind: "ATTACK";
  actorId: string;
  targetId: string;
  hand: Hand;
  declared: AttackDeclared;
};

export type DefenseDeclaration = {
  kind: "DEFENSE";
  actorId: string;
  hand: Hand;
  declared: DefenseDeclared;
};

export type Declaration = AttackDeclaration | DefenseDeclaration;

export type Player = {
  id: string;
  name: string;
  isHuman: boolean;
  team: Team;
  alive: boolean;

  left: Item;
  right: Item;

  isLeader: boolean;

  ai: {
    aggression: number;
    bluffRate: number;
    challengeRate: number;
    caution: number;
  };
};

export type MatchState = {
  difficulty: Difficulty;

  phase: Phase;

  round: number;
  roundStartTeam: Team;
  actingTeam: Team;

  players: Player[];

  attackOrder: Record<Team, string[]>;
  idx: Record<Team, number>;
  attackedThisRound: Record<Team, Set<string>>;

  currentAttackerId: string | null;
  currentTargetId: string | null;

  pendingAttack: AttackDeclaration | null;
  lastDeclaration: Declaration | null;

  shieldDurability: Record<string, number>;

  log: string[];
  winnerTeam: Team | null;
};

export type Action =
  | { type: "SET_DIFFICULTY"; difficulty: Difficulty }
  | { type: "START_GAME" }
  | {
      type: "HUMAN_ATTACK_DECLARE";
      targetId: string;
      hand: Hand;
      declared: AttackDeclared | "PASS";
    }
  | { type: "HUMAN_DEFENSE_DECLARE"; hand: Hand; declared: DefenseDeclared }
  | { type: "HUMAN_CHALLENGE" }
  | { type: "CHALLENGE_PASS" }
  | { type: "AI_STEP" };