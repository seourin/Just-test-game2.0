/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { LinearCongruentialGenerator, LCG_PRESETS } from './lib/lcg';
import { Header, ActiveTab } from './components/Header';
import { GachaSystem } from './components/GachaSystem';
import { EquipmentForge } from './components/EquipmentForge';
import { BattleSimulator } from './components/BattleSimulator';
import { LcgLab } from './components/LcgLab';
import { sound } from './lib/sound';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('gacha');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Initialize LCG with ANSI C default
  const defaultPreset = LCG_PRESETS[0];
  const [currentSeed, setCurrentSeed] = useState<bigint>(defaultPreset.defaultSeed);
  const [stepCounter, setStepCounter] = useState<number>(0);

  const lcg = useMemo(() => {
    return new LinearCongruentialGenerator(
      defaultPreset.m,
      defaultPreset.a,
      defaultPreset.c,
      defaultPreset.defaultSeed
    );
  }, []);

  const handleLcgStep = () => {
    setCurrentSeed(lcg.currentSeed);
    setStepCounter(lcg.stepCount);
  };

  const handleResetSeed = () => {
    lcg.reset();
    setCurrentSeed(lcg.currentSeed);
    setStepCounter(0);
  };

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    sound.enabled = nextVal;
    if (nextVal) sound.playClick();
  };

  const handleLcgConfigChange = (
    presetId: string,
    customParams?: { m: bigint; a: bigint; c: bigint; seed: bigint }
  ) => {
    if (presetId === 'custom' && customParams) {
      lcg.setParameters(customParams.m, customParams.a, customParams.c, customParams.seed);
    } else {
      const preset = LCG_PRESETS.find((p) => p.id === presetId) || defaultPreset;
      lcg.setParameters(preset.m, preset.a, preset.c, preset.defaultSeed);
    }
    setCurrentSeed(lcg.currentSeed);
    setStepCounter(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar with 3 zones */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentSeed={currentSeed}
        onResetSeed={handleResetSeed}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Floating Quick Seed State Indicator */}
        <div className="mb-6 p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              {activeTab === 'gacha' ? '가챠 기본 엔진: MT19937 (메르센 트위스터)' : '현재 LCG 상태:'}
            </span>
            <span className="font-mono text-slate-200">
              {activeTab === 'gacha' ? '주기: 2¹⁹⁹³⁷ - 1 (624-word State)' : `Xₙ = ${currentSeed.toString()}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>누적 생성 스텝:</span>
            <span className="font-mono text-cyan-300 font-semibold">{stepCounter}회</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            {activeTab === 'gacha' ? (
              <span>서버급 32비트 난수 템퍼링 알고리즘 (Period ≈ 4.3×10⁶⁰⁰¹)</span>
            ) : (
              <>
                <span>m={lcg.m.toString().slice(0, 10)}...</span>
                <span aria-hidden="true">/</span>
                <span>a={lcg.a.toString().slice(0, 8)}...</span>
                <span aria-hidden="true">/</span>
                <span>c={lcg.c.toString().slice(0, 8)}...</span>
              </>
            )}
          </div>
        </div>

        {/* Tab Modules */}
        {activeTab === 'gacha' && (
          <GachaSystem lcg={lcg} onLcgStep={handleLcgStep} />
        )}

        {activeTab === 'forge' && (
          <EquipmentForge lcg={lcg} onLcgStep={handleLcgStep} />
        )}

        {activeTab === 'combat' && (
          <BattleSimulator lcg={lcg} onLcgStep={handleLcgStep} />
        )}

        {activeTab === 'lab' && (
          <LcgLab
            lcg={lcg}
            onLcgConfigChange={handleLcgConfigChange}
            onLcgStep={handleLcgStep}
          />
        )}
      </main>

      {/* Clean quiet footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            선형 합동법(Linear Congruential Generator, LCG) 게임 확률 및 난수 분석 시스템
          </div>
          <div className="font-mono text-[11px] text-slate-600">
            X_{'{n+1}'} = (a · X_n + c) mod m
          </div>
        </div>
      </footer>
    </div>
  );
}
