import { useCallback, useEffect, useRef, useState } from 'react';
import type { IslandScreen } from '../../../domain/island/navigation';
import { nextTutorial, recordTutorialEvent, tutorialKey, tutorialWasSeen, type TutorialId } from '../../../domain/island/tutorialState';

interface Selection { id: TutorialId; screen: IslandScreen; manual: boolean }
export function useIslandTutorial({ profileId, eligible, screen, active, allowed, grown, canView }: {
    profileId: string; eligible: boolean; screen: IslandScreen; active: boolean; allowed: boolean; grown: boolean; canView: boolean;
}) {
    const [selection, setSelection] = useState<Selection>();
    const [visible, setVisible] = useState(() => !document.hidden);
    const visit = useRef({ screen, active, spent: false });
    const manual = useRef<Selection | undefined>(undefined);
    useEffect(() => {
        const changed = () => { setVisible(!document.hidden); if (document.hidden) { setSelection(undefined); manual.current = undefined; } };
        document.addEventListener('visibilitychange', changed);
        return () => document.removeEventListener('visibilitychange', changed);
    }, []);
    useEffect(() => {
        if (visit.current.screen !== screen || visit.current.active !== active) {
            visit.current = { screen, active, spent: false };
            setSelection(undefined);
        }
        if (manual.current && screen !== manual.current.screen && screen !== 'help') manual.current = undefined;
        if (!active || !visible) { setSelection(undefined); return; }
        // A short background save suspends this same hint; it must not consume
        // the visit before the child can see it. Navigation/visibility still retire it.
        if (!allowed) return;
        if (manual.current?.screen === screen) {
            setSelection(manual.current); manual.current = undefined; visit.current.spent = true; return;
        }
        if (visit.current.spent) return;
        const id = nextTutorial(screen, eligible, grown, canView, candidate => tutorialWasSeen(profileId, candidate));
        if (id) { visit.current.spent = true; setSelection({ id, screen, manual: false }); }
    }, [profileId, eligible, screen, active, allowed, grown, canView, visible]);
    useEffect(() => {
        const changed = (event: StorageEvent) => setSelection(current => current && !current.manual && event.newValue === '1'
            && (['shown', 'practiced', 'dismissed'] as const).some(kind => event.key === tutorialKey(profileId, current.id, kind)) ? undefined : current);
        window.addEventListener('storage', changed);
        return () => window.removeEventListener('storage', changed);
    }, [profileId]);
    const current = active && visible && allowed && selection?.screen === screen ? selection : undefined;
    const shown = useCallback(() => {
        if (current && !current.manual) recordTutorialEvent(profileId, current.id, 'shown');
    }, [profileId, current]);
    const finish = (event: 'practiced' | 'dismissed', id?: TutorialId) => {
        if (!current || id && current.id !== id) return;
        if (!current.manual) recordTutorialEvent(profileId, current.id, event);
        setSelection(undefined);
    };
    return { current, shown, dismiss: () => finish('dismissed'), practice: (id: TutorialId) => finish('practiced', id),
        start: (id: TutorialId, target: IslandScreen) => {
            manual.current = { id, screen: target, manual: true };
            if (target === screen) { setSelection(manual.current); manual.current = undefined; visit.current.spent = true; }
        } };
}
