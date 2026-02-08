import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { IkimonoSvg } from './IkimonoSvg';
import { calculateStage, createNewIkimonoState } from './lifecycle';
import { getOpenHitokoto, shouldShowHitokotoOnOpen, getTapHitokoto } from './hitokoto';
import { ikimonoStorage } from '../../utils/storage';
import { IkimonoState, IkimonoStage } from './types';

interface IkimonoProps {
    profileId: string;
}

// ステージごとの揺れの強さ（存在感の違い）
const STAGE_SWAY: Record<string, { rotate: number; y: number; duration: number }> = {
    egg:      { rotate: 0,   y: 3,  duration: 5 },    // たまごは回転しない、ほんの少し浮沈
    hatching: { rotate: 0.8, y: 4,  duration: 4.5 },  // ほんのり揺れ始め
    small:    { rotate: 1.2, y: 5,  duration: 4 },    // 小さく元気に
    medium:   { rotate: 1.5, y: 4,  duration: 5 },    // 少し落ち着き
    adult:    { rotate: 1,   y: 3,  duration: 6 },    // ゆったり
    fading:   { rotate: 0.5, y: 2,  duration: 8 },    // とても静かに
};

// タップ時のリアクションパターン
type TapReaction = 'hitokoto' | 'bounce' | 'spin' | 'wiggle' | 'nod';

function pickTapReaction(stage: IkimonoStage): TapReaction {
    const r = Math.random();
    if (stage === 'egg') {
        // たまごは動きのみ（ことばがない）
        if (r < 0.5) return 'wiggle';
        return 'bounce';
    }
    // 生まれてからはひとことが多め
    if (r < 0.4) return 'hitokoto';
    if (r < 0.6) return 'bounce';
    if (r < 0.75) return 'wiggle';
    if (r < 0.9) return 'nod';
    return 'spin';
}

export const Ikimono: React.FC<IkimonoProps> = ({ profileId }) => {
    const [hitokoto, setHitokoto] = useState<string | null>(null);
    const controls = useAnimationControls();
    const openHitokotoShown = useRef(false);
    const hitokotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isReacting = useRef(false);

    // いきもの状態の読み込み・初期化
    const getOrCreateState = useCallback((): IkimonoState => {
        const stored = ikimonoStorage.getState();
        if (stored && stored.profileId === profileId) {
            const { stage } = calculateStage(stored.birthDate);
            if (stage === 'gone') {
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

    const state = getOrCreateState();
    const { stage, fadeOpacity } = calculateStage(state.birthDate);
    const sway = STAGE_SWAY[stage] || STAGE_SWAY.egg;

    // ──── 常時アニメーション：呼吸するような浮遊 ────
    useEffect(() => {
        if (stage === 'gone') return;
        controls.start({
            y: [0, -sway.y, 0, -sway.y * 0.5, 0],
            rotate: [0, sway.rotate, 0, -sway.rotate, 0],
            transition: {
                duration: sway.duration,
                repeat: Infinity,
                ease: 'easeInOut',
            },
        });
    }, [stage, controls, sway.y, sway.rotate, sway.duration]);

    // ──── 起動時ひとこと ────
    useEffect(() => {
        if (openHitokotoShown.current) return;
        openHitokotoShown.current = true;

        if (stage !== 'egg' && shouldShowHitokotoOnOpen()) {
            const timer = setTimeout(() => {
                showHitokoto(getOpenHitokoto());
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [stage]);

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

        switch (reaction) {
            case 'hitokoto':
                showHitokoto(getTapHitokoto());
                // ひとことと一緒に小さく動く
                await controls.start({
                    scale: [1, 1.05, 1],
                    transition: { duration: 0.3 },
                });
                break;

            case 'bounce':
                await controls.start({
                    y: [0, -15, 0],
                    transition: { duration: 0.4, ease: 'easeOut' },
                });
                break;

            case 'spin':
                await controls.start({
                    rotate: [0, 10, -10, 5, 0],
                    transition: { duration: 0.5 },
                });
                break;

            case 'wiggle':
                await controls.start({
                    x: [0, -5, 5, -3, 3, 0],
                    transition: { duration: 0.4 },
                });
                break;

            case 'nod':
                await controls.start({
                    y: [0, 5, -2, 0],
                    transition: { duration: 0.35, ease: 'easeOut' },
                });
                break;
        }

        // 常時アニメーションを再開
        controls.start({
            y: [0, -sway.y, 0, -sway.y * 0.5, 0],
            rotate: [0, sway.rotate, 0, -sway.rotate, 0],
            transition: {
                duration: sway.duration,
                repeat: Infinity,
                ease: 'easeInOut',
            },
        });

        isReacting.current = false;
    };

    // ──── クリーンアップ ────
    useEffect(() => {
        return () => {
            if (hitokotoTimer.current) clearTimeout(hitokotoTimer.current);
        };
    }, []);

    if (stage === 'gone') return null;

    return (
        <div className="flex flex-col items-center select-none">
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
        </div>
    );
};
