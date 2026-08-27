/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Crosshair,
  RotateCcw,
  Shield,
  Zap,
  Terminal,
  Play,
  Pause,
  Home,
  BookOpen,
  MapPin,
  AlertTriangle,
  Flame,
  Globe,
  Languages,
} from 'lucide-react';
import { Language, translations } from './translations';

interface PrologueScreenProps {
  onSkip: () => void;
  lang: Language;
  onToggleLang: () => void;
}

const PrologueScreen: React.FC<PrologueScreenProps> = ({ onSkip, lang, onToggleLang }) => {
  const [canSkip, setCanSkip] = useState(false);
  const t = translations[lang];

  useEffect(() => {
    const timer = setTimeout(() => {
      setCanSkip(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const handleSkip = useCallback(() => {
    if (canSkip) {
      onSkip();
    }
  }, [canSkip, onSkip]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSkip]);

  return (
    <div className="fixed inset-0 z-50 bg-[#04100a] text-[#00FF66] overflow-y-auto flex flex-col items-center">
      {/* Top Bar with Language Switcher */}
      <div className="w-full max-w-2xl px-6 pt-6 flex justify-end z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLang();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black/60 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] text-xs font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(0,255,102,0.2)]"
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? 'English' : '中文'}</span>
        </button>
      </div>

      {/* Centered Scrollable Column */}
      <div className="w-full max-w-2xl px-6 py-6 pb-12 my-auto flex flex-col items-center text-center">
        {/* Main Title */}
        <div className="w-full border-b border-[#00FF66]/30 pb-4 mb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-widest text-white text-center">
            {t.prologue.title}
          </h1>
        </div>

        {/* Narrative Prose with Atomic Word Grouping and Centered Flow */}
        <div className="w-full text-base md:text-lg leading-loose text-gray-300 text-center">
          <p className="w-full text-center mb-8 leading-loose">
            {t.prologue.p1.map((phrase, i) => (
              <span key={i} className="inline-block mx-0.5">{phrase}</span>
            ))}
          </p>

          <p className="w-full text-center mb-8 leading-loose">
            {t.prologue.p2.map((phrase, i) => (
              <span key={i} className="inline-block mx-0.5">{phrase}</span>
            ))}
          </p>

          <p className="w-full text-center mb-8 leading-loose">
            {t.prologue.p3.map((phrase, i) => (
              <span key={i} className="inline-block mx-0.5">{phrase}</span>
            ))}
          </p>

          <p className="w-full text-center mb-8 leading-loose">
            {t.prologue.p4.map((phrase, i) => (
              <span key={i} className="inline-block mx-0.5">{phrase}</span>
            ))}
          </p>

          <p className="w-full text-center mb-8 leading-loose">
            {t.prologue.p5.map((phrase, i) => (
              <span key={i} className="inline-block mx-0.5">{phrase}</span>
            ))}
          </p>

          <p className="w-full text-center mb-8 leading-loose">
            {t.prologue.p6.map((phrase, i) => (
              <span key={i} className="inline-block mx-0.5">{phrase}</span>
            ))}
          </p>

          <p className="w-full text-center mb-8 leading-loose">
            {t.prologue.p7.map((phrase, i) => (
              <span key={i} className="inline-block mx-0.5">{phrase}</span>
            ))}
          </p>

          <div className="w-full pt-6 border-t border-[#00FF66]/20 mb-8 text-center">
            <p className="w-full text-[#00FF66] font-bold text-lg md:text-xl leading-relaxed text-center">
              {t.prologue.quote.map((phrase, i) => (
                <span key={i} className="inline-block mx-0.5">{phrase}</span>
              ))}
            </p>
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="w-full pt-6 border-t border-[#00FF66]/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-center">
          <span className="text-xs md:text-sm text-gray-400 animate-pulse">
            {t.prologue.skipTip}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSkip();
            }}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#00FF66] hover:bg-[#00FF66]/80 text-black font-extrabold text-sm md:text-base tracking-wider rounded transition-all cursor-pointer border border-[#00FF66] min-h-[44px]"
          >
            {t.prologue.enterBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('game_language');
    return (saved === 'en' || saved === 'zh') ? saved : 'zh';
  });

  const [viewState, setViewState] = useState<'menu' | 'prologue' | 'playing'>('menu');
  const [isPaused, setIsPaused] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [activeWeapon, setActiveWeapon] = useState<number>(1);
  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number>(0);

  // Sync view state with global engine
  useEffect(() => {
    (window as any).__viewState = viewState;
    if (viewState !== 'playing') {
      if (typeof (window as any).togglePause === 'function') {
        (window as any).togglePause(true);
      }
      setIsPaused(true);
    }
  }, [viewState]);

  // Sync language with global engine state
  useEffect(() => {
    localStorage.setItem('game_language', lang);
    (window as any).__gameLang = lang;
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  const t = translations[lang];

  useEffect(() => {
    let isMounted = true;

    // Register global listener for engine pause state changes
    (window as any).onGamePauseChange = (paused: boolean) => {
      if (isMounted) setIsPaused(paused);
    };

    const checkEngineReady = () => {
      if (typeof (window as any).resetGame === 'function') {
        if (isMounted) {
          setGameLoaded(true);
          // Keep game paused on main menu initially
          if (typeof (window as any).togglePause === 'function') {
            (window as any).togglePause(true);
          }
        }
      } else {
        setTimeout(checkEngineReady, 50);
      }
    };
    checkEngineReady();

    return () => {
      isMounted = false;
      delete (window as any).onGamePauseChange;
    };
  }, []);

  const handleStartGame = (bypassPrologue: boolean | any = false) => {
    if (bypassPrologue !== true) {
      (window as any).__viewState = 'prologue';
      setViewState('prologue');
      if (typeof (window as any).togglePause === 'function') {
        (window as any).togglePause(true);
      }
      setIsPaused(true);
      return;
    }

    (window as any).__viewState = 'playing';
    setViewState('playing');
    const lm = (window as any).levelManager;
    if (lm) {
      lm.currentIndex = selectedLevelIndex;
    }
    if (typeof (window as any).resizeCanvas === 'function') {
      (window as any).resizeCanvas();
    }
    if (typeof (window as any).resetGame === 'function') {
      (window as any).resetGame();
    }
    if (typeof (window as any).togglePause === 'function') {
      (window as any).togglePause(false);
    }
    setIsPaused(false);
  };

  const handleTogglePause = () => {
    if (typeof (window as any).togglePause === 'function') {
      const newState = (window as any).togglePause();
      setIsPaused(newState);
    } else {
      setIsPaused(!isPaused);
    }
  };

  const handleRestart = () => {
    if (typeof (window as any).resetGame === 'function') {
      (window as any).resetGame();
      setIsPaused(false);
    }
  };

  const handleReturnToMenu = () => {
    (window as any).__viewState = 'menu';
    if (typeof (window as any).togglePause === 'function') {
      (window as any).togglePause(true);
    }
    setIsPaused(true);
    setViewState('menu');
  };

  const handleSelectWeapon = (id: number) => {
    setActiveWeapon(id);
    if (typeof (window as any).switchWeapon === 'function') {
      const weaponMap: Record<number, any> = {
        1: (window as any).WEAPONS?.RIFLE,
        2: (window as any).WEAPONS?.PISTOL,
        3: (window as any).WEAPONS?.SMG,
        4: (window as any).WEAPONS?.SNIPER,
        5: (window as any).WEAPONS?.GRENADE,
      };
      if (weaponMap[id]) {
        (window as any).switchWeapon(weaponMap[id]);
      }
    }
  };

  const handleSelectLevel = (index: number) => {
    setSelectedLevelIndex(index);
    const lm = (window as any).levelManager;
    if (lm) {
      lm.currentIndex = index;
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#020403] text-[#00FF66] font-mono select-none">
      {/* HUD Bar (Top Right Controls in Playing Mode) */}
      {viewState === 'playing' && (
        <div className="absolute top-3 right-5 z-30 flex items-center gap-1.5 bg-black/80 backdrop-blur border border-[#00FF66]/40 px-2 py-1.5 rounded text-xs shadow-lg shadow-[#00FF66]/10">
          {/* Quick Weapon Selection */}
          <div className="hidden lg:flex items-center gap-1 pr-1.5 border-r border-[#00FF66]/20 my-0.5">
            {[
              { id: 1, name: t.weapons.rifle },
              { id: 2, name: t.weapons.pistol },
              { id: 3, name: t.weapons.smg },
              { id: 4, name: t.weapons.sniper },
              { id: 5, name: t.weapons.grenade },
            ].map((wp) => (
              <button
                key={wp.id}
                onClick={() => handleSelectWeapon(wp.id)}
                className={`px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                  activeWeapon === wp.id
                    ? 'bg-[#00FF66] text-black font-bold'
                    : 'hover:bg-[#00FF66]/20 text-[#00FF66]'
                }`}
              >
                {wp.name}
              </button>
            ))}
          </div>

          {/* Language Toggle in Top Right */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#00FF66]/10 hover:bg-[#00FF66]/25 border border-[#00FF66]/40 transition-all text-[#00FF66] font-bold cursor-pointer text-xs"
            title={lang === 'zh' ? 'Switch to English' : '切换为中文'}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t.hudLang}</span>
          </button>

          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/30 transition-all text-[#00FF66] cursor-pointer text-xs"
            title={lang === 'zh' ? '查看操作指南' : 'How to Play'}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t.hudGuide}</span>
          </button>

          <button
            onClick={() => {
              if (typeof (window as any).togglePause === 'function') {
                (window as any).togglePause(true);
              }
              setShowLevelSelect(true);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/30 transition-all text-[#00FF66] cursor-pointer text-xs"
            title={lang === 'zh' ? '选择关卡' : 'Select Level'}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{t.hudSector}</span>
          </button>

          <button
            onClick={handleTogglePause}
            className={`flex items-center gap-1 px-2 py-1 rounded border transition-all font-bold cursor-pointer text-xs ${
              isPaused
                ? 'bg-[#FFCC00]/20 hover:bg-[#FFCC00]/40 border-[#FFCC00] text-[#FFCC00]'
                : 'bg-[#00FF66]/15 hover:bg-[#00FF66]/30 border-[#00FF66]/50 text-[#00FF66]'
            }`}
            title={lang === 'zh' ? '暂停/恢复 (ESC/P)' : 'Pause/Resume (ESC/P)'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? t.hudResume : t.hudPause}</span>
          </button>

          <button
            onClick={handleRestart}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#FF3344]/20 hover:bg-[#FF3344]/40 border border-[#FF3344]/50 text-[#FF3344] transition-all font-bold cursor-pointer text-xs"
            title={lang === 'zh' ? '重置关卡 (R)' : 'Restart (R)'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.hudRestart}</span>
          </button>

          <button
            onClick={handleReturnToMenu}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/20 text-gray-300 transition-all cursor-pointer text-xs"
            title={lang === 'zh' ? '返回主菜单' : 'Main Menu'}
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t.hudMenu}</span>
          </button>
        </div>
      )}

      {/* Main Cover / Menu Overlay */}
      {viewState === 'menu' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-[#020403] backdrop-blur-md">
          {/* Top Right Language Switcher on Main Menu */}
          <div className="absolute top-6 right-6">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3.5 py-2 rounded bg-black/60 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] text-xs font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.15)]"
            >
              <Globe className="w-4 h-4" />
              <span>{lang === 'zh' ? 'English' : '中文'}</span>
            </button>
          </div>

          {/* Center Container */}
          <div className="max-w-md w-full flex flex-col items-center justify-center text-center my-auto">
            {/* Title: 视界滞后 / Observation Lag */}
            <div className="mb-10 select-none">
              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-widest text-[#00FF66] drop-shadow-[0_0_20px_rgba(0,255,102,0.6)]">
                {t.gameTitle}
              </h1>
            </div>

            {/* Menu Buttons */}
            <div className="w-full space-y-3.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartGame(false);
                }}
                className="w-full py-3.5 px-6 bg-[#00FF66] text-black font-extrabold text-base rounded border border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.3)] hover:bg-[#00FF66]/80 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-black" />
                <span>{t.startMission}</span>
              </button>

              <button
                onClick={() => setShowTutorial(true)}
                className="w-full py-3 px-4 bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] font-bold text-sm rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>{t.tacticalManual}</span>
              </button>

              <button
                onClick={() => setShowLevelSelect(true)}
                className="w-full py-3 px-4 bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] font-bold text-sm rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                <span>{t.sectorSelect}</span>
              </button>

              {/* Language Switcher Button in Main Menu */}
              <button
                onClick={toggleLanguage}
                className="w-full py-2.5 px-4 bg-black/40 hover:bg-[#00FF66]/15 border border-[#00FF66]/30 text-gray-300 hover:text-[#00FF66] font-bold text-xs rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Languages className="w-4 h-4 text-[#00FF66]" />
                <span>
                  {t.languageSelect}: <strong className="text-[#00FF66]">{lang === 'zh' ? '简体中文' : 'English'}</strong>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prologue / Introduction Overlay */}
      {viewState === 'prologue' && (
        <PrologueScreen
          onSkip={() => handleStartGame(true)}
          lang={lang}
          onToggleLang={toggleLanguage}
        />
      )}

      {/* Pause Menu Overlay */}
      {isPaused && viewState === 'playing' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div
            className="max-w-md w-full bg-[#030d07] border border-[#00FF66] p-8 rounded shadow-[0_0_20px_rgba(0,255,102,0.15)] text-center relative flex flex-col items-center justify-center"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#00FF66] tracking-widest mb-6 drop-shadow-[0_0_12px_rgba(0,255,102,0.5)]">
              {t.tacticalPause}
            </h2>

            <div className="w-full space-y-3">
              <button
                onClick={() => handleTogglePause()}
                className="w-full py-3 bg-[#00FF66] text-black font-extrabold text-sm rounded hover:bg-[#00FF66]/80 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>{t.resumeMission}</span>
              </button>

              <button
                onClick={handleRestart}
                className="w-full py-2.5 bg-[#FF3344]/20 border border-[#FF3344]/50 text-[#FF3344] hover:bg-[#FF3344]/30 font-bold text-sm rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.restartMission}</span>
              </button>

              <button
                onClick={() => setShowTutorial(true)}
                className="w-full py-2.5 bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] hover:bg-[#00FF66]/20 font-bold text-xs rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>{t.tacticalManual}</span>
              </button>

              {/* Language Switcher in Pause Menu */}
              <button
                onClick={toggleLanguage}
                className="w-full py-2.5 bg-black/40 hover:bg-[#00FF66]/15 border border-[#00FF66]/30 text-gray-300 hover:text-[#00FF66] font-bold text-xs rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Languages className="w-4 h-4 text-[#00CCFF]" />
                <span>
                  {t.languageSelect}: <strong className="text-[#00FF66]">{lang === 'zh' ? '简体中文' : 'English'}</strong>
                </span>
              </button>

              <button
                onClick={handleReturnToMenu}
                className="w-full py-2.5 bg-white/5 border border-white/20 text-gray-300 hover:bg-white/10 font-bold text-xs rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>{t.returnToMenu}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level Select Modal */}
      {showLevelSelect && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="max-w-lg w-full bg-[#030d07] border border-[#00FF66] p-6 rounded shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#00FF66]/30 pb-3">
              <h3 className="text-sm font-bold text-[#00FF66] flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {t.levelSelect.title}
              </h3>
              <button
                onClick={() => setShowLevelSelect(false)}
                className="text-gray-400 hover:text-white font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {t.levelSelect.levels.map((lvl, idx) => {
                const isSelected = selectedLevelIndex === idx;
                return (
                  <div
                    key={lvl.id}
                    onClick={() => handleSelectLevel(idx)}
                    className={`p-4 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#00FF66]/15 border-[#00FF66] shadow-md shadow-[#00FF66]/10'
                        : 'bg-black/40 border-[#00FF66]/20 hover:border-[#00FF66]/60'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-white">
                        {lvl.title}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#00FF66]/20 text-[#00FF66]">
                        {lvl.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">
                      {lvl.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowLevelSelect(false);
                  handleStartGame(true); // Bypass prologue for level select
                }}
                className="px-5 py-2 bg-[#00FF66] text-black font-bold text-xs rounded hover:bg-[#00FF66]/80 transition-colors cursor-pointer"
              >
                {t.levelSelect.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial (How to Play) Modal */}
      {showTutorial && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="max-w-3xl w-full bg-[#030e07] border border-[#00FF66] p-6 rounded shadow-2xl space-y-4 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#00FF66]/30 pb-3">
              <h3 className="text-sm font-bold text-[#00FF66] flex items-center gap-2">
                <Terminal className="w-4 h-4" /> {t.tutorial.title}
              </h3>
              <button
                onClick={() => setShowTutorial(false)}
                className="text-gray-400 hover:text-white font-bold text-base cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            {/* Top Row: Basic Controls (Green) & Armor (Blue) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-[#00FF66]/5 border border-[#00FF66]/25 rounded space-y-1 text-xs">
                <div className="font-bold text-[#00FF66] flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" /> {t.tutorial.moveAimTitle}
                </div>
                <p className="text-gray-300">
                  {t.tutorial.moveAimDesc1}
                </p>
                <p className="text-gray-300">
                  {t.tutorial.moveAimDesc2}
                </p>
              </div>

              <div className="p-3 bg-[#00FF66]/5 border border-[#00FF66]/25 rounded space-y-1 text-xs">
                <div className="font-bold text-[#00FF66] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> {t.tutorial.weaponsTitle}
                </div>
                <p className="text-gray-300">
                  {t.tutorial.weaponsDesc1}
                </p>
                <p className="text-gray-300">
                  {t.tutorial.weaponsDesc2}
                </p>
              </div>

              <div className="p-3 bg-[#00CCFF]/5 border border-[#00CCFF]/30 rounded space-y-1 text-xs">
                <div className="font-bold text-[#00CCFF] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> {t.tutorial.armorTitle}
                </div>
                <p className="text-gray-300">
                  {t.tutorial.armorDesc1}
                </p>
                <p className="text-gray-300">
                  {t.tutorial.armorDesc2}
                </p>
              </div>
            </div>

            {/* Middle Row: Blind Zone System (Yellow) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-[#FFCC00]/5 border border-[#FFCC00]/30 rounded space-y-1 text-xs">
                <div className="font-bold text-[#FFCC00] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> {t.tutorial.blindTeleportTitle}
                </div>
                <p className="text-gray-300">
                  {t.tutorial.blindTeleportDesc1}
                </p>
                <p className="text-gray-300">
                  {t.tutorial.blindTeleportDesc2}
                </p>
              </div>

              <div className="p-3 bg-[#FFCC00]/5 border border-[#FFCC00]/30 rounded space-y-1 text-xs">
                <div className="font-bold text-[#FFCC00] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t.tutorial.blindDamageTitle}
                </div>
                <p className="text-gray-300">
                  {t.tutorial.blindDamageDesc}
                </p>
              </div>

              <div className="p-3 bg-[#FFCC00]/5 border border-[#FFCC00]/30 rounded space-y-1 text-xs">
                <div className="font-bold text-[#FFCC00] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> {t.tutorial.trapTitle}
                </div>
                <p className="text-gray-300">
                  {t.tutorial.trapDesc}
                </p>
              </div>
            </div>

            {/* Killstreak Rewards (Orange) */}
            <div className="p-3 bg-[#FF8800]/5 border border-[#FF8800]/30 rounded space-y-2 text-xs">
              <div className="font-bold text-[#FF8800] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> {t.tutorial.killstreakTitle}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="p-2.5 bg-black/40 border border-[#FF8800]/20 rounded space-y-1">
                  <div className="font-bold text-[#FF8800]">{t.tutorial.killstreak3Title}</div>
                  <div className="text-gray-300">{t.tutorial.killstreak3Desc}</div>
                </div>
                <div className="p-2.5 bg-black/40 border border-[#FF8800]/20 rounded space-y-1">
                  <div className="font-bold text-[#FF8800]">{t.tutorial.killstreak5Title}</div>
                  <div className="text-gray-300">{t.tutorial.killstreak5Desc}</div>
                </div>
                <div className="p-2.5 bg-black/40 border border-[#FF8800]/20 rounded space-y-1">
                  <div className="font-bold text-[#FF8800]">{t.tutorial.killstreak7Title}</div>
                  <div className="text-gray-300">{t.tutorial.killstreak7Desc}</div>
                </div>
              </div>
            </div>

            {/* Enemies & Cover Mechanics (Red) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#FF4455]/5 border border-[#FF4455]/30 rounded space-y-1">
                <div className="font-bold text-[#FF4455] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t.tutorial.observerTitle}
                </div>
                <p className="text-gray-300">
                  {t.tutorial.observerDesc}
                </p>
              </div>

              <div className="p-3 bg-[#FF4455]/5 border border-[#FF4455]/30 rounded space-y-1">
                <div className="font-bold text-[#FF4455] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> {t.tutorial.coverTitle}
                </div>
                <p className="text-gray-300">
                  {t.tutorial.coverGlassDesc}
                </p>
                <p className="text-gray-300">
                  {t.tutorial.coverLowWallDesc}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowTutorial(false)}
              className="w-full py-2.5 bg-[#00FF66] text-black font-bold rounded hover:bg-[#00FF66]/80 transition-colors cursor-pointer text-xs"
            >
              {t.tutorial.backBtn}
            </button>
          </div>
        </div>
      )}

      {/* Game Engine Container */}
      <div id="game-container" className="relative w-full h-full">
        {/* HUD Overlay */}
        <div className="hud-overlay">
          <div className="status-box">
            <div>{t.hpLabel}</div>
            <div className="bar-outer">
              <div className="bar-inner" id="player-hp-bar"></div>
            </div>

            <div style={{ marginTop: '6px' }}>{t.armorLabel}</div>
            <div className="bar-outer">
              <div className="bar-inner shield" id="player-shield-bar"></div>
            </div>

            <div style={{ marginTop: '6px' }} id="blind-label">
              {t.blindEnergyLabel}
            </div>
            <div className="bar-outer">
              <div className="bar-inner blind" id="blind-energy-bar"></div>
            </div>
          </div>

          <div
            className="status-box right-status"
            style={{ textAlign: 'right' }}
          >
            <div id="wave-title">{lang === 'zh' ? '波次: 1' : 'Wave: 1'}</div>
            <div id="enemies-left" style={{ color: '#FF3344', marginTop: '4px' }}>
              {lang === 'zh' ? '剩余敌人: 0' : 'Enemies: 0'}
            </div>
            <div id="score-count" style={{ marginTop: '4px', color: '#88FFBB' }}>
              {lang === 'zh' ? '击杀数: 0' : 'Kills: 0'}
            </div>
          </div>
        </div>

        {/* Alarm Banner */}
        <div id="alarm-banner">{t.alarmBanner}</div>

        {/* Game Over Screen */}
        <div id="game-over-screen">
          <h1 id="over-title">{t.missionFailed}</h1>
          <p id="over-desc">{lang === 'zh' ? '特工在行动中阵亡' : 'Operative eliminated in action'}</p>
          <button className="restart-btn" onClick={handleRestart}>
            {t.restartBtn}
          </button>
        </div>

        {/* Game Canvas */}
        <canvas id="canvas"></canvas>

        {/* Tactical Log Panel */}
        <div className="log-panel" id="log-panel">
          <div>&gt; {lang === 'zh' ? '战术行动已就绪' : 'Tactical operation ready'}</div>
        </div>
      </div>
    </div>
  );
}
