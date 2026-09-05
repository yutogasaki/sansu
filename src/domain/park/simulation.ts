import type { PartKind } from './types';

export interface PlayBeat {
    from: number;
    to: number;
    action: 'walk' | 'slide' | 'hop' | 'jump' | 'bubble' | 'mat' | 'bell' | 'paint' | 'finish';
    bubble: boolean;
    fast: boolean;
    pink: boolean;
    bubblePink: boolean;
    popped: boolean;
    skipped?: number;
    caption: string;
}

/** Discrete deterministic rules. Rendering time and answer performance are never inputs. */
export function simulateCourse(layout: readonly (PartKind | null)[]): PlayBeat[] {
    const beats: PlayBeat[] = [];
    let momentum = false;
    let bubble = false;
    let pink = false;
    let bubblePink = false;
    let position = -1;
    const add = (to: number, action: PlayBeat['action'], caption: string, popped = false, skipped?: number) => {
        beats.push({ from: position, to, action, bubble, fast: momentum, pink, bubblePink, popped, skipped, caption });
        position = to;
    };
    for (let index = 0; index < layout.length; index++) {
        if (position !== index) add(index, 'walk', 'つぎの ばしょへ');
        const part = layout[index];
        if (part === 'slide') {
            momentum = true;
            add(index, 'slide', 'しゅーっ！ いきおいが ついた');
        } else if (part === 'trampoline') {
            const popped = bubble;
            if (momentum) {
                const landing = Math.min(index + 2, layout.length);
                add(landing, 'jump', popped ? 'あわと ジャンプ！ ちゃくちで ぱちん' : 'たかく ジャンプ！ ひとつ とびこした', popped,
                    index + 1 < layout.length ? index + 1 : undefined);
                momentum = false;
                bubble = false;
                index = landing - 1;
            } else {
                add(index, 'hop', popped ? 'ぽんっ。あわが はじけた' : 'そのばで ぽんっ', popped);
                bubble = false;
            }
        } else if (part === 'bubble') {
            bubble = true;
            bubblePink = pink;
            add(index, 'bubble', pink ? 'ももいろの あわが ついた' : 'あわが ついた');
        } else if (part === 'mat') {
            momentum = false;
            add(index, 'mat', 'ゆっくりに なった');
        } else if (part === 'bell') add(index, 'bell', 'ちりん！ ベルが なった');
        else if (part === 'paint') {
            pink = true;
            add(index, 'paint', 'ももいろに なった');
        }
    }
    add(layout.length, 'finish', bubble ? 'あわのまま ゴール' : 'ふんわり ゴール');
    return beats;
}
