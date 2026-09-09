import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Camera, Hand, Move, PawPrint, Search, Sparkles, Sprout, X } from 'lucide-react';
import type { IslandScreen } from '../../../domain/island/navigation';
import type { IslandRecord } from '../../../domain/island/types';
import type { TutorialId } from '../../../domain/island/tutorialState';
import './IslandTutorial.css';
export const TUTORIAL_TOPICS = [
    { id: 'view', title: 'ながめる', text: 'しまを なぞって 移動。「ながめ」の ボタンでも 拡大・回転できるよ。', Icon: Hand, screen: 'home' },
    { id: 'growth', title: '学ぶと 育つ', text: 'もんだいを とくと、しまが 育つよ。とちゅうで やすんでも、育ったぶんは のこるよ。', Icon: Sprout, screen: 'growth' },
    { id: 'play', title: 'どうぶつと 遊ぶ', text: '遊びたい ものを えらんでみよう。どうぶつが みにいくよ。', Icon: PawPrint, screen: 'play' },
    { id: 'customization', title: 'きせかえ', text: 'ためすだけなら、ほしは へらないよ。ほしいものは「こうかんして つかう」で えらぼう。', Icon: Sparkles, screen: 'customization' },
    { id: 'discovery', title: 'みつける', text: '「てがかり」を みて、しまの ふしぎを さがそう。まだ 育っていない ばしょも、ここで わかるよ。', Icon: Search, screen: 'guide' },
    { id: 'photo', title: '写真を とる', text: 'すきな ながめを えらんで 写真にしよう。保存した 写真は、写真の たなで みられるよ。', Icon: Camera, screen: 'camera' },
    { id: 'placement', title: '家具を 動かす', text: 'もちものを えらんで、置く ばしょを 決めよう。やめるときは、とりけせるよ。', Icon: Move, screen: 'inventory' },
] as const satisfies ReadonlyArray<{ id: TutorialId; title: string; text: string; Icon: typeof Hand; screen: IslandScreen }>;
function tutorialUnavailable(id: TutorialId, island: IslandRecord) {
    if (id === 'play' && !island.items.some(item => item.position)) return 'もちものを しまに おくと、遊べるよ。';
    if (id === 'placement' && !island.items.length) return '学んで もちものを 手に入れると、動かせるよ。';
    return undefined;
}
export function IslandHelp({ island, disabled, onTry, onClose }: {
    island: IslandRecord; disabled: boolean; onTry: (id: TutorialId) => void; onClose: () => void;
}) {
    const [selected, setSelected] = useState<TutorialId>('view');
    const topic = TUTORIAL_TOPICS.find(topic => topic.id === selected)!;
    const unavailable = tutorialUnavailable(selected, island);
    return <section className="island-sheet island-help" aria-label="あそびかた">
        <div className="island-sheet-title"><h2><BookOpen size={22} aria-hidden="true" /> あそびかた</h2>
            <button className="island-text-button" onClick={onClose}><X size={20} />とじる</button></div>
        <p>知りたいことを えらんでね。</p>
        <div className="island-help-topics" role="group" aria-label="知りたいこと">
            {TUTORIAL_TOPICS.map(({ id, title, Icon }) => <button key={id} className="island-secondary" aria-pressed={id === selected} onClick={() => setSelected(id)}><Icon size={22} aria-hidden="true" />{title}</button>)}
        </div>
        <article className="island-help-detail"><topic.Icon size={32} aria-hidden="true" /><h3>{topic.title}</h3><p>{topic.text}</p>
            {unavailable && <p>{unavailable}</p>}
            <button className="island-primary" disabled={disabled || Boolean(unavailable)} onClick={() => onTry(selected)}>やってみる<ArrowRight size={20} aria-hidden="true" /></button>
        </article>
    </section>;
}
export function IslandTutorial({ id, text, action, onAction, onShown, onClose }: {
    id: TutorialId; text?: string; action?: string; onAction?: () => void; onShown: () => void; onClose: () => void;
}) {
    const topic = TUTORIAL_TOPICS.find(topic => topic.id === id)!;
    const ref = useRef<HTMLElement>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting) && !document.hidden) { onShown(); observer.disconnect(); }
        }, { threshold: .5 });
        observer.observe(element);
        return () => observer.disconnect();
    }, [onShown]);
    return <aside ref={ref} className="island-tutorial" aria-label={`${topic.title}の あんない`} data-tutorial={id}>
        <topic.Icon size={23} aria-hidden="true" /><p>{text ?? topic.text}</p>
        {action && <button className="island-text-button" onClick={onAction}>{action}<ArrowRight size={18} aria-hidden="true" /></button>}
        <button className="island-text-button" onClick={onClose} aria-label="あんないを とじる"><X size={18} aria-hidden="true" />とじる</button>
    </aside>;
}
