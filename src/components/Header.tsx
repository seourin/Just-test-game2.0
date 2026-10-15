import React from 'react';
import { Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { sound } from '../lib/sound';

export type ActiveTab = 'gacha' | 'forge' | 'combat' | 'lab';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentSeed: bigint;
  onResetSeed: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  currentSeed,
  onResetSeed,
  soundEnabled,
  onToggleSound,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            게임 난수 확률 연구소
          </span>
          <span className="hidden lg:inline text-xs font-mono text-slate-500 tabular-nums">
            Seed: {currentSeed.toString().slice(0, 10)}...
          </span>
        </div>

        {/* Zone 2: 4 clean text navigation links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              sound.playClick();
              onTabChange('gacha');
            }}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap rounded-md ${
              activeTab === 'gacha'
                ? 'text-amber-300 bg-amber-950/60 border border-amber-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            아이템 가챠 (MT19937)
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onTabChange('forge');
            }}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap rounded-md ${
              activeTab === 'forge'
                ? 'text-amber-400 bg-amber-950/60 border border-amber-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            장비 강화 (LCG)
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onTabChange('combat');
            }}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap rounded-md ${
              activeTab === 'combat'
                ? 'text-rose-400 bg-rose-950/60 border border-rose-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            전투 확률
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onTabChange('lab');
            }}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap rounded-md ${
              activeTab === 'lab'
                ? 'text-indigo-400 bg-indigo-950/60 border border-indigo-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            수식 & 격자 검정
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              sound.playClick();
              onResetSeed();
            }}
            title="초기 시드로 리셋"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">시드 리셋</span>
          </button>
          <button
            onClick={onToggleSound}
            title={soundEnabled ? '효과음 끄기' : '효과음 켜기'}
            className="p-1.5 text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
