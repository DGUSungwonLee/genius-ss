import { Action, AttackDeclaration, Hand, MatchState, Team, Declaration } from "./types";
import { aiChooseAttack, aiChooseDefense, aiShouldChallenge } from "./ai";

function clone(s: MatchState): MatchState {
  return structuredClone(s);
}

function p(s: MatchState, id: string) {
  const x = s.players.find((z) => z.id === id);
  if (!x) throw new Error("player not found");
  return x;
}

function pname(s: MatchState, id: string) {
  return p(s, id).name;
}

function handKo(h: Hand) {
  return h === "L" ? "왼손" : "오른손";
}

function declKo(x: any) {
  if (x === "SWORD") return "검";
  if (x === "TWIN") return "쌍검";
  if (x === "SHIELD") return "방패";
  if (x === "BARE") return "맨손";
  return String(x);
}

function otherTeam(t: Team): Team {
  return t === "VERITA" ? "FALSO" : "VERITA";
}

function aliveIds(s: MatchState, team: Team) {
  return s.players.filter((x) => x.alive && x.team === team).map((x) => x.id);
}

function handKey(id: string, hand: Hand) {
  return `${id}:${hand}`;
}

function logPush(s: MatchState, msg: string) {
  s.log.push(msg);
  if (s.log.length > 600) s.log = s.log.slice(-420);
}

function attackDamageFromDeclared(declared: AttackDeclaration["declared"]) {
  return declared === "TWIN" ? 2 : 1;
}

function kill(s: MatchState, victimId: string, reason: string) {
  const v = p(s, victimId);
  if (!v.alive) return;
  v.alive = false;
  logPush(s, `💀 ${v.name} 사망 (${reason})`);

  if (v.isLeader) {
    s.winnerTeam = otherTeam(v.team);
    s.phase = "GAME_OVER";
    logPush(s, `👑 리더(${v.team}) 사망 → ${s.winnerTeam} 승리`);
  }
}

function startNewRound(s: MatchState) {
  if (s.phase === "GAME_OVER") return;

  s.round += 1;
  s.roundStartTeam = otherTeam(s.roundStartTeam);
  s.actingTeam = s.roundStartTeam;

  s.attackedThisRound = { VERITA: new Set(), FALSO: new Set() };
  s.currentAttackerId = null;
  s.currentTargetId = null;
  s.pendingAttack = null;
  s.lastDeclaration = null;

  logPush(s, `— Round ${s.round} 시작 (선공: ${s.roundStartTeam})`);

  const first = pickNextAttackerThisTeam(s, s.actingTeam);
  if (!first) {
    s.winnerTeam = otherTeam(s.actingTeam);
    s.phase = "GAME_OVER";
    logPush(s, `공격자 없음 → ${s.winnerTeam} 승리`);
    return;
  }

  s.currentAttackerId = first;
  s.phase = "ATTACK_DECLARE";
  logPush(s, `턴: ${pname(s, first)} (${s.actingTeam})`);
}

function pickNextAttackerThisTeam(s: MatchState, team: Team): string | null {
  const alive = aliveIds(s, team);
  if (alive.length === 0) return null;

  const order = s.attackOrder[team];
  const n = order.length;

  for (let step = 0; step < n; step++) {
    const idx = (s.idx[team] + step) % n;
    const id = order[idx];
    if (p(s, id).alive && !s.attackedThisRound[team].has(id)) {
      s.idx[team] = (idx + 1) % n;
      return id;
    }
  }
  return null;
}

function advanceTurnOrRound(s: MatchState) {
  if (s.phase === "GAME_OVER") return;

  const nextTeam = otherTeam(s.actingTeam);

  const nextId = pickNextAttackerThisTeam(s, nextTeam);
  if (nextId) {
    s.actingTeam = nextTeam;
    s.currentAttackerId = nextId;
    s.currentTargetId = null;
    s.pendingAttack = null;
    s.lastDeclaration = null;
    s.phase = "ATTACK_DECLARE";
    logPush(s, `턴: ${pname(s, nextId)} (${s.actingTeam})`);
    return;
  }

  const sameTeamNext = pickNextAttackerThisTeam(s, s.actingTeam);
  if (sameTeamNext) {
    s.currentAttackerId = sameTeamNext;
    s.currentTargetId = null;
    s.pendingAttack = null;
    s.lastDeclaration = null;
    s.phase = "ATTACK_DECLARE";
    logPush(s, `턴: ${pname(s, sameTeamNext)} (${s.actingTeam})`);
    return;
  }

  // 양 팀 모두 이번 라운드 공격 완료 → 다음 라운드(선공 교대)
  startNewRound(s);
}

