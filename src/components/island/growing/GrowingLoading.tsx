import { IslandToyIcon } from '../IslandToyIcon';
import './growingLoading.css';

/**
 * Opening the island in named steps with a percentage. Each step is a real stage (data,
 * learning, the 3D world, the first picture); the number is the step's share, not bytes.
 */
export const LOADING_STEPS = {
    page: { percent: 10, label: 'しまの じゅんびを しているよ' },
    screen: { percent: 25, label: 'しまの がめんを よんでいるよ' },
    learning: { percent: 40, label: 'まなんだ ぶんを かぞえているよ' },
    saving: { percent: 55, label: 'しまの じかんを すすめているよ' },
    world: { percent: 70, label: 'しまを かいているよ' },
    scene: { percent: 88, label: 'なかまを よんでいるよ' },
} as const;
export type LoadingStep = keyof typeof LOADING_STEPS;

export function GrowingLoading({ step, overlay = false }: { step: LoadingStep; overlay?: boolean }) {
    const { percent, label } = LOADING_STEPS[step];
    return <div className={`growing-loading${overlay ? ' growing-loading--overlay' : ''}`} role="progressbar"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`しまを ひらいているよ ${percent}%`} data-loading-step={step}>
        <div className="growing-loading-card">
            <IslandToyIcon kind="island" size={54} />
            <p className="growing-loading-title">しまを ひらいているよ <strong>{percent}%</strong></p>
            <div className="growing-loading-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
            <p className="growing-loading-label">{label}</p>
        </div>
    </div>;
}
