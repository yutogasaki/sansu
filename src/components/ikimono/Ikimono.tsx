import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { IkimonoSvg } from './IkimonoSvg';
import { NameModal } from './NameModal';
import { calculateStage, createNewIkimonoState } from './lifecycle';
import { getOpenHitokoto, shouldShowHitokotoOnOpen, getTapHitokoto, getEggOpenHitokoto, getEggTapHitokoto } from './hitokoto';
import { getStageSway, pickTapReaction, playIdleMotion, playTapReaction } from './ikimonoMotion';
import { ikimonoStorage, ikimonoGalleryStorage } from '../../utils/storage';
import { IkimonoState } from './types';

interface IkimonoProps {
    profileId: string;
    kanjiMode?: boolean;
    statusText?: string;
}

export const Ikimono: React.FC<IkimonoProps> = ({ profileId, kanjiMode = false, statusText }) => {
    const [hitokoto, setHitokoto] = useState<string | null>(null);
    const [showNameModal, setShowNameModal] = useState(false);
    const [currentState, setCurrentState] = useState<IkimonoState | null>(null);
    const controls = useAnimationControls();
    const openHitokotoShown = useRef(false);
    const hitokotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const isReacting = useRef(false);
    const scriptMode = kanjiMode ? 'kanji' : 'kana';

    // いきもの状態の読み込み・初期化
    const getOrCreateState = useCallback((): IkimonoState => {
        const stored = ikimonoStorage.getState();
        if (stored && stored.profileId === profileId) {
            const { stage } = calculateStage(stored.birthDate);
            if (stage === 'gone') {
                // ギャラリーに保存してから次世代へ
                ikimonoGalleryStorage.add({
                    profileId: stored.profileId,
                    generation: stored.generation,
                    name: stored.name || "なまえなし",
                    birthDate: stored.birthDate,
                    departedDate: new Date().toISOString(),
                });
                const newState = createNewIkimonoState(profileId, stored.generation + 1);
                ikimonoStorage.setState(newState);
                return newState;
            }
            return stored;
        }
        const newState = createNewIkimonoState(profileId);
        ikimonoStorage.setState(newState);
        return newState;
    }, [profileId]);

    const state = currentState || getOrCreateState();
    const { stage, fadeOpacity } = calculateStage(state.birthDate);
    const sway = getStageSway(stage);

    // ──── 名前がまだない hatching 以降の子を検知 ────
    useEffect(() => {
        if (!state.name && stage !== 'egg' && stage !== 'gone') {
            setShowNameModal(true);
        }
    }, [state.name, stage]);

    const handleNameSubmit = (name: string) => {
        const updated = { ...state, name };
        ikimonoStorage.setState(updated);
        setCurrentState(updated);
        setShowNameModal(false);
    };

    // ──── 常時アニメーション：呼吸するような浮遊 ────
    const playIdle = useCallback(() => playIdleMotion(controls, sway), [controls, sway]);
    useEffect(() => {
        if (stage === 'gone') return;
        playIdle();
        if (idleTimer.current) clearInterval(idleTimer.current);
        idleTimer.current = setInterval(() => {
            if (!isReacting.current) playIdle();
        }, 4500 + Math.floor(Math.random() * 2500));
        return () => {
            if (idleTimer.current) clearInterval(idleTimer.current);
        };
    }, [stage, playIdle]);

    // ──── 起動時ひとこと ────
    useEffect(() => {
        if (openHitokotoShown.current) return;
        openHitokotoShown.current = true;

        if (stage === 'egg') {
            // たまごは初回起動時に必ずひとこと（何なのか伝える）
            const timer = setTimeout(() => {
                showHitokoto(getEggOpenHitokoto(scriptMode), 4000);
            }, 1500);
            return () => clearTimeout(timer);
        }

        if (shouldShowHitokotoOnOpen()) {
            const timer = setTimeout(() => {
                showHitokoto(getOpenHitokoto(scriptMode));
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [stage, scriptMode]);

    // ──── ひとこと表示 ────
    const showHitokoto = (text: string, duration = 3000) => {
        if (hitokotoTimer.current) clearTimeout(hitokotoTimer.current);
        setHitokoto(text);
        hitokotoTimer.current = setTimeout(() => setHitokoto(null), duration);
    };

    // ──── タップ時の反応 ────
    const handleTap = async () => {
        // ひとこと表示中にタップ → 消す
        if (hitokoto) {
            setHitokoto(null);
            if (hitokotoTimer.current) clearTimeout(hitokotoTimer.current);
            return;
        }

        // リアクション中は無視
        if (isReacting.current) return;
        isReacting.current = true;

        const reaction = pickTapReaction(stage);

        if (reaction === 'hitokoto') {
            showHitokoto(stage === 'egg' ? getEggTapHitokoto(scriptMode) : getTapHitokoto(scriptMode));
        }
        await playTapReaction(controls, reaction);

        if (Math.random() < 0.25 && reaction !== 'hitokoto') {
            showHitokoto(stage === 'egg' ? getEggTapHitokoto(scriptMode) : getTapHitokoto(scriptMode), 2200);
        }

        await playIdle();

        isReacting.current = false;
    };

    // ──── クリーンアップ ────
    useEffect(() => {
        return () => {
            if (hitokotoTimer.current) clearTimeout(hitokotoTimer.current);
            if (idleTimer.current) clearInterval(idleTimer.current);
        };
    }, []);

    if (stage === 'gone') return null;

    return (
        <div className="flex flex-col items-center select-none">
            {/* 名前入力モーダル */}
            {showNameModal && <NameModal onSubmit={handleNameSubmit} />}

            {/* ひとこと吹き出し */}
            <div className="h-14 flex items-end justify-center mb-1">
                <AnimatePresence>
                    {hitokoto && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="bg-white/90 backdrop-blur-sm px-5 py-2.5 rounded-2xl shadow-sm text-text-main text-base font-bold tracking-wide"
                        >
                            {hitokoto}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* いきもの本体 */}
            <motion.div
                className="w-64 h-64 land:w-48 land:h-48 cursor-pointer"
                style={{ opacity: fadeOpacity }}
                animate={controls}
                onClick={handleTap}
            >
                <IkimonoSvg stage={stage} />
            </motion.div>

            {/* 名前 + 状態表示（改行/折返し許可で重なり回避） */}
            {(state.name || statusText) && (
                <div className="mt-2 w-full max-w-xs px-2">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {state.name && (
                            <span className="inline-flex max-w-[11rem] items-center rounded-full bg-white/80 border border-white/90 px-3 py-1 text-xs font-black text-slate-600 truncate">
                                {state.name}
                            </span>
                        )}
                        {statusText && (
                            <span className="inline-flex max-w-[16rem] items-center rounded-full bg-cyan-50/90 border border-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700 truncate text-center">
                                {statusText}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
