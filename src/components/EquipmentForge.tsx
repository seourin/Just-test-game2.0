import React, { useState } from 'react';
import { LinearCongruentialGenerator, LcgStepResult } from '../lib/lcg';
import { sound } from '../lib/sound';
import { Hammer, ShieldAlert, Sparkles, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ForgeRule {
  targetLevel: number;
  baseRate: number; // 0.0 to 1.0
  downgradeOnFail: boolean;
  destroyRateOnFail: number; // 0.0 to 1.0
  costGold: number;
}

const FORGE_RULES: ForgeRule[] = [
  { targetLevel: 1, baseRate: 1.0, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 100 },
  { targetLevel: 2, baseRate: 1.0, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 150 },
  { targetLevel: 3, baseRate: 1.0, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 200 },
  { targetLevel: 4, baseRate: 0.85, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 400 },
  { targetLevel: 5, baseRate: 0.75, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 600 },
  { targetLevel: 6, baseRate: 0.65, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 900 },
  { targetLevel: 7, baseRate: 0.50, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 1500 },
  { targetLevel: 8, baseRate: 0.40, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 2200 },
  { targetLevel: 9, baseRate: 0.30, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 3200 },
  { targetLevel: 10, baseRate: 0.20, downgradeOnFail: false, destroyRateOnFail: 0, costGold: 5000 },
  { targetLevel: 11, baseRate: 0.15, downgradeOnFail: true, destroyRateOnFail: 0, costGold: 8000 },
  { targetLevel: 12, baseRate: 0.12, downgradeOnFail: true, destroyRateOnFail: 0, costGold: 12000 },
  { targetLevel: 13, baseRate: 0.08, downgradeOnFail: true, destroyRateOnFail: 0.03, costGold: 20000 },
  { targetLevel: 14, baseRate: 0.05, downgradeOnFail: true, destroyRateOnFail: 0.06, costGold: 35000 },
  { targetLevel: 15, baseRate: 0.03, downgradeOnFail: true, destroyRateOnFail: 0.10, costGold: 60000 },
];

export interface ForgeLog {
  id: string;
  fromLevel: number;
  toLevel: number;
  result: 'SUCCESS' | 'FAIL' | 'DOWNGRADE' | 'DESTROYED';
  stepInfo: LcgStepResult;
  effectiveRate: number;
  failstacksUsed: number;
}

interface EquipmentForgeProps {
  lcg: LinearCongruentialGenerator;
  onLcgStep: () => void;
}

export const EquipmentForge: React.FC<EquipmentForgeProps> = ({ lcg, onLcgStep }) => {
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [failstacks, setFailstacks] = useState<number>(0);
  const [goldSpent, setGoldSpent] = useState<number>(0);
  const [isDestroyed, setIsDestroyed] = useState<boolean>(false);
  const [useProtection, setUseProtection] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [logs, setLogs] = useState<ForgeLog[]>([]);
  const [targetAutoLevel, setTargetAutoLevel] = useState<number>(10);

  const nextRule = currentLevel < 15 ? FORGE_RULES[currentLevel] : null;

  // Failstack gives +1.5% success rate per stack, capped at +50%
  const failstackBonus = Math.min(0.50, failstacks * 0.015);
  const effectiveSuccessRate = nextRule
    ? Math.min(1.0, nextRule.baseRate + failstackBonus)
    : 0;

  const handleEnhance = () => {
    if (!nextRule || isDestroyed || isEnhancing) return;

    setIsEnhancing(true);
    const step = lcg.next();
    const u = step.normalized;

    let result: 'SUCCESS' | 'FAIL' | 'DOWNGRADE' | 'DESTROYED' = 'FAIL';
    let newLevel = currentLevel;
    const currentStacks = failstacks;

    setGoldSpent((prev) => prev + nextRule.costGold);

    if (u < effectiveSuccessRate) {
      // Success!
      result = 'SUCCESS';
      newLevel = currentLevel + 1;
      setFailstacks(0);
      sound.playUpgradeSuccess();
    } else {
      // Failed!
      sound.playUpgradeFail();
      // Increase failstack
      setFailstacks((prev) => prev + 1);

      // Check destruction if applicable
      if (nextRule.destroyRateOnFail > 0 && !useProtection) {
        // Destroy check uses second LCG step or sub-threshold
        const destroyStep = lcg.next();
        if (destroyStep.normalized < nextRule.destroyRateOnFail) {
          result = 'DESTROYED';
          setIsDestroyed(true);
        } else if (nextRule.downgradeOnFail) {
          result = 'DOWNGRADE';
          newLevel = Math.max(0, currentLevel - 1);
        } else {
          result = 'FAIL';
        }
      } else if (nextRule.downgradeOnFail && !useProtection) {
        result = 'DOWNGRADE';
        newLevel = Math.max(0, currentLevel - 1);
      } else {
        result = 'FAIL';
      }
    }

    setCurrentLevel(newLevel);
    const newLog: ForgeLog = {
      id: `${Date.now()}_${step.step}`,
      fromLevel: currentLevel,
      toLevel: newLevel,
      result,
      stepInfo: step,
      effectiveRate: effectiveSuccessRate,
      failstacksUsed: currentStacks,
    };

    setLogs((prev) => [newLog, ...prev].slice(0, 100));
    onLcgStep();
    setIsEnhancing(false);
  };

  const handleRepairOrReset = () => {
    sound.playClick();
    setCurrentLevel(0);
    setIsDestroyed(false);
    setFailstacks(0);
    setLogs([]);
    setGoldSpent(0);
  };

  const handleAutoEnhanceToGoal = async () => {
    if (isDestroyed || currentLevel >= targetAutoLevel || isEnhancing) return;

    setIsEnhancing(true);
    let tempLevel = currentLevel;
    let tempStacks = failstacks;
    let tempGold = goldSpent;
    let tempDestroyed = false;
    const newBatchLogs: ForgeLog[] = [];

    let attempts = 0;
    const maxAttempts = 100;

    while (tempLevel < targetAutoLevel && !tempDestroyed && attempts < maxAttempts) {
      attempts++;
      const rule = FORGE_RULES[tempLevel];
      tempGold += rule.costGold;
      const stackBonus = Math.min(0.50, tempStacks * 0.015);
      const effRate = Math.min(1.0, rule.baseRate + stackBonus);

      const step = lcg.next();
      const u = step.normalized;

      let res: 'SUCCESS' | 'FAIL' | 'DOWNGRADE' | 'DESTROYED' = 'FAIL';
      const fromL = tempLevel;

      if (u < effRate) {
        res = 'SUCCESS';
        tempLevel++;
        tempStacks = 0;
      } else {
        tempStacks++;
        if (rule.destroyRateOnFail > 0 && !useProtection) {
          const destroyStep = lcg.next();
          if (destroyStep.normalized < rule.destroyRateOnFail) {
            res = 'DESTROYED';
            tempDestroyed = true;
          } else if (rule.downgradeOnFail) {
            res = 'DOWNGRADE';
            tempLevel = Math.max(0, tempLevel - 1);
          } else {
            res = 'FAIL';
          }
        } else if (rule.downgradeOnFail && !useProtection) {
          res = 'DOWNGRADE';
          tempLevel = Math.max(0, tempLevel - 1);
        } else {
          res = 'FAIL';
        }
      }

      newBatchLogs.unshift({
        id: `${Date.now()}_${attempts}`,
        fromLevel: fromL,
        toLevel: tempLevel,
        result: res,
        stepInfo: step,
        effectiveRate: effRate,
        failstacksUsed: tempStacks,
      });
    }

    setCurrentLevel(tempLevel);
    setFailstacks(tempStacks);
    setGoldSpent(tempGold);
    setIsDestroyed(tempDestroyed);
    setLogs((prev) => [...newBatchLogs, ...prev].slice(0, 100));
    onLcgStep();

    if (tempDestroyed) {
      sound.playUpgradeFail();
    } else if (tempLevel >= targetAutoLevel) {
      sound.playEpic();
    } else {
      sound.playUpgradeSuccess();
    }

    setIsEnhancing(false);
  };

  return (
    <div className="space-y-6">
      {/* Visual Forge Banner */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
        <div className="h-44 sm:h-52 relative w-full overflow-hidden bg-slate-950">
          <img
            src="/src/assets/images/game_forge_anvil_1791431112519.jpg"
            alt="대장간 룬 모루"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center brightness-90 filter"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs text-amber-400 font-mono tracking-wider mb-1">
                EQUIPMENT FORGE PROBABILITY ENGINE
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                룬의 모루 (Equipment Enhancement)
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>안전 강화 구간: +0 ~ +3 (100%)</span>
                <span aria-hidden="true">·</span>
                <span>실패 시 하락: +11부터</span>
                <span aria-hidden="true">·</span>
                <span>파괴 위험: +13부터</span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg text-right shrink-0">
              <div className="text-xs text-slate-400">누적 소모 골드</div>
              <div className="text-xl font-bold font-mono text-amber-300 tabular-nums">
                {goldSpent.toLocaleString()} G
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                실패 보너스 스택: <span className="text-cyan-300 font-mono">+{failstacks} (+{(failstackBonus * 100).toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Weapon Display & Forge Control */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            {/* Weapon Showcase */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 bg-slate-950/90 border border-slate-800/80 rounded-xl">
              <div className="flex items-center gap-4">
                <div
                  className={`w-20 h-20 rounded-xl flex items-center justify-center text-4xl border transition-all ${
                    isDestroyed
                      ? 'border-red-900 bg-red-950/40 text-red-500 opacity-60'
                      : currentLevel >= 13
                      ? 'border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-950/50'
                      : currentLevel >= 10
                      ? 'border-purple-500 bg-purple-950/40 shadow-md shadow-purple-950/40'
                      : currentLevel >= 7
                      ? 'border-cyan-500 bg-cyan-950/40'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {isDestroyed ? '💥' : '⚔️'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xl font-extrabold tracking-tight font-mono ${
                        isDestroyed
                          ? 'text-red-400 line-through'
                          : currentLevel >= 13
                          ? 'text-amber-400'
                          : currentLevel >= 10
                          ? 'text-purple-400'
                          : currentLevel >= 7
                          ? 'text-cyan-400'
                          : 'text-white'
                      }`}
                    >
                      {isDestroyed ? '파괴됨' : `+${currentLevel}`}
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      {isDestroyed ? '부서진 성검의 파편' : '천공의 룬 아크 블레이드'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span>공격력: {isDestroyed ? 0 : 100 + currentLevel * 25 + Math.floor(Math.pow(currentLevel, 2) * 2)}</span>
                    <span aria-hidden="true">·</span>
                    <span>치명타 피해: {isDestroyed ? 0 : 150 + currentLevel * 5}%</span>
                  </div>
                </div>
              </div>

              {/* Status / Level Progress Bar */}
              <div className="w-full sm:w-48 text-right">
                <div className="text-xs text-slate-400 mb-1">강화 완성도 ({currentLevel}/15)</div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 transition-all duration-300"
                    style={{ width: `${(currentLevel / 15) * 100}%` }}
                  />
                </div>
                {currentLevel === 15 && (
                  <div className="text-xs font-bold text-amber-400 mt-1">★ 최대 강화 도달!</div>
                )}
              </div>
            </div>

            {/* Next Enhancement Probability Matrix */}
            {!isDestroyed && nextRule && (
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">기본 성공률</div>
                  <div className="text-base font-bold text-slate-200 font-mono tabular-nums mt-0.5">
                    {(nextRule.baseRate * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-cyan-400">스택 보너스</div>
                  <div className="text-base font-bold text-cyan-300 font-mono tabular-nums mt-0.5">
                    +{(failstackBonus * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-cyan-800/80 rounded-lg">
                  <div className="text-xs text-cyan-400 font-semibold">최종 성공 확률</div>
                  <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
                    {(effectiveSuccessRate * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">실패 시 패널티</div>
                  <div className="text-xs font-semibold text-rose-400 mt-1">
                    {nextRule.destroyRateOnFail > 0
                      ? `하락 (-1) / 파괴 ${(nextRule.destroyRateOnFail * 100).toFixed(0)}%`
                      : nextRule.downgradeOnFail
                      ? '수치 하락 (-1)'
                      : '수치 유지'}
                  </div>
                </div>
              </div>
            )}

            {/* Enhancement Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              {isDestroyed ? (
                <button
                  onClick={handleRepairOrReset}
                  className="w-full py-3 px-4 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  새로운 무기로 복구 / 리셋 (+0 시작)
                </button>
              ) : (
                <>
                  <button
                    onClick={handleEnhance}
                    disabled={isEnhancing || currentLevel >= 15}
                    className="flex-1 w-full py-3 px-5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Hammer className="w-4 h-4" />
                    <span>+{currentLevel + 1} 강화 시도 ({nextRule ? nextRule.costGold.toLocaleString() : 0} G)</span>
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={useProtection}
                        onChange={(e) => setUseProtection(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>보호 부적 활성화</span>
                    </label>

                    <button
                      onClick={handleRepairOrReset}
                      title="강화 리셋"
                      className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Auto Enhance Goal Runner */}
            {!isDestroyed && currentLevel < 15 && (
              <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <span>목표 레벨 자동 도전:</span>
                  <select
                    value={targetAutoLevel}
                    onChange={(e) => setTargetAutoLevel(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs"
                  >
                    <option value={7}>+7 달성</option>
                    <option value={10}>+10 달성</option>
                    <option value={12}>+12 달성</option>
                    <option value={15}>+15 종결 달성</option>
                  </select>
                </div>

                <button
                  onClick={handleAutoEnhanceToGoal}
                  disabled={isEnhancing || currentLevel >= targetAutoLevel}
                  className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-medium transition-colors disabled:opacity-50"
                >
                  +{targetAutoLevel}까지 자동 강화 시뮬레이션
                </button>
              </div>
            )}
          </div>

          {/* LCG Math Formula Callout */}
          {logs.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                직전 강화 시도의 LCG 난수 공식 추적
              </h3>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1.5">
                <div className="text-slate-400 text-[11px] pb-1 border-b border-slate-800 flex justify-between">
                  <span>시도: +{logs[0].fromLevel} → +{logs[0].toLevel}</span>
                  <span className={logs[0].result === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}>
                    판정: {logs[0].result}
                  </span>
                </div>
                <div className="text-slate-400">
                  <span className="text-slate-500">LCG 생성값:</span> {logs[0].stepInfo.formulaStr}
                </div>
                <div className="text-cyan-300">
                  정규화 난수 U = {logs[0].stepInfo.normalized.toFixed(8)}
                </div>
                <div className="text-slate-400 text-[11px]">
                  성공 조건: U &lt; {logs[0].effectiveRate.toFixed(4)} →{' '}
                  <span className={logs[0].result === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {logs[0].stepInfo.normalized < logs[0].effectiveRate ? '성공 조건 만족!' : '실패 조건 해당'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Forge Log History & Probabilities Table */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">강화 단계별 확률표</h3>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 text-xs font-mono">
              {FORGE_RULES.map((r) => (
                <div
                  key={r.targetLevel}
                  className={`flex items-center justify-between p-1.5 rounded ${
                    currentLevel + 1 === r.targetLevel
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                      : currentLevel >= r.targetLevel
                      ? 'text-slate-500'
                      : 'text-slate-300'
                  }`}
                >
                  <span>+{r.targetLevel}</span>
                  <span>{(r.baseRate * 100).toFixed(0)}%</span>
                  <span className="text-slate-500">{r.costGold}G</span>
                  <span className={r.destroyRateOnFail > 0 ? 'text-red-400' : r.downgradeOnFail ? 'text-orange-400' : 'text-slate-600'}>
                    {r.destroyRateOnFail > 0 ? '파괴위험' : r.downgradeOnFail ? '하락' : '안전'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">강화 진행 이력</h3>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] text-slate-500 hover:text-slate-300"
                >
                  기록 지우기
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                아직 강화 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 bg-slate-950 border border-slate-800/80 rounded flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {log.result === 'SUCCESS' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : log.result === 'DESTROYED' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className="font-mono text-slate-300">
                        +{log.fromLevel} → +{log.toLevel}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          log.result === 'SUCCESS'
                            ? 'text-emerald-400'
                            : log.result === 'DESTROYED'
                            ? 'text-rose-500'
                            : 'text-rose-400'
                        }`}
                      >
                        {log.result === 'SUCCESS' ? '성공' : log.result === 'DESTROYED' ? '파괴' : '실패'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                      U={log.stepInfo.normalized.toFixed(4)}
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
