import React, { useState, useMemo } from 'react';
import { LinearCongruentialGenerator, LcgStepResult } from '../lib/lcg';
import { MersenneTwister, Mt19937StepResult } from '../lib/mersenneTwister';
import { sound } from '../lib/sound';
import { Sparkles, History, Eye, Info, RotateCcw, Cpu, Binary } from 'lucide-react';

interface GachaItem {
  id: string;
  name: string;
  tier: 'SSR' | 'SR' | 'R' | 'N';
  tierName: string;
  icon: string;
  color: string;
  badgeClass: string;
}

const SSR_POOL: GachaItem[] = [
  { id: 'ssr_1', name: '천공의 수호자 아르테미스', tier: 'SSR', tierName: '전설 5★', icon: '👑', color: 'text-amber-400', badgeClass: 'bg-amber-950/70 border-amber-500/50 text-amber-300' },
  { id: 'ssr_2', name: '성룡의 성검 바하무트', tier: 'SSR', tierName: '전설 5★', icon: '⚔️', color: 'text-amber-400', badgeClass: 'bg-amber-950/70 border-amber-500/50 text-amber-300' },
  { id: 'ssr_3', name: '시간의 마도서 크로노스', tier: 'SSR', tierName: '전설 5★', icon: '📖', color: 'text-amber-400', badgeClass: 'bg-amber-950/70 border-amber-500/50 text-amber-300' },
];

const SR_POOL: GachaItem[] = [
  { id: 'sr_1', name: '칠흑의 암살 단도', tier: 'SR', tierName: '영웅 4★', icon: '🗡️', color: 'text-purple-400', badgeClass: 'bg-purple-950/70 border-purple-500/50 text-purple-300' },
  { id: 'sr_2', name: '용기사의 에테르 방패', tier: 'SR', tierName: '영웅 4★', icon: '🛡️', color: 'text-purple-400', badgeClass: 'bg-purple-950/70 border-purple-500/50 text-purple-300' },
  { id: 'sr_3', name: '질풍의 정령궁', tier: 'SR', tierName: '영웅 4★', icon: '🏹', color: 'text-purple-400', badgeClass: 'bg-purple-950/70 border-purple-500/50 text-purple-300' },
];

