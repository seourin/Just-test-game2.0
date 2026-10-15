import React, { useState, useEffect, useRef } from 'react';
import { LinearCongruentialGenerator, LCG_PRESETS, LcgPreset } from '../lib/lcg';
import { sound } from '../lib/sound';
import { Play, Check, X, RefreshCw, Layers, BarChart3, HelpCircle, AlertCircle } from 'lucide-react';

interface LcgLabProps {
  lcg: LinearCongruentialGenerator;
  onLcgConfigChange: (presetId: string, customParams?: { m: bigint; a: bigint; c: bigint; seed: bigint }) => void;
  onLcgStep: () => void;
}

export const LcgLab: React.FC<LcgLabProps> = ({ lcg, onLcgConfigChange, onLcgStep }) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('ansi_c');
  const [customM, setCustomM] = useState<string>(lcg.m.toString());
  const [customA, setCustomA] = useState<string>(lcg.a.toString());
  const [customC, setCustomC] = useState<string>(lcg.c.toString());
  const [customSeed, setCustomSeed] = useState<string>(lcg.initialSeed.toString());

  // 2D Phase Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pointCount, setPointCount] = useState<number>(2000);
  const [chiSquareScore, setChiSquareScore] = useState<number>(0);
  const [histogramBins, setHistogramBins] = useState<number[]>(new Array(20).fill(0));

  // Hull-Dobell Analysis
  const hullDobell = lcg.checkHullDobell();

  const handlePresetSelect = (preset: LcgPreset) => {
    sound.playClick();
    setSelectedPresetId(preset.id);
    setCustomM(preset.m.toString());
    setCustomA(preset.a.toString());
    setCustomC(preset.c.toString());
    setCustomSeed(preset.defaultSeed.toString());
    onLcgConfigChange(preset.id);
  };

  const handleApplyCustom = () => {
    sound.playClick();
    try {
      const m = BigInt(customM);
      const a = BigInt(customA);
      const c = BigInt(customC);
      const seed = BigInt(customSeed);
      setSelectedPresetId('custom');
      onLcgConfigChange('custom', { m, a, c, seed });
    } catch {
      alert('유효한 정수를 입력해주세요.');
    }
  };

  // Render 2D Phase Space Lattice test: plot (X_n, X_{n+1})
  const renderLattice = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#020617'; // slate-950
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((width / 4) * i, 0);
      ctx.lineTo((width / 4) * i, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, (height / 4) * i);
      ctx.lineTo(width, (height / 4) * i);
      ctx.stroke();
    }

    // Run temporary LCG from current seed to plot points
    let tempX = lcg.currentSeed;
    const m = lcg.m;
    const a = lcg.a;
    const c = lcg.c;

    const bins = new Array(20).fill(0);

    ctx.fillStyle = '#38bdf8'; // sky-400 / cyan

    for (let i = 0; i < pointCount; i++) {
      const nextX = ((a * tempX + c) % m + m) % m;
      const u1 = Number(tempX) / Number(m);
      const u2 = Number(nextX) / Number(m);

      // Plot point (u1, u2)
      const px = u1 * width;
      const py = height - u2 * height; // invert Y for standard Cartesian

      ctx.fillRect(px, py, 1.5, 1.5);

      // Collect histogram
      const binIdx = Math.min(19, Math.floor(u1 * 20));
      bins[binIdx]++;

      tempX = nextX;
    }

    // Compute Chi-Square Statistic for 20 bins
    // Expected count per bin: pointCount / 20
    const expected = pointCount / 20;
    let chiSquare = 0;
    for (let i = 0; i < 20; i++) {
      const observed = bins[i];
      chiSquare += Math.pow(observed - expected, 2) / expected;
    }

    setHistogramBins(bins);
    setChiSquareScore(chiSquare);
  };

  useEffect(() => {
    renderLattice();
  }, [lcg.m, lcg.a, lcg.c, lcg.currentSeed, pointCount]);

  return (
    <div className="space-y-6">
      {/* Header explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              선형 합동법(LCG) 수식 분석 & 2D 격자 검정실
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>기본 점화식: Xₙ₊₁ = (a · Xₙ + c) mod m</span>
              <span aria-hidden="true">·</span>
              <span>훌-도벨 정리(Hull-Dobell Theorem) 검증</span>
              <span aria-hidden="true">·</span>
              <span>마르살리아 격자 결함(Spectral Test) 시각화</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={renderLattice}
              className="px-3.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/80 rounded-lg text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>격자 재계산</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Preset Selector & Hull-Dobell Theorem */}
        <div className="space-y-4">
          {/* Presets */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">유명 PRNG 파라미터 프리셋</h3>
            <div className="space-y-2">
              {LCG_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    selectedPresetId === p.id
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-white mb-0.5">{p.koreanName}</div>
                  <div className="text-[11px] text-slate-400">{p.description}</div>
                  <div className="mt-1 text-[10px] font-mono text-indigo-300">
                    m={p.m.toString().slice(0, 8)}... a={p.a.toString()} c={p.c.toString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Parameter Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">파라미터 직접 설정</h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">모듈러스 (m - 주기 결정)</label>
                <input
                  type="text"
                  value={customM}
                  onChange={(e) => setCustomM(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">승수 (a - 배수)</label>
                <input
                  type="text"
                  value={customA}
                  onChange={(e) => setCustomA(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">증분 (c - 더하는 상수)</label>
                <input
                  type="text"
                  value={customC}
                  onChange={(e) => setCustomC(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">시작 시드 (X₀)</label>
                <input
                  type="text"
                  value={customSeed}
                  onChange={(e) => setCustomSeed(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>

              <button
                onClick={handleApplyCustom}
                className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded transition-colors"
              >
                파라미터 적용 & 시뮬레이터 동기화
              </button>
            </div>
          </div>
        </div>

        {/* Center & Right: 2D Phase Canvas & Theorem Check */}
        <div className="lg:col-span-2 space-y-4">
          {/* Hull-Dobell Theorem Audit Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center justify-between">
              <span>훌-도벨 정리(Hull-Dobell Theorem) 판정 결과</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono ${
                  hullDobell.isFullPeriod
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {hullDobell.isFullPeriod ? '최대 주기 충족 (Full Period)' : '주기 결함 발생 위험'}
              </span>
            </h3>

            <div className="text-xs text-slate-400 mb-3">{hullDobell.summary}</div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {/* Cond 1 */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  {hullDobell.gcd_c_m_passed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>조건 1: gcd(c, m) = 1</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  계산값: gcd = {hullDobell.gcd_c_m.toString()}
                </div>
              </div>

              {/* Cond 2 */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  {hullDobell.primeDivisorsPassed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>조건 2: p | (a - 1)</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate" title={hullDobell.primeDivisorsDetail}>
                  {hullDobell.primeDivisorsDetail}
                </div>
              </div>

              {/* Cond 3 */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  {hullDobell.mod4Passed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>조건 3: 4 | m ⇒ 4 | (a - 1)</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {hullDobell.mod4Detail}
                </div>
              </div>
            </div>
          </div>

          {/* 2D Phase Canvas (Marsaglia Hyperplane / Lattice Test) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  2D 위상 공간 격자 검정 (Spectral Phase Space Test)
                </h3>
                <div className="text-xs text-slate-400">
                  연속된 두 난수 (Xₙ, Xₙ₊₁)을 좌표 평면에 점으로 사영하여 격자 줄무늬 결함을 검출합니다.
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">샘플 점수:</span>
                <select
                  value={pointCount}
                  onChange={(e) => setPointCount(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1"
                >
                  <option value={1000}>1,000개</option>
                  <option value={2000}>2,000개</option>
                  <option value={5000}>5,000개</option>
                  <option value={10000}>10,000개</option>
                </select>
              </div>
            </div>

            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex justify-center p-2">
              <canvas
                ref={canvasRef}
                width={420}
                height={420}
                className="w-full max-w-[420px] aspect-square rounded shadow-inner"
              />
            </div>

            {selectedPresetId === 'randu' && (
              <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-800/80 rounded text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>RANDU 결함 발현 중:</strong> George Marsaglia의 1968년 논문 &quot;Random Numbers Fall Mainly in the Planes&quot;에 보고된 현상으로, 연속된 난수들이 소수의 평면에만 갇히는 심각한 규칙성이 격자 형태로 나타납니다.
                </div>
              </div>
            )}
          </div>

          {/* Histogram & Chi-Square Uniformity Test */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                균등 분포 히스토그램 & 카이제곱(χ²) 적합도 검정
              </h3>
              <div className="text-xs font-mono text-cyan-300">
                χ² = {chiSquareScore.toFixed(2)} (자유도 df=19)
              </div>
            </div>

            <div className="text-xs text-slate-400 mb-3">
              [0, 1) 구간을 20개 빈으로 나누었을 때 난수의 빈도수 분포입니다. 기대 빈도: {(pointCount / 20).toFixed(0)}개
            </div>

            <div className="h-28 flex items-end gap-1 pt-4 pb-1 px-1 bg-slate-950 border border-slate-800 rounded-lg">
              {histogramBins.map((count, idx) => {
                const max = Math.max(...histogramBins, pointCount / 10);
                const heightPct = (count / max) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-cyan-500/80 hover:bg-cyan-400 rounded-t transition-all group relative"
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                  >
                    <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10 font-mono">
                      빈 #{idx + 1}: {count}개
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1 px-1">
              <span>0.00</span>
              <span>0.50</span>
              <span>1.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
