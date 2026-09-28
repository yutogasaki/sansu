import type { LifeState, LifeCommand } from '../../../domain/islandLife/model';
import { landQuote } from '../../../domain/islandLife/landRules';
import LifeResidentPortrait from './LifeResidentPortrait';

export default function LifeCommunity({ state, locked, action, expand }: {
    state: LifeState; locked: boolean; action: (command: LifeCommand, message: string) => Promise<void>; expand: () => void;
}) {
    const friends = (['rabbit', 'otter'] as const).filter(id => state.residency && !state.residency.joined.includes(id));
    return <section className="life-community" aria-label="なかまと くらす">
        {friends.map(id => {
            const invitation = state.residency?.invitations[id], name = id === 'rabbit' ? 'うさぎ' : 'カワウソ';
            return <div className="life-community-friend" key={id} data-life-friend={id} data-ready={Boolean(invitation)}>
                <LifeResidentPortrait resident={id} style={state.heroStyle} />
                <div><b>{name}</b><p>{invitation ? invitation.reason === 'shared-meal' ? 'ごはんの においに さそわれて あそびに きたよ。' : 'すきな ばしょが できたね。あそびに きたよ。'
                    : id === 'rabbit' ? 'さいた おはなの そばの ベンチに、ぽこもこを よんでみよう。' : 'おはなや はちの そばの 水ばちに、ぽこもこを よんでみよう。'}</p>
                {invitation && <button className="island-primary" disabled={locked} onClick={() => void action({ type: 'invite-friend', friend: id }, `${name}と いっしょに くらすよ。`)}>いっしょに くらす</button>}</div>
            </div>;
        })}
        {Boolean(state.food?.eaten) && <p>そだった ごはんを みんなで たべたよ。すきな ばしょを ふやしてみよう。</p>}
        {landQuote(state) && <button className="island-secondary" disabled={locked} onClick={expand}>ひろげる ばしょを みる</button>}
    </section>;
}