function resolveChallenge(s: MatchState, challengerId: string) {
  const dec = s.lastDeclaration!;
  const actor = p(s, dec.actorId);

  const actual = dec.hand === "L" ? actor.left : actor.right;
  const ok = actual === dec.declared;

  logPush(s, `❓ ${pname(s, challengerId)} 의심 → ${pname(s, dec.actorId)} (${dec.kind})`);
  logPush(s, `🔎 공개: ${pname(s, dec.actorId)} ${handKo(dec.hand)} = ${declKo(actual)}`);

  if (!ok) {
    kill(s, dec.actorId, "거짓 선언 적발");
    if (s.phase === "GAME_OVER") return;
  } else {
    kill(s, challengerId, "진실 의심");
    if (s.phase === "GAME_OVER") return;
  }
}

function applyDefenseAndResolve(s: MatchState) {
  if (!s.pendingAttack || !s.currentTargetId) return;

  const atk = s.pendingAttack;
  const defenderId = s.currentTargetId;
  const defender = p(s, defenderId);

  if (!defender.alive) {
    s.phase = "RESOLVE";
    return;
  }

  const defDec = s.lastDeclaration;
  if (!defDec || defDec.kind !== "DEFENSE") return;

  const dmg = attackDamageFromDeclared(atk.declared);

  if (defDec.declared === "BARE") {
    kill(s, defenderId, "방어 실패");
    if (s.phase === "GAME_OVER") return;
    s.phase = "RESOLVE";
    return;
  }

  const key = handKey(defenderId, defDec.hand);
  const cur = s.shieldDurability[key] ?? 3;

  if (cur <= 0) {
    kill(s, defenderId, "방패 파손");
    if (s.phase === "GAME_OVER") return;
    s.phase = "RESOLVE";
    return;
  }

  const next = Math.max(0, cur - dmg);
  s.shieldDurability[key] = next;
  logPush(s, `🛡️ ${pname(s, defenderId)} ${handKo(defDec.hand)} 방패 내구도 ${next}/3 (피해 ${dmg})`);
  s.phase = "RESOLVE";
}

function transitionAfterChallenge(s: MatchState) {
  if (s.phase === "GAME_OVER") return;

  if (s.phase === "CHALLENGE_ATTACK") {
    if (s.lastDeclaration && p(s, s.lastDeclaration.actorId).alive) {
      s.pendingAttack = s.lastDeclaration as AttackDeclaration;
      s.phase = "DEFENSE_DECLARE";
      return;
    }
    s.phase = "RESOLVE";
    return;
  }

  if (s.phase === "CHALLENGE_DEFENSE") {
    applyDefenseAndResolve(s);
    return;
  }
}

