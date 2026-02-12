"use client";

import React, { useEffect, useMemo, useState } from "react";
import { reduce } from "../lib/game/engine";
import { createInitialState } from "../lib/game/setup";
import type {
  AttackDeclared,
  DefenseDeclared,
  Difficulty,
  Hand,
  MatchState,
  Player,
} from "../lib/game/types";

function itemKo(x: any) {
  if (x === "SWORD") return "검";
  if (x === "TWIN") return "쌍검";
  if (x === "SHIELD") return "방패";
  if (x === "BARE") return "맨손";
  if (x === "PASS") return "패스";
  return String(x);
}
function handKo(h: Hand) {
  return h === "L" ? "왼손" : "오른손";
}

function getPlayer(s: MatchState, id: string | null | undefined) {
  if (!id) return null;
  return s.players.find((p) => p.id === id) ?? null;
}

function shieldKey(id: string, hand: Hand) {
  return `${id}:${hand}`;
}

export default function GameUI() {
  const [state, dispatch] = React.useReducer(reduce as any, undefined, () =>
    createInitialState()
  );

  const me = useMemo(
    () => state.players.find((p: Player) => p.isHuman)!,
    [state.players]
  );

  const attacker = getPlayer(state, state.currentAttackerId);
  const target = getPlayer(state, state.currentTargetId);

  const inChallenge =
    state.phase === "CHALLENGE_ATTACK" || state.phase === "CHALLENGE_DEFENSE";

  const actor =
    state.lastDeclaration &&
    state.players.find((p) => p.id === state.lastDeclaration!.actorId);

  const canChallenge =
    inChallenge && !!actor && actor.id !== me.id && actor.team !== me.team;

  const isMyAttackTurn =
    state.phase === "ATTACK_DECLARE" && attacker?.id === me.id;

  const isMyDefenseTurn =
    state.phase === "DEFENSE_DECLARE" && target?.id === me.id;

  // ---- controls state ----
  const [atkTargetId, setAtkTargetId] = useState<string>("");
  const [atkHand, setAtkHand] = useState<Hand>("L");
  const [atkDeclared, setAtkDeclared] = useState<AttackDeclared>("SWORD");

  const [defHand, setDefHand] = useState<Hand>("L");
  const [defDeclared, setDefDeclared] = useState<DefenseDeclared>("SHIELD");

  // 공격 타겟 기본값(내 턴일 때)
  useEffect(() => {
    if (!isMyAttackTurn) return;
    const enemies = state.players.filter((p) => p.alive && p.team !== me.team);
    if (enemies.length === 0) return;
    if (!atkTargetId || !enemies.some((e) => e.id === atkTargetId)) {
      setAtkTargetId(enemies[0].id);
    }
  }, [isMyAttackTurn, state.players, me.team, atkTargetId]);

  // ---- AI auto step ----
  useEffect(() => {
    if (state.phase === "GAME_OVER" || state.phase === "SETUP") return;

    // 사람 입력 단계면 자동 진행 X
    if (isMyAttackTurn || isMyDefenseTurn || inChallenge) return;

    const t = setTimeout(() => {
      dispatch({ type: "AI_STEP" } as any);
    }, 220);

    return () => clearTimeout(t);
  }, [state.phase, isMyAttackTurn, isMyDefenseTurn, inChallenge]);

  const verita = useMemo(
    () => state.players.filter((p) => p.team === "VERITA"),
    [state.players]
  );
  const falso = useMemo(
    () => state.players.filter((p) => p.team === "FALSO"),
    [state.players]
  );

  const aliveCount = useMemo(() => {
    const v = verita.filter((p) => p.alive).length;
    const f = falso.filter((p) => p.alive).length;
    return { v, f };
  }, [verita, falso]);

  function tagsFor(p: Player) {
    const tags: string[] = [];
    if (p.isHuman) tags.push("YOU");
    // ✅ 리더는 비공개: 표시 금지 (LEADER 태그 없음)
    if (
      p.id === state.currentAttackerId &&
      state.phase !== "SETUP" &&
      state.phase !== "GAME_OVER"
    )
      tags.push("TURN");
    if (!p.alive) tags.push("DEAD");
    return tags;
  }

  function renderHands(p: Player) {
    // 내 손패만 공개(싱글플레이 기준). AI는 ?? 유지.
    const show = p.isHuman;

    const left = show ? itemKo(p.left) : "??";
    const right = show ? itemKo(p.right) : "??";

    // 방패 내구도: 관측된 정보로 표시(내 것은 항상 표시, AI는 기록이 있으면 표시)
    const dl = state.shieldDurability[`${p.id}:L`] ;
    const dr = state.shieldDurability[`${p.id}:R`];

    const dlText = `${(dl ?? 3)}/3`;
    const drText = `${dr ?? 3}/3` ;

    return (
      <div className="pMeta">
        L: {left} <span style={{ opacity: 0.6 }}>({dlText})</span> · R: {right}{" "}
        <span style={{ opacity: 0.6 }}>({drText})</span>
      </div>
    );
  }

  function DeclarationCard() {
    if (!state.lastDeclaration) return <div className="pMeta">—</div>;
    const a = getPlayer(state, state.lastDeclaration.actorId)!;

    if (state.lastDeclaration.kind === "ATTACK") {
      const t = getPlayer(state, (state.lastDeclaration as any).targetId)!;
      return (
        <div className="pMeta">
          ⚔️ <strong>{a.name}</strong> → <strong>{t.name}</strong> :{" "}
          {handKo(state.lastDeclaration.hand)}{" "}
          <strong>{itemKo((state.lastDeclaration as any).declared)}</strong> 선언
        </div>
      );
    }

    return (
      <div className="pMeta">
        🛡️ <strong>{a.name}</strong> : {handKo(state.lastDeclaration.hand)}{" "}
        <strong>{itemKo((state.lastDeclaration as any).declared)}</strong> 선언
      </div>
    );
  }

  function PlayerRow({ pl }: { pl: Player }) {
    const tags = tagsFor(pl);
    return (
      <div key={pl.id} className={`playerRow ${pl.alive ? "" : "dead"}`}>
        <div className="playerMain">
          <div style={{ minWidth: 0 }}>
            <div className="pName">{pl.isHuman ? "YOU" : pl.name}</div>
            {renderHands(pl)}
          </div>
        </div>
        <div className="pTags">
          {tags.includes("YOU") && <div className="pill human"></div>}
          {tags.includes("TURN") && <div className="pill turn">TURN</div>}
          {tags.includes("DEAD") && <div className="pill">DEAD</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      {/* 1) TOP BAR */}
      <div className="topbar">
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>검과 방패</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
            {state.phase === "GAME_OVER"
              ? `게임 종료 — 승리: ${state.winnerTeam}`
              : `Round ${state.round} · 선공 ${state.roundStartTeam}`}
          </div>
        </div>

        <div className="badgeRow">
          <div className="badge">
            Round <strong>{state.round}</strong>
          </div>
          <div className="badge">
            선공 <strong>{state.roundStartTeam}</strong>
          </div>
          <div className="badge">
            현재 턴{" "}
            <strong>{attacker ? `${attacker.name} (${attacker.team})` : "—"}</strong>
          </div>
          <div className="badge">
            Phase <strong>{state.phase}</strong>
          </div>
          <div className="badge">
            생존 <strong>V {aliveCount.v}</strong> / <strong>F {aliveCount.f}</strong>
          </div>
        </div>
      </div>

      {/* 2) STATUS (맨 왼쪽 패널을 "상단 한 줄"로 올림) */}
      <div className="statusRow">
        <div className="statusCard">
          <div className="statusTitle">상태</div>
          <div className="statusBody">
            <div className="kv">
              <span>Round</span>
              <strong>{state.round}</strong>
            </div>
            <div className="kv">
              <span>선공</span>
              <strong>{state.roundStartTeam}</strong>
            </div>
            <div className="kv">
              <span>현재 턴</span>
              <strong>{attacker ? attacker.name : "—"}</strong>
            </div>
            <div className="kv">
              <span>Phase</span>
              <strong>{state.phase}</strong>
            </div>
            <div className="kv">
              <span>생존</span>
              <strong>
                V {aliveCount.v} / F {aliveCount.f}
              </strong>
            </div>
          </div>
        </div>

        <div className="statusCard">
          <div className="statusTitle">내 정보</div>
          <div className="statusBody">
            <div className="kv">
              <span>팀</span>
              <strong>{me.team}</strong>
            </div>
            <div className="kv">
              <span>왼손</span>
              <strong>{itemKo(me.left)}</strong>
            </div>
            <div className="kv">
              <span>오른손</span>
              <strong>{itemKo(me.right)}</strong>
            </div>
            <div className="kv">
              <span>난이도</span>
              <strong>{state.difficulty}</strong>
            </div>
          </div>
        </div>

        <div className="statusCard">
          <div className="statusTitle">현재 선언</div>
          <div className="statusBody">
            <DeclarationCard />
          </div>
        </div>
      </div>

      {/* 3) MAIN GRID: VERITA / FALSO / ACTIONS */}
      <div className="mainGrid">
        <div className="teamCard">
          <div className="teamHead">
            <div>
              <div className="teamTitle">VERITA</div>
            </div>
            <div className="teamSub">Alive {aliveCount.v}</div>
          </div>
          <div className="playerList">
            {verita.map((pl) => (
              <PlayerRow key={pl.id} pl={pl} />
            ))}
          </div>
        </div>

        <div className="teamCard">
          <div className="teamHead">
            <div>
              <div className="teamTitle">FALSO</div>
            </div>
            <div className="teamSub">Alive {aliveCount.f}</div>
          </div>
          <div className="playerList">
            {falso.map((pl) => (
              <PlayerRow key={pl.id} pl={pl} />
            ))}
          </div>
        </div>

        <div className="side">
          <div className="sideHead">Actions</div>
          <div className="sideBody">
            {/* Difficulty */}
            <div className="row">
              <label>난이도</label>
              <select
                value={state.difficulty}
                onChange={(e) =>
                  dispatch({
                    type: "SET_DIFFICULTY",
                    difficulty: e.target.value as Difficulty,
                  } as any)
                }
              >
                <option value="EASY">쉬움</option>
                <option value="NORMAL">보통</option>
                <option value="HARD">어려움</option>
              </select>
            </div>

            {state.phase === "SETUP" && (
              <div className="row">
                <button onClick={() => dispatch({ type: "START_GAME" } as any)}>
                  게임 시작
                </button>
              </div>
            )}

            <hr className="hr" />

            {/* ATTACK (human) */}
            {isMyAttackTurn && (
              <>
                <div className="row">
                  <label>공격 대상</label>
                  <select
                    value={atkTargetId}
                    onChange={(e) => setAtkTargetId(e.target.value)}
                  >
                    {state.players
                      .filter((p) => p.alive && p.team !== me.team)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.team})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="row">
                  <label>손</label>
                  <select value={atkHand} onChange={(e) => setAtkHand(e.target.value as Hand)}>
                    <option value="L">왼손</option>
                    <option value="R">오른손</option>
                  </select>
                </div>

                <div className="row">
                  <label>선언</label>
                  <select
                    value={atkDeclared}
                    onChange={(e) => setAtkDeclared(e.target.value as AttackDeclared)}
                  >
                    <option value="SWORD">검</option>
                    <option value="TWIN">쌍검</option>
                  </select>
                </div>

                <div className="btnRow">
                  <button
                    onClick={() =>
                      dispatch({
                        type: "HUMAN_ATTACK_DECLARE",
                        targetId: atkTargetId,
                        hand: atkHand,
                        declared: atkDeclared,
                      } as any)
                    }
                    disabled={!atkTargetId}
                  >
                    공격 선언
                  </button>
                  <button
                    onClick={() =>
                      dispatch({
                        type: "HUMAN_ATTACK_DECLARE",
                        targetId: atkTargetId || "",
                        hand: atkHand,
                        declared: "PASS",
                      } as any)
                    }
                  >
                    패스
                  </button>
                </div>
              </>
            )}

            {/* DEFENSE (human) */}
            {isMyDefenseTurn && (
              <>
                <div className="row">
                  <label>방어 손</label>
                  <select value={defHand} onChange={(e) => setDefHand(e.target.value as Hand)}>
                    <option value="L">왼손</option>
                    <option value="R">오른손</option>
                  </select>
                </div>

                <div className="row">
                  <label>방어 선언</label>
                  <select
                    value={defDeclared}
                    onChange={(e) => setDefDeclared(e.target.value as DefenseDeclared)}
                  >
                    <option value="SHIELD">방패</option>
                    <option value="BARE">맨손</option>
                  </select>
                </div>

                <div className="btnRow">
                  <button
                    onClick={() =>
                      dispatch({
                        type: "HUMAN_DEFENSE_DECLARE",
                        hand: defHand,
                        declared: defDeclared,
                      } as any)
                    }
                  >
                    방어 선언
                  </button>
                </div>
              </>
            )}

            {/* CHALLENGE */}
            {inChallenge && state.lastDeclaration && (
              <>
                <hr className="hr" />
                <div className="row">
                  <label>의심</label>
                  <div className="btnRow">
                    {canChallenge && (
                      <button onClick={() => dispatch({ type: "HUMAN_CHALLENGE" } as any)}>
                        의심
                      </button>
                    )}
                    <button onClick={() => dispatch({ type: "CHALLENGE_PASS" } as any)}>
                      넘기기
                    </button>
                  </div>

                  {!canChallenge && actor && actor.team === me.team && (
                    <div className="pMeta" style={{ marginTop: 6 }}>
                      같은 팀은 의심할 수 없음 (넘기기만 가능)
                    </div>
                  )}
                </div>
              </>
            )}

            {/* GAME OVER */}
            {state.phase === "GAME_OVER" && (
              <>
                <hr className="hr" />
                <div className="row">
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    게임 종료 — 승리: {state.winnerTeam}
                  </div>
                  <button onClick={() => window.location.reload()}>새로 시작</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4) LOG (아래 전체 영역) */}
      <div className="logPanel">
        <div className="logHead">
          <div>LOG</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            최근 {Math.min(200, state.log.length)}줄
          </div>
        </div>
        <div className="log">
          {state.log.slice(-200).map((l: string, i: number) => (
            <div key={i} className="logLine">
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}