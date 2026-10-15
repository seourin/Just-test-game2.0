import React, { useState } from 'react';
import { LinearCongruentialGenerator, LcgStepResult } from '../lib/lcg';
import { sound } from '../lib/sound';
import { Swords, Shield, Target, Flame, RotateCcw, Play, Zap, Sliders, Calculator, Check, X } from 'lucide-react';

interface CombatLog {
  id: string;
  turn: number;
  attacker: 'HERO' | 'BOSS';
  isHit: boolean;
  isCrit: boolean;
  damage: number;
  effectiveHitRate: number;
  critRateUsed: number;
  hitRoll: LcgStepResult;
  critRoll?: LcgStepResult;
  description: string;
}

interface BattleSimulatorProps {
  lcg: LinearCongruentialGenerator;
  onLcgStep: () => void;
}

export const BattleSimulator: React.FC<BattleSimulatorProps> = ({ lcg, onLcgStep }) => {
  // Combatant Health
  const [heroHp, setHeroHp] = useState<number>(1000);
  const [bossHp, setBossHp] = useState<number>(3000);
  const maxHeroHp = 1000;
  const maxBossHp = 3000;

  // Adjustable Probability & Combat Parameters
  const [accuracy, setAccuracy] = useState<number>(0.90); // 90%
  const [bossEvade, setBossEvade] = useState<number>(0.15); // 15%
  const [critRate, setCritRate] = useState<number>(0.35); // 35%
  const [critMultiplier, setCritMultiplier] = useState<number>(2.2); // 220%
  const [bossDefenseReduction, setBossDefenseReduction] = useState<number>(0.10); // 10%

  // Effective Hit Chance formula: Accuracy * (1 - Evade)
  const effectiveHitChance = Math.max(0, Math.min(1.0, accuracy * (1 - bossEvade)));

  const [combatLogs, setCombatLogs] = useState<CombatLog[]>([]);
  const [turnCount, setTurnCount] = useState<number>(0);

  // Statistics
  const totalAttacks = combatLogs.filter((l) => l.attacker === 'HERO').length;
  const totalHits = combatLogs.filter((l) => l.attacker === 'HERO' && l.isHit).length;
  const totalCrits = combatLogs.filter((l) => l.attacker === 'HERO' && l.isCrit).length;

  // Peek next 2 rolls to demonstrate RNG Manipulation & Peek
  const peeked = lcg.peek(2);
  const nextIsHit = peeked.length >= 1 ? peeked[0].normalized < effectiveHitChance : false;
  const nextIsCrit = peeked.length >= 2 ? peeked[1].normalized < critRate : false;

  const resetBattle = () => {
    sound.playClick();
    setHeroHp(1000);
    setBossHp(3000);
    setCombatLogs([]);
    setTurnCount(0);
  };

  const burnSeed = () => {
    sound.playRoll();
    lcg.next();
    onLcgStep();
  };

  const applyPreset = (presetName: 'balance' | 'assassin' | 'evasive' | 'sure_crit') => {
    sound.playClick();
    if (presetName === 'balance') {
      setAccuracy(0.90);
      setBossEvade(0.15);
      setCritRate(0.35);
      setCritMultiplier(2.2);
      setBossDefenseReduction(0.10);
    } else if (presetName === 'assassin') {
      setAccuracy(0.95);
      setBossEvade(0.10);
      setCritRate(0.70);
      setCritMultiplier(2.8);
      setBossDefenseReduction(0.05);
    } else if (presetName === 'evasive') {
      setAccuracy(0.80);
      setBossEvade(0.50);
      setCritRate(0.20);
      setCritMultiplier(2.0);
      setBossDefenseReduction(0.25);
    } else if (presetName === 'sure_crit') {
      setAccuracy(1.00);
      setBossEvade(0.00);
      setCritRate(1.00);
      setCritMultiplier(3.0);
      setBossDefenseReduction(0.00);
    }
  };

  const executeTurn = () => {
    if (heroHp <= 0 || bossHp <= 0) return;

    const currentTurn = turnCount + 1;
    setTurnCount(currentTurn);

    // 1. Hero Attacks Boss
    // Step 1: Hit Roll
    const hitStep = lcg.next();
    const isHit = hitStep.normalized < effectiveHitChance;

    let isCrit = false;
    let critStep: LcgStepResult | undefined = undefined;
    let heroDamage = 0;

    if (isHit) {
      // Step 2: Crit Roll
      critStep = lcg.next();
      isCrit = critStep.normalized < critRate;

      const baseDmg = 120 + Math.floor(hitStep.normalized * 40);
      const rawDamage = isCrit ? Math.floor(baseDmg * critMultiplier) : baseDmg;
      heroDamage = Math.max(1, Math.floor(rawDamage * (1 - bossDefenseReduction)));

      if (isCrit) {
        sound.playCrit();
      } else {
        sound.playClick();
      }
    } else {
      sound.playEvade();
    }

    const newBossHp = Math.max(0, bossHp - heroDamage);
    setBossHp(newBossHp);

    const heroLog: CombatLog = {
      id: `${currentTurn}_hero`,
      turn: currentTurn,
      attacker: 'HERO',
      isHit,
      isCrit,
      damage: heroDamage,
      effectiveHitRate: effectiveHitChance,
      critRateUsed: critRate,
      hitRoll: hitStep,
      critRoll: critStep,
      description: isHit
        ? isCrit
          ? `치명타 작렬! (${(critMultiplier * 100).toFixed(0)}% 배율) test에게 ${heroDamage}의 막대한 피해!`
          : `명중 성공! test에게 ${heroDamage} 피해!`
        : `공격이 빗나갔거나 test가 회피했습니다!`,
    };

    // 2. Boss counter-attack if alive
    const logsToAdd: CombatLog[] = [heroLog];

    if (newBossHp > 0) {
      const bossHitStep = lcg.next();
      const bossHits = bossHitStep.normalized < 0.85;
      const bossDamage = bossHits ? 60 + Math.floor(bossHitStep.normalized * 30) : 0;
      const newHeroHp = Math.max(0, heroHp - bossDamage);
      setHeroHp(newHeroHp);

      logsToAdd.unshift({
        id: `${currentTurn}_boss`,
        turn: currentTurn,
        attacker: 'BOSS',
        isHit: bossHits,
        isCrit: false,
        damage: bossDamage,
        effectiveHitRate: 0.85,
        critRateUsed: 0,
        hitRoll: bossHitStep,
        description: bossHits
          ? `test(보스)의 반격! test(용사)에게 ${bossDamage} 피해!`
          : `test(용사)가 test(보스)의 반격을 방어했습니다!`,
      });
    } else {
      sound.playEpic();
    }

    setCombatLogs((prev) => [...logsToAdd, ...prev].slice(0, 100));
    onLcgStep();
  };

  const handleSimulate10Turns = () => {
    for (let i = 0; i < 10; i++) {
      executeTurn();
    }
  };

  const latestHeroLog = combatLogs.find((l) => l.attacker === 'HERO');

  return (
    <div className="space-y-6">
      {/* Visual Arena Banner */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
        <div className="h-44 sm:h-52 relative w-full overflow-hidden bg-slate-950">
          <img
            src="/src/assets/images/game_battle_arena_1791431125173.jpg"
            alt="결투 아레나"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center brightness-90 filter"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs text-rose-400 font-mono tracking-wider mb-1">
                COMBAT PROBABILITY & FORMULA ENGINE
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                전투 확률 및 수식 시뮬레이터 (Battle PRNG)
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>실시간 확률 매개변수 조정</span>
                <span aria-hidden="true">·</span>
                <span>명중/치명타/피해량 계산식 실시간 검증</span>
                <span aria-hidden="true">·</span>
                <span>스피드런 시드 조작(Burn Seed)</span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg text-right shrink-0">
              <div className="text-xs text-slate-400">진행 턴수</div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                Turn {turnCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                최종 실효 명중률: <span className="text-cyan-300 font-mono">{(effectiveHitChance * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Probability Adjuster Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-white">
              전투 확률 매개변수 조절 (Combat Parameters Tuning)
            </h3>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 mr-1">프리셋:</span>
            <button
              onClick={() => applyPreset('balance')}
              className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
            >
              표준 밸런스
            </button>
            <button
              onClick={() => applyPreset('assassin')}
              className="px-2.5 py-1 rounded bg-slate-950 border border-amber-900/60 hover:border-amber-700 text-amber-300 transition-colors"
            >
              암살자 극크리 (70%)
            </button>
            <button
              onClick={() => applyPreset('evasive')}
              className="px-2.5 py-1 rounded bg-slate-950 border border-cyan-900/60 hover:border-cyan-700 text-cyan-300 transition-colors"
            >
              닌자 고회피 (50%)
            </button>
            <button
              onClick={() => applyPreset('sure_crit')}
              className="px-2.5 py-1 rounded bg-slate-950 border border-rose-900/60 hover:border-rose-700 text-rose-300 transition-colors"
            >
              확정 치명타 (100%)
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Accuracy Slider */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-cyan-400 font-semibold">test(용사) 명중률</span>
              <span className="font-mono text-white tabular-nums">{(accuracy * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={accuracy * 100}
              onChange={(e) => setAccuracy(Number(e.target.value) / 100)}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">공격의 기본 적중 확률</div>
          </div>

          {/* 2. Boss Evade Slider */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-rose-400 font-semibold">test(보스) 회피 확률</span>
              <span className="font-mono text-white tabular-nums">{(bossEvade * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={bossEvade * 100}
              onChange={(e) => setBossEvade(Number(e.target.value) / 100)}
              className="w-full accent-rose-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">적중 공격을 회피할 확률</div>
          </div>

          {/* 3. Crit Rate Slider */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-amber-400 font-semibold">치명타 확률</span>
              <span className="font-mono text-white tabular-nums">{(critRate * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={critRate * 100}
              onChange={(e) => setCritRate(Number(e.target.value) / 100)}
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">명중 시 치명타 발동 확률</div>
          </div>

          {/* 4. Crit Multiplier Slider */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-amber-300 font-semibold">치명타 피해 배율</span>
              <span className="font-mono text-white tabular-nums">{(critMultiplier * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="150"
              max="350"
              step="5"
              value={critMultiplier * 100}
              onChange={(e) => setCritMultiplier(Number(e.target.value) / 100)}
              className="w-full accent-amber-300 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">치명타 시 피해 증가율</div>
          </div>

          {/* 5. Boss Defense Slider */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-semibold">test(보스) 방어 감소율</span>
              <span className="font-mono text-white tabular-nums">{(bossDefenseReduction * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={bossDefenseReduction * 100}
              onChange={(e) => setBossDefenseReduction(Number(e.target.value) / 100)}
              className="w-full accent-slate-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">피해량 방어 감쇄 비율</div>
          </div>
        </div>
      </div>

      {/* Main Battle Stage & Real-time Math Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            {/* Health Bars & Combatants */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-800">
              {/* Hero Panel */}
              <div className="bg-slate-950/80 border border-cyan-900/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛡️</span>
                    <div>
                      <h4 className="text-sm font-bold text-white">test</h4>
                      <div className="text-[11px] text-cyan-400 font-mono">PLAYER HERO</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
                      {heroHp} / {maxHeroHp} HP
                    </div>
                  </div>
                </div>

                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${(heroHp / maxHeroHp) * 100}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div>명중률: {(accuracy * 100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div>치명타: {(critRate * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>

              {/* Boss Panel */}
              <div className="bg-slate-950/80 border border-rose-900/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🐲</span>
                    <div>
                      <h4 className="text-sm font-bold text-white">test</h4>
                      <div className="text-[11px] text-rose-400 font-mono">DUNGEON BOSS</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-rose-300 tabular-nums">
                      {bossHp} / {maxBossHp} HP
                    </div>
                  </div>
                </div>

                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${(bossHp / maxBossHp) * 100}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div>회피율: {(bossEvade * 100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div>방어감소: {(bossDefenseReduction * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Speedrun RNG Manipulation Deck */}
            <div className="my-5 p-3.5 bg-slate-950 border border-amber-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  스피드런 난수 조작 예보 (Seed Oracle)
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  현재 LCG 시드 기준 다음 2개 주사위
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-400 text-[11px]">명중 판정 주사위</div>
                  <div className={`font-mono font-bold mt-0.5 ${nextIsHit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {nextIsHit ? '명중 확정' : '빗나감/회피'}
                    <span className="text-[10px] text-slate-500 ml-1">
                      (U={peeked[0]?.normalized.toFixed(3)} &lt; {effectiveHitChance.toFixed(3)})
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-400 text-[11px]">치명타 판정 주사위</div>
                  <div className={`font-mono font-bold mt-0.5 ${nextIsCrit ? 'text-amber-400' : 'text-slate-400'}`}>
                    {nextIsCrit ? '치명타 발동 확정!' : '일반 타격'}
                    <span className="text-[10px] text-slate-500 ml-1">
                      (U={peeked[1]?.normalized.toFixed(3)} &lt; {critRate.toFixed(3)})
                    </span>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 flex items-center">
                  <button
                    onClick={burnSeed}
                    className="w-full py-2 px-3 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/80 text-amber-200 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                    title="공격하지 않고 시드를 1단계 소비하여 다음 유리한 난수를 기다립니다"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>난수 1단계 소모 (Burn Seed)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Combat Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={executeTurn}
                disabled={heroHp <= 0 || bossHp <= 0}
                className="flex-1 py-3 px-5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Swords className="w-4 h-4" />
                <span>1턴 공격 실행 (2 LCG Steps)</span>
              </button>

              <button
                onClick={handleSimulate10Turns}
                disabled={heroHp <= 0 || bossHp <= 0}
                className="py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>10턴 연속 공격</span>
              </button>

              <button
                onClick={resetBattle}
                className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="전투 리셋"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mathematical Formulas & Live Calculation Inspector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              전투 확률 수학 공식 및 직전 턴 상세 검증 (Formula Inspector)
            </h3>

            {/* General Formula Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                <div className="text-slate-400 font-semibold mb-1">1. 실효 명중률(Effective Hit Rate) 공식</div>
                <div className="font-mono text-cyan-300 text-[11px] mb-1">
                  P_hit = Accuracy × (1 - BossEvade)
                </div>
                <div className="text-slate-400 text-[11px] font-mono">
                  = {(accuracy * 100).toFixed(0)}% × (1 - {(bossEvade * 100).toFixed(0)}%) = <strong className="text-white">{(effectiveHitChance * 100).toFixed(2)}%</strong>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                <div className="text-slate-400 font-semibold mb-1">2. 최종 피해량(Damage) 계산 공식</div>
                <div className="font-mono text-amber-300 text-[11px] mb-1">
                  Damage = (BaseDmg + Δ) × CritMult × (1 - BossDef)
                </div>
                <div className="text-slate-400 text-[11px]">
                  치명타 발동 시 {critMultiplier}배 증폭 후 {(bossDefenseReduction * 100).toFixed(0)}% 방어력 감쇄
                </div>
              </div>
            </div>

            {/* Step-by-Step Breakdown of Latest Turn */}
            {latestHeroLog ? (
              <div className="bg-slate-950 border border-slate-800/90 rounded-lg p-3.5 font-mono text-xs text-slate-300 space-y-2.5">
                <div className="flex justify-between items-center text-slate-400 text-[11px] pb-1.5 border-b border-slate-800">
                  <span>직전 Turn #{latestHeroLog.turn} 판정 결과</span>
                  <span className={latestHeroLog.isHit ? (latestHeroLog.isCrit ? 'text-amber-400 font-bold' : 'text-cyan-400 font-bold') : 'text-rose-400 font-bold'}>
                    {latestHeroLog.isHit ? (latestHeroLog.isCrit ? '치명타 적중' : '일반 적중') : '회피됨 / 빗나감'}
                  </span>
                </div>

                {/* Hit Roll Math */}
                <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-400 font-semibold">
                    <span>[주사위 1] 명중 판정 (Hit Roll)</span>
                    <span className={latestHeroLog.isHit ? 'text-emerald-400 flex items-center gap-1' : 'text-rose-400 flex items-center gap-1'}>
                      {latestHeroLog.isHit ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {latestHeroLog.isHit ? '명중 성공' : '회피 실패'}
                    </span>
                  </div>
                  <div className="text-slate-400 break-all text-[10px]">
                    LCG 수식: {latestHeroLog.hitRoll.formulaStr}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-slate-300">
                    <span>난수 U_hit = <strong className="text-white">{latestHeroLog.hitRoll.normalized.toFixed(6)}</strong></span>
                    <span>기준값 P_hit = <strong>{latestHeroLog.effectiveHitRate.toFixed(4)}</strong></span>
                    <span className="text-slate-400">
                      ({latestHeroLog.hitRoll.normalized.toFixed(4)} &lt; {latestHeroLog.effectiveHitRate.toFixed(4)} → {latestHeroLog.isHit ? '참(True)' : '거짓(False)'})
                    </span>
                  </div>
                </div>

                {/* Crit Roll Math */}
                {latestHeroLog.critRoll && (
                  <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-400 font-semibold">
                      <span>[주사위 2] 치명타 판정 (Crit Roll)</span>
                      <span className={latestHeroLog.isCrit ? 'text-amber-400 flex items-center gap-1 font-bold' : 'text-slate-400'}>
                        {latestHeroLog.isCrit ? <Check className="w-3 h-3" /> : null}
                        {latestHeroLog.isCrit ? '치명타 발동!' : '일반 피해'}
                      </span>
                    </div>
                    <div className="text-slate-400 break-all text-[10px]">
                      LCG 수식: {latestHeroLog.critRoll.formulaStr}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 text-slate-300">
                      <span>난수 U_crit = <strong className="text-white">{latestHeroLog.critRoll.normalized.toFixed(6)}</strong></span>
                      <span>치명타율 = <strong>{latestHeroLog.critRateUsed.toFixed(4)}</strong></span>
                      <span className="text-slate-400">
                        ({latestHeroLog.critRoll.normalized.toFixed(4)} &lt; {latestHeroLog.critRateUsed.toFixed(4)} → {latestHeroLog.isCrit ? '치명타 적용' : '미발동'})
                      </span>
                    </div>
                  </div>
                )}

                {/* Damage Math */}
                {latestHeroLog.isHit && (
                  <div className="p-2 bg-slate-900/40 rounded text-[11px] flex justify-between items-center text-slate-400">
                    <span>최종 산출 피해량:</span>
                    <span className="font-bold text-white text-xs">{latestHeroLog.damage} DMG</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-950 rounded-lg">
                공격을 실행하면 직전 턴의 LCG 난수 주사위와 확률 판정 수식이 이곳에 실시간으로 분해되어 표시됩니다.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Combat Log Stream & PRNG Streak Stats */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">전투 통계 & 편향성 검증</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">총 시도 횟수</span>
                <span className="font-mono text-white font-bold">{totalAttacks}회</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">명중률 (실측 / 이론)</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {totalAttacks > 0 ? ((totalHits / totalAttacks) * 100).toFixed(1) : 0}% / {(effectiveHitChance * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">치명타율 (실측 / 이론)</span>
                <span className="font-mono text-amber-300 font-bold">
                  {totalAttacks > 0 ? ((totalCrits / totalAttacks) * 100).toFixed(1) : 0}% / {(critRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">전투 상세 로그</h3>
              {combatLogs.length > 0 && (
                <button
                  onClick={() => setCombatLogs([])}
                  className="text-[11px] text-slate-500 hover:text-slate-300"
                >
                  로그 비우기
                </button>
              )}
            </div>

            {combatLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                공격 버튼을 눌러 전투를 개시하세요.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {combatLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded border text-xs ${
                      log.attacker === 'HERO'
                        ? log.isCrit
                          ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                          : log.isHit
                          ? 'bg-cyan-950/30 border-cyan-800/60 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                        : 'bg-rose-950/30 border-rose-900/40 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">Turn {log.turn}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        Hit U={log.hitRoll.normalized.toFixed(3)}
                        {log.critRoll && ` · Crit U=${log.critRoll.normalized.toFixed(3)}`}
                      </span>
                    </div>
                    <div className="text-xs leading-relaxed">{log.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