export function reduce(state: MatchState, action: Action): MatchState {
  if (state.phase === "GAME_OVER") return state;

  const s = clone(state);

  switch (action.type) {
    case "SET_DIFFICULTY": {
      s.difficulty = action.difficulty;
      logPush(s, `난이도: ${action.difficulty}`);
      return s;
    }

    case "START_GAME": {
      if (s.phase !== "SETUP") return s;

      const first = pickNextAttackerThisTeam(s, s.actingTeam);
      if (!first) {
        s.winnerTeam = otherTeam(s.actingTeam);
        s.phase = "GAME_OVER";
        return s;
      }

      s.currentAttackerId = first;
      s.phase = "ATTACK_DECLARE";
      logPush(s, `— 게임 시작`);
      logPush(s, `턴: ${pname(s, first)} (${s.actingTeam})`);
      return s;
    }

    case "HUMAN_ATTACK_DECLARE": {
      if (s.phase !== "ATTACK_DECLARE") return s;
      if (!s.currentAttackerId) return s;

      const attacker = p(s, s.currentAttackerId);
      if (!attacker.isHuman || !attacker.alive) return s;

      s.attackedThisRound[s.actingTeam].add(attacker.id);

      if (action.declared === "PASS") {
        logPush(s, `⏭️ ${attacker.name} 패스`);
        s.phase = "RESOLVE";
        return s;
      }

      s.currentTargetId = action.targetId;
      s.lastDeclaration = {
        kind: "ATTACK",
        actorId: attacker.id,
        targetId: action.targetId,
        hand: action.hand,
        declared: action.declared,
      };

      logPush(
        s,
        `⚔️ ${attacker.name} → ${pname(s, action.targetId)} : ${handKo(action.hand)} ${declKo(action.declared)} 선언`
      );

      s.phase = "CHALLENGE_ATTACK";
      return s;
    }

    case "HUMAN_DEFENSE_DECLARE": {
      if (s.phase !== "DEFENSE_DECLARE") return s;
      if (!s.currentTargetId) return s;

      const defender = p(s, s.currentTargetId);
      if (!defender.isHuman || !defender.alive) return s;

      s.lastDeclaration = {
        kind: "DEFENSE",
        actorId: defender.id,
        hand: action.hand,
        declared: action.declared,
      };

      logPush(
        s,
        `🛡️ ${defender.name} : ${handKo(action.hand)} ${declKo(action.declared)} 선언`
      );

      s.phase = "CHALLENGE_DEFENSE";
      return s;
    }

    case "HUMAN_CHALLENGE": {
      if (!s.lastDeclaration) return s;

      const me = s.players.find((x) => x.isHuman)?.id;
      if (!me) return s;

      // 내 선언을 내가 의심하는 것 방지
      if (s.lastDeclaration.actorId === me) return s;

      if (p(s, me).team === p(s, s.lastDeclaration.actorId).team) return s;

      resolveChallenge(s, me);
      if (s.phase === "GAME_OVER") return s;

      transitionAfterChallenge(s);
      return s;
    }

    case "CHALLENGE_PASS": {
      if (!s.lastDeclaration) return s;

      logPush(s, "🟢 의심 없음");
      transitionAfterChallenge(s);
      return s;
    }

    case "AI_STEP": {
      // AI 공격 선언
      if (s.phase === "ATTACK_DECLARE") {
        const id = s.currentAttackerId;
        if (!id) return s;

        const attacker = p(s, id);
        if (attacker.isHuman || !attacker.alive) return s;

        s.attackedThisRound[s.actingTeam].add(attacker.id);

        const choice = aiChooseAttack(s, id, s.difficulty);
        if (choice.pass) {
          logPush(s, `⏭️ ${attacker.name} 패스`);
          s.phase = "RESOLVE";
          return s;
        }

        s.currentTargetId = choice.targetId;
        s.lastDeclaration = {
          kind: "ATTACK",
          actorId: id,
          targetId: choice.targetId,
          hand: choice.hand,
          declared: choice.declared,
        };

        logPush(
          s,
          `⚔️ ${attacker.name} → ${pname(s, choice.targetId)} : ${handKo(choice.hand)} ${declKo(choice.declared)} 선언`
        );

        s.phase = "CHALLENGE_ATTACK";
        return s;
      }

      // AI 방어 선언
      if (s.phase === "DEFENSE_DECLARE") {
        const targetId = s.currentTargetId;
        if (!targetId) return s;

        const defender = p(s, targetId);
        if (defender.isHuman || !defender.alive) return s;

        const choice = aiChooseDefense(s, targetId, s.difficulty);

        s.lastDeclaration = {
          kind: "DEFENSE",
          actorId: targetId,
          hand: choice.hand,
          declared: choice.declared,
        };

        logPush(
          s,
          `🛡️ ${defender.name} : ${handKo(choice.hand)} ${declKo(choice.declared)} 선언`
        );

        s.phase = "CHALLENGE_DEFENSE";
        return s;
      }

      // 의심 단계: AI들이 자동으로 한 번 판단 (사람은 버튼으로 의심/넘기기)
      if (s.phase === "CHALLENGE_ATTACK" || s.phase === "CHALLENGE_DEFENSE") {
        if (!s.lastDeclaration) return s;

        // 사람(생존)이 있으면 멈추고 기다림
        const humanAlive = s.players.some((x) => x.isHuman && x.alive);
        if (humanAlive) return s;

        const actorTeam = p(s, s.lastDeclaration!.actorId).team;
        const candidates = s.players.filter(
          (x) => x.alive && !x.isHuman && x.id !== s.lastDeclaration!.actorId
        );

        for (const c of candidates) {
          if (aiShouldChallenge(s, c.id, s.lastDeclaration as Declaration, s.difficulty)) {
            resolveChallenge(s, c.id);
            if (s.winnerTeam) return s;

            transitionAfterChallenge(s);
            return s;
          }
        }

        // 아무도 의심 안 하면 자동 넘기기
        logPush(s, "🟢 의심 없음");
        transitionAfterChallenge(s);
        return s;
      }

      // 다음 턴으로
      if (s.phase === "RESOLVE") {
        advanceTurnOrRound(s);
        return s;
      }

      return s;
    }

    default:
      return s;
  }
}