const R_POOL: GachaItem[] = [
  { id: 'r_1', name: '강철 기사 롱소드', tier: 'R', tierName: '희귀 3★', icon: '🗡️', color: 'text-cyan-400', badgeClass: 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300' },
  { id: 'r_2', name: '마력 응축 아뮬렛', tier: 'R', tierName: '희귀 3★', icon: '🔮', color: 'text-cyan-400', badgeClass: 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300' },
  { id: 'r_3', name: '수호 병사의 투구', tier: 'R', tierName: '희귀 3★', icon: '🪖', color: 'text-cyan-400', badgeClass: 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300' },
];

const N_POOL: GachaItem[] = [
  { id: 'n_1', name: '수련자의 목검', tier: 'N', tierName: '일반 2★', icon: '🪵', color: 'text-slate-400', badgeClass: 'bg-slate-900 border-slate-700 text-slate-400' },
  { id: 'n_2', name: '가죽 덧댄 팔보호구', tier: 'N', tierName: '일반 2★', icon: '🧤', color: 'text-slate-400', badgeClass: 'bg-slate-900 border-slate-700 text-slate-400' },
  { id: 'n_3', name: '하급 체력 회복 물약', tier: 'N', tierName: '일반 2★', icon: '🧪', color: 'text-slate-400', badgeClass: 'bg-slate-900 border-slate-700 text-slate-400' },
  { id: 'n_4', name: '녹슨 고철 덩어리', tier: 'N', tierName: '일반 2★', icon: '⚙️', color: 'text-slate-400', badgeClass: 'bg-slate-900 border-slate-700 text-slate-400' },
];

export interface PullRecord {
  id: string;
  item: GachaItem;
  pityAtPull: number;
  engine: 'MT19937' | 'LCG';
  mtStep?: Mt19937StepResult;
  lcgStep?: LcgStepResult;
  normalized: number;
  isPityTriggered: boolean;
}

interface GachaSystemProps {
  lcg: LinearCongruentialGenerator;
  onLcgStep: () => void;
}

export const GachaSystem: React.FC<GachaSystemProps> = ({ lcg, onLcgStep }) => {
  // Mersenne Twister PRNG instance
  const [mtSeed, setMtSeed] = useState<number>(5489);
  const mt = useMemo(() => new MersenneTwister(5489), []);

  const [engineType, setEngineType] = useState<'MT19937' | 'LCG'>('MT19937');
  const [history, setHistory] = useState<PullRecord[]>([]);
  const [pityCounter, setPityCounter] = useState<number>(0);
  const [lastDrawn, setLastDrawn] = useState<GachaItem[]>([]);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [showPrediction, setShowPrediction] = useState<boolean>(false);
  const [mtStateCycle, setMtStateCycle] = useState<number>(0);

  // Statistics
  const totalPulls = history.length;
  const countSSR = history.filter((h) => h.item.tier === 'SSR').length;
  const countSR = history.filter((h) => h.item.tier === 'SR').length;
  const countR = history.filter((h) => h.item.tier === 'R').length;
  const countN = history.filter((h) => h.item.tier === 'N').length;

  const currentSSRRate = pityCounter >= 70 ? Math.min(1.0, 0.015 + (pityCounter - 70) * 0.02) : 0.015;

  const handleResetMtSeed = () => {
    sound.playClick();
    const newSeed = Math.floor(Math.random() * 1000000) + 1;
    setMtSeed(newSeed);
    mt.init(newSeed);
    setMtStateCycle((c) => c + 1);
  };

  const executePull = (count: number) => {
    if (isPulling) return;
    setIsPulling(true);

    let currentPity = pityCounter;
    const newRecords: PullRecord[] = [];
    const drawnItems: GachaItem[] = [];

    let hasSSR = false;
    let hasSR = false;

    for (let i = 0; i < count; i++) {
      currentPity++;

      let u: number;
      let mtStep: Mt19937StepResult | undefined = undefined;
      let lcgStep: LcgStepResult | undefined = undefined;

      if (engineType === 'MT19937') {
        mtStep = mt.next();
        u = mtStep.normalized;
      } else {
        lcgStep = lcg.next();
        u = lcgStep.normalized;
        onLcgStep();
      }

      // Effective SSR rate with soft & hard pity
      let effectiveSSRRate = 0.015;
      let pityTriggered = false;

      if (currentPity >= 90) {
        effectiveSSRRate = 1.0;
        pityTriggered = true;
      } else if (currentPity >= 70) {
        effectiveSSRRate = 0.015 + (currentPity - 70) * 0.02;
      }

      let drawnItem: GachaItem;

      // Cumulative probability thresholds
      if (u < effectiveSSRRate) {
        // SSR Hit!
        const poolIndex = Math.floor(u * 1000) % SSR_POOL.length;
        drawnItem = SSR_POOL[poolIndex];
        currentPity = 0;
        hasSSR = true;
      } else if (u < effectiveSSRRate + 0.085) {
        // SR Hit!
        const poolIndex = Math.floor(u * 1000) % SR_POOL.length;
        drawnItem = SR_POOL[poolIndex];
        hasSR = true;
      } else if (u < effectiveSSRRate + 0.085 + 0.30) {
        // Rare Hit
        const poolIndex = Math.floor(u * 1000) % R_POOL.length;
        drawnItem = R_POOL[poolIndex];
      } else {
        // Normal
        const poolIndex = Math.floor(u * 1000) % N_POOL.length;
        drawnItem = N_POOL[poolIndex];
      }

      drawnItems.push(drawnItem);
      newRecords.push({
        id: `${Date.now()}_${i}`,
        item: drawnItem,
        pityAtPull: currentPity,
        engine: engineType,
        mtStep,
        lcgStep,
        normalized: u,
        isPityTriggered: pityTriggered,
      });
    }

    setPityCounter(currentPity);
    setLastDrawn(drawnItems);
    setHistory((prev) => [...newRecords.reverse(), ...prev].slice(0, 500));
    setMtStateCycle((c) => c + 1);

    if (hasSSR) {
      sound.playEpic();
    } else if (hasSR) {
      sound.playRare();
    } else {
      sound.playRoll();
    }

    setIsPulling(false);
  };

  // Peek predictions
  const peekedPredictions = useMemo(() => {
    if (!showPrediction) return [];

    if (engineType === 'MT19937') {
      const peeked = mt.peek(5);
      return peeked.map((step, idx) => {
        const estPity = pityCounter + idx + 1;
        let rate = 0.015;
        if (estPity >= 90) rate = 1.0;
        else if (estPity >= 70) rate = 0.015 + (estPity - 70) * 0.02;

        const u = step.normalized;
        let tier: 'SSR' | 'SR' | 'R' | 'N' = 'N';
        if (u < rate) tier = 'SSR';
        else if (u < rate + 0.085) tier = 'SR';
        else if (u < rate + 0.085 + 0.30) tier = 'R';

        return {
          stepNum: step.step,
          u,
          tier,
          rawHex: `0x${step.temperedWord.toString(16).toUpperCase().padStart(8, '0')}`,
        };
      });
    } else {
      const peeked = lcg.peek(5);
      return peeked.map((step, idx) => {
        const estPity = pityCounter + idx + 1;
        let rate = 0.015;
        if (estPity >= 90) rate = 1.0;
        else if (estPity >= 70) rate = 0.015 + (estPity - 70) * 0.02;

        const u = step.normalized;
        let tier: 'SSR' | 'SR' | 'R' | 'N' = 'N';
        if (u < rate) tier = 'SSR';
        else if (u < rate + 0.085) tier = 'SR';
        else if (u < rate + 0.085 + 0.30) tier = 'R';

        return {
          stepNum: step.step,
          u,
          tier,
          rawHex: `X=${step.nextSeed.toString().slice(0, 8)}...`,
        };
      });
    }
  }, [showPrediction, engineType, mt, lcg, pityCounter, mtStateCycle]);

  const latestRecord = history[0];

  return (
    <div className="space-y-6">
      {/* Hero Visual Card */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
        <div className="h-48 sm:h-56 relative w-full overflow-hidden bg-slate-950">
          <img
            src="/src/assets/images/game_gacha_banner_1791431100232.jpg"
            alt="메르센 트위스터 가챠 제단"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center brightness-90 filter"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-amber-400 font-mono tracking-wider">
                  {engineType === 'MT19937' ? 'MERSENNE TWISTER (MT19937) ENGINE' : 'LINEAR CONGRUENTIAL (LCG) ENGINE'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                  {engineType === 'MT19937' ? '주기: 2¹⁹⁹³⁷ - 1' : '주기: 2³¹'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                운명의 성좌 소환 (Gacha Banner)
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>SSR 1.5%</span>
                <span aria-hidden="true">·</span>
                <span>SR 8.5%</span>
                <span aria-hidden="true">·</span>
                <span>천장 시스템 (70회부터 증가, 90회 100% 확정)</span>
              </div>
            </div>

            {/* Pity Counter Gauge */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg text-right shrink-0">
              <div className="text-xs text-slate-400">천장 스택 (Pity)</div>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                {pityCounter} <span className="text-xs text-slate-500 font-normal">/ 90</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                현재 SSR 확률: <span className="text-cyan-300 font-mono">{(currentSSRRate * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRNG Engine Mode Selector */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">가챠 난수 생성기 방식 선택</div>
            <div className="text-sm font-bold text-white">
              {engineType === 'MT19937' ? '메르센 트위스터 (Mersenne Twister MT19937)' : '선형 합동법 (Linear Congruential Generator)'}
            </div>
          </div>
        </div>

        {/* Engine Switcher Buttons */}
        <div className="flex items-center gap-2">
          <div className="p-1 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-1">
            <button
              onClick={() => {
                sound.playClick();
                setEngineType('MT19937');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                engineType === 'MT19937'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ★ 메르센 트위스터 (MT19937)
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setEngineType('LCG');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                engineType === 'LCG'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              선형 합동법 (LCG)
            </button>
          </div>

          {engineType === 'MT19937' && (
            <button
              onClick={handleResetMtSeed}
              title="새로운 시드로 MT19937 재초기화"
              className="p-2 text-slate-400 hover:text-amber-400 bg-slate-950 border border-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action Deck & Summon Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls & Pull Results */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                소환 집행 ({engineType === 'MT19937' ? 'MT19937 32-bit Tempering' : 'LCG Step Advancement'})
              </h3>
              <button
                onClick={() => setShowPrediction(!showPrediction)}
                className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showPrediction ? '시드 예측 숨기기' : 'RNG 미래 5회차 결과 투시'}</span>
              </button>
            </div>

            {/* Future Seed Prediction Card */}
            {showPrediction && (
              <div className="mb-4 p-3.5 bg-slate-950 border border-amber-900/50 rounded-lg text-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Binary className="w-3.5 h-3.5" />
                    {engineType === 'MT19937' ? 'MT19937 상태 벡터 사전 관측 (Peek Oracle)' : 'LCG 시드 결정론적 예측'}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {engineType === 'MT19937' ? '624개 워드 상태 보존 복사 후 계산' : 'lcg.peek()'}
                  </span>
                </div>
                <div className="text-slate-400 mb-2 leading-relaxed">
                  {engineType === 'MT19937' ? (
                    <>메르센 트위스터는 내부 624개 32비트 워드 배열(<code className="text-amber-300">MT[624]</code>)과 인덱스 포인터에 의해 다음 난수가 완전히 결정됩니다. 서버 메모리 상태를 복제하여 다음 5회차 소환을 100% 정확도로 예측할 수 있습니다.</>
                  ) : (
                    <>선형합동법의 32비트 시드값을 바탕으로 미래 결과를 사전에 추출합니다.</>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {peekedPredictions.map((p, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-center border font-mono ${
                        p.tier === 'SSR'
                          ? 'border-amber-500/80 bg-amber-950/40 text-amber-300'
                          : p.tier === 'SR'
                          ? 'border-purple-500/80 bg-purple-950/40 text-purple-300'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500">+{idx + 1}회차</div>
                      <div className="font-bold text-sm my-0.5">{p.tier}</div>
                      <div className="text-[10px] truncate tabular-nums text-slate-400">{p.rawHex}</div>
                      <div className="text-[10px] tabular-nums text-cyan-400">U={p.u.toFixed(4)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pull Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => executePull(1)}
                disabled={isPulling}
                className="py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm border border-slate-700/80 transition-colors flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
              >
                <span>1회 소환</span>
                <span className="text-[11px] text-slate-400 font-mono">1 {engineType} Draw</span>
              </button>
              <button
                onClick={() => executePull(10)}
                disabled={isPulling}
                className="py-3 px-4 rounded-lg bg-gradient-to-r from-amber-900/60 to-yellow-900/60 hover:from-amber-800/80 hover:to-yellow-800/80 text-amber-200 font-semibold text-sm border border-amber-700/60 transition-colors flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm disabled:opacity-50"
              >
                <span>10회 연속 소환</span>
                <span className="text-[11px] text-amber-300/80 font-mono">10 Draws</span>
              </button>
              <button
                onClick={() => executePull(100)}
                disabled={isPulling}
                className="py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium text-sm border border-cyan-800/60 transition-colors flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
              >
                <span>100회 대량 시뮬레이션</span>
                <span className="text-[11px] text-slate-400 font-mono">100 연차 고속 검증</span>
              </button>
            </div>

            {/* Recently Drawn Display */}
            {lastDrawn.length > 0 && (
              <div className="mt-5 pt-5 border-t border-slate-800">
                <div className="text-xs text-slate-400 mb-2.5">최근 획득 결과 ({lastDrawn.length}건)</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1">
                  {lastDrawn.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex flex-col items-center text-center transition-all ${
                        item.tier === 'SSR'
                          ? 'border-amber-500/80 bg-amber-950/50 shadow-md shadow-amber-950/50'
                          : item.tier === 'SR'
                          ? 'border-purple-500/60 bg-purple-950/40'
                          : item.tier === 'R'
                          ? 'border-cyan-800/60 bg-cyan-950/20'
                          : 'border-slate-800 bg-slate-950/50'
                      }`}
                    >
                      <span className="text-2xl mb-1">{item.icon}</span>
                      <div className="text-xs font-semibold text-slate-200 truncate w-full" title={item.name}>
                        {item.name}
                      </div>
                      <div className={`text-[10px] font-mono mt-1 ${item.color}`}>
                        {item.tierName}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Real-time Mathematical PRNG Step Inspector */}
          {latestRecord && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>
                    {latestRecord.engine === 'MT19937'
                      ? '메르센 트위스터(MT19937) 템퍼링 수식 검증 (Math Inspector)'
                      : 'LCG 수식 검증 (Math Inspector)'}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  엔진: {latestRecord.engine}
                </span>
              </h3>

              {latestRecord.engine === 'MT19937' && latestRecord.mtStep ? (
                <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 font-mono text-xs text-slate-300 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-400 text-[11px] pb-1.5 border-b border-slate-800">
                    <span>
                      상태 인덱스 mti: <strong className="text-white">{latestRecord.mtStep.stateIndex} / 624</strong>
                      {latestRecord.mtStep.isTwistOccurred && (
                        <span className="ml-2 text-emerald-400 font-bold">[Twist 변환 실행됨]</span>
                      )}
                    </span>
                    <span className="text-amber-400 font-bold">
                      결과: {latestRecord.item.tier} [{latestRecord.item.name}]
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">원시 상태 워드 MT[i]:</span>{' '}
                      <span className="text-slate-200">
                        0x{latestRecord.mtStep.rawWord.toString(16).toUpperCase().padStart(8, '0')} ({latestRecord.mtStep.rawWord})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">최종 템퍼링 결과:</span>{' '}
                      <span className="text-amber-300 font-bold">
                        0x{latestRecord.mtStep.temperedWord.toString(16).toUpperCase().padStart(8, '0')} ({latestRecord.mtStep.temperedWord})
                      </span>
                    </div>
                  </div>

                  {/* 4-Stage Tempering Transform Pipeline */}
                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 text-[11px] space-y-1">
                    <div className="text-slate-400 font-semibold mb-1">MT19937 4단계 비트 시프트 & 마스크 템퍼링(Tempering) 변환 과정:</div>
                    <div className="text-slate-300">
                      1단계 y₁ = y ⊕ (y &gt;&gt; 11) → <span className="text-cyan-300">0x{latestRecord.mtStep.temperingStages.stage1.toString(16).toUpperCase()}</span>
                    </div>
                    <div className="text-slate-300">
                      2단계 y₂ = y₁ ⊕ ((y₁ &lt;&lt; 7) &amp; 0x9D2C5680) → <span className="text-cyan-300">0x{latestRecord.mtStep.temperingStages.stage2.toString(16).toUpperCase()}</span>
                    </div>
                    <div className="text-slate-300">
                      3단계 y₃ = y₂ ⊕ ((y₂ &lt;&lt; 15) &amp; 0xEFC60000) → <span className="text-cyan-300">0x{latestRecord.mtStep.temperingStages.stage3.toString(16).toUpperCase()}</span>
                    </div>
                    <div className="text-slate-300">
                      4단계 y₄ = y₃ ⊕ (y₃ &gt;&gt; 18) → <span className="text-amber-300 font-bold">0x{latestRecord.mtStep.temperingStages.stage4.toString(16).toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-slate-400">
                    <div>
                      <span className="text-slate-500">정규화 난수 U = y₄ / 2³²:</span>{' '}
                      <span className="text-white font-bold">{latestRecord.normalized.toFixed(8)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">판정 기준:</span>{' '}
                      <span>
                        {latestRecord.item.tier === 'SSR'
                          ? `U < 0.015 (당첨)`
                          : latestRecord.item.tier === 'SR'
                          ? `0.015 <= U < 0.100 (당첨)`
                          : latestRecord.item.tier === 'R'
                          ? `0.100 <= U < 0.400 (당첨)`
                          : `U >= 0.400 (일반)`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : latestRecord.lcgStep ? (
                <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 font-mono text-xs text-slate-300 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-400 text-[11px] pb-1.5 border-b border-slate-800">
                    <span>스텝: #{latestRecord.lcgStep.step}</span>
                    <span className="text-cyan-400 font-bold">결과: {latestRecord.item.tier} [{latestRecord.item.name}]</span>
                  </div>
                  <div className="text-cyan-300 break-all leading-relaxed">
                    <span className="text-slate-500">LCG 공식:</span> {latestRecord.lcgStep.formulaStr}
                  </div>
                  <div className="text-slate-400">
                    정규화 난수 U = <span className="text-white font-bold">{latestRecord.normalized.toFixed(8)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Right: Statistics & History Stream */}
        <div className="space-y-4">
          {/* Rate Statistics */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">소환 누적 통계</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-400 font-medium">SSR (5성 전설)</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {countSSR}회 ({totalPulls > 0 ? ((countSSR / totalPulls) * 100).toFixed(2) : '0.00'}%) · 이론 1.5%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${totalPulls > 0 ? Math.min(100, (countSSR / totalPulls) * 100 * 5) : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-purple-400 font-medium">SR (4성 영웅)</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {countSR}회 ({totalPulls > 0 ? ((countSR / totalPulls) * 100).toFixed(2) : '0.00'}%) · 이론 8.5%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-400 transition-all duration-300"
                    style={{ width: `${totalPulls > 0 ? Math.min(100, (countSR / totalPulls) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-cyan-400 font-medium">R (3성 희귀)</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {countR}회 ({totalPulls > 0 ? ((countR / totalPulls) * 100).toFixed(2) : '0.00'}%) · 이론 30.0%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${totalPulls > 0 ? (countR / totalPulls) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-medium">N (2성 일반)</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {countN}회 ({totalPulls > 0 ? ((countN / totalPulls) * 100).toFixed(2) : '0.00'}%) · 이론 60.0%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-600 transition-all duration-300"
                    style={{ width: `${totalPulls > 0 ? (countN / totalPulls) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                <span>총 시뮬레이션 소환수</span>
                <span className="font-mono font-bold text-white tabular-nums">{totalPulls}회</span>
              </div>
            </div>
          </div>

          {/* MT19937 Educational Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              메르센 트위스터의 게임 서버 장점
            </h3>
            <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
              <li>
                <strong className="text-slate-200">초장대 주기:</strong> 2¹⁹⁹³⁷ - 1의 주기로, 전 세계 플레이어가 수억 번 뽑아도 절대 주기가 반복되지 않습니다.
              </li>
              <li>
                <strong className="text-slate-200">623차원 균등 분포:</strong> LCG와 달리 다차원 공간에서 마르살리아 평면(격자 결함)이 발생하지 않아 공평한 뽑기를 보장합니다.
              </li>
              <li>
                <strong className="text-slate-200">표준 채택:</strong> C++ <code>std::mt19937</code>, Python <code>random</code> 등 메이저 게임 서버의 기본 PRNG입니다.
              </li>
            </ul>
          </div>

          {/* History Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                소환 이력 로그
              </h3>
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  로그 비우기
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                아직 소환 기록이 없습니다.<br />위의 버튼을 눌러 난수를 생성해보세요.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {history.slice(0, 50).map((h) => (
                  <div
                    key={h.id}
                    className="text-xs p-2 bg-slate-950/80 border border-slate-800/60 rounded flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{h.item.icon}</span>
                      <span className={`font-semibold ${h.item.color} truncate`}>
                        {h.item.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {h.engine}
                      </span>
                      {h.isPityTriggered && (
                        <span className="text-[10px] text-amber-400 font-mono">천장</span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0 ml-2">
                      U={h.normalized.toFixed(4)}
                    </div>
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
