import type { Dispatch, SetStateAction } from 'react';
import type { IslandStageProps as StageProps } from './three/types';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandScreen } from '../../domain/island/navigation';
import type { IslandItem } from '../../domain/island/types';
import type { useIslandTutorial } from './tutorial/useIslandTutorial';

type Setter<T> = Dispatch<SetStateAction<T>>;
export type PlayStageBindings = Pick<StageProps, 'playRequest' | 'onRendererRecovered' | 'onPlayResult' | 'onItemSelect'>;
type Inputs = { screen: IslandScreen; island: IslandRecord;
    busy: boolean; learning: boolean; playRequest: StageProps['playRequest']; photoTargetId: string;
    tutorial: ReturnType<typeof useIslandTutorial>; setPlayMessage: Setter<string | undefined>;
    setWorkshopRequest: Setter<StageProps['workshopRequest']>; setSharedRequest: Setter<StageProps['sharedRequest']>;
    play: (id: string) => void; select: (item: IslandItem) => void;
};

const RENDERER_RECOVERY_HINT = '「もういちど みる」で、しまを ひらこう。';

function sharingHint(items: IslandItem[], selectedId: string) {
    const selected = items.find(item => item.id === selectedId);
    if (!selected) return undefined;
    const pair = [
        { kinds: ['flower', 'bench'], hint: 'ベンチの まえに おはなを おくと…？' },
        { kinds: ['lantern', 'mushroom'], hint: 'きのこの いすの まえに あかりを おくと…？' },
        { kinds: ['fountain', 'swing'], hint: 'ブランコの まえに ふんすいを おくと…？' },
    ].find(pair => pair.kinds.includes(selected.kind) && pair.kinds.every(kind => items.some(item => item.kind === kind)));
    return pair?.hint;
}


export function islandSessionPlayStage({ screen, island, busy, learning, playRequest, photoTargetId,
    tutorial, setPlayMessage, setWorkshopRequest, setSharedRequest, play, select }: Inputs): PlayStageBindings {
    return {
        playRequest: screen === 'play' || screen === 'furniture' && !busy || screen === 'camera' && photoTargetId === 'current' ? playRequest : undefined,
        onRendererRecovered: () => { setPlayMessage(message => message === RENDERER_RECOVERY_HINT ? undefined : message); setWorkshopRequest(undefined); setSharedRequest(undefined); },
        onPlayResult: result => {
            if (result.requestId !== playRequest?.id) return;
            if (result.status === 'playing') tutorial.practice('play');
            if (screen === 'furniture') {
                setPlayMessage(result.status === 'playing' ? 'なかまと ためしているよ。'
                    : result.reason === 'renderer' ? RENDERER_RECOVERY_HINT
                        : result.reason === 'resident-unavailable' || result.reason === 'partner-unavailable' ? 'いま こられる なかまを えらんでみよう。'
                            : 'どうぐの まわりに、とおれる すきまを あけてみよう。');
                return;
            }
            setPlayMessage(result.status === 'blocked' ? 'どうぶつが とおれる すきまを あけて みよう。'
                : result.status === 'unavailable' ? (result.reason === 'renderer' ? RENDERER_RECOVERY_HINT : 'もちものから しまに おいて、あそぼう。')
                    : result.activity ? (result.activity === 'flower' ? 'おはなを おすそわけ。' : result.activity === 'star' ? 'ほしの ひかりを おすそわけ。'
                        : result.activity === 'bubble' ? 'みずたまを おすそわけ。' : 'なかまと ためしているよ。')
                        : sharingHint(island.items, result.itemId) ?? 'ほかの ばしょも えらべるよ。');
            },
        onItemSelect: !learning && !busy && !['customization', 'guide', 'growth', 'experience', 'expression', 'showcase', 'workshop', 'camera', 'photos', 'shared', 'furniture', 'keepsakes'].includes(screen) ? id => {
            if (screen === 'play') play(id);
            else { const item = island.items.find(candidate => candidate.id === id); if (item) select(item); }
            } : undefined,
    };
}
