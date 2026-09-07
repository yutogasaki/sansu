import { ArrowRight, Blocks, Compass, Handshake, ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../ScreenScaffold';
import { BUILD_PLAY_AVAILABLE } from '../../domain/park/feature';

const games = [
    { to: '/park', title: 'ちいさな遊園地', detail: 'つくった コースで あそぶ', icon: Blocks },
    { to: '/explore', title: 'ポッコの たんけん', detail: 'さんすうで 道をひらく', icon: Compass },
    { to: '/battle/play?mode=boss_coop', title: 'ふたりで きょうりょく', detail: 'いっしょに こたえる', icon: Handshake },
    { to: '/battle/play?mode=tug_of_war', title: 'つなひき たいせん', detail: 'ふたりで ひっぱりあう', icon: ArrowLeftRight },
];

export function OtherGames() {
    const navigate = useNavigate();
    return <ScreenScaffold title="ほかの あそび" showBack onBack={() => navigate('/island')}>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-[var(--screen-padding-x)] pb-6">
            {games.filter(game => game.to !== '/park' || BUILD_PLAY_AVAILABLE).map(game => {
                const Icon = game.icon;
                return <button key={game.to} type="button" onClick={() => navigate(game.to)}
                    className="app-pill flex min-h-20 items-center gap-4 rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2">
                    <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><strong className="block">{game.title}</strong><small className="mt-1 block">{game.detail}</small></span>
                    <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                </button>;
            })}
            <button type="button" onClick={() => navigate('/battle/play')}
                className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm underline underline-offset-4">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />2人あそびを くわしく えらぶ
            </button>
        </div>
    </ScreenScaffold>;
}
