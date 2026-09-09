import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Award, Trophy } from 'lucide-react';
import { readChallengeHome, setChallengeAwardDisplayed } from '../../domain/challenge/repository';
import { challengeEnabled } from '../../domain/challenge/feature';
import type { ChallengeAwardId } from '../../domain/challenge/types';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import './Challenge.css';

export function ChallengeHomeCard({ profileId, disabled, onStart, onLearn, onResult }: { profileId: string; disabled: boolean; onStart: () => void; onLearn: () => void; onResult: () => void }) {
    const [saving, setSaving] = useState(false), [error, setError] = useState(false), [nonce, setNonce] = useState(0);
    const home = useLiveQuery(async () => {
        try { return { value: await readChallengeHome(profileId), error: false }; }
        catch { return { value: undefined, error: true }; }
    }, [profileId, nonce]);
    const summary = home?.value?.summary;
    const toggle = async (id: ChallengeAwardId) => {
        if (saving) return;
        setSaving(true); setError(false); const release = holdPwaUpdateForCriticalPersistence();
        try { await setChallengeAwardDisplayed(profileId, id, !summary?.displayed.includes(id)); }
        catch { setError(true); }
        finally { setSaving(false); release(); }
    };
    return <article className="challenge-card" aria-label="がくしゅう チャレンジ">
        <div className="challenge-card-heading"><Trophy size={40} aria-hidden="true" /><div><h3>10までの たしざん</h3><p>1ぷん チャレンジ</p></div></div>
        <p>{summary?.best === null || !summary ? 'はじめての ちょうせん' : `じぶんの ベスト：${summary.best}もん`}</p>
        {home?.value?.active ? <button className="island-primary" disabled={disabled || saving} onClick={onResult}>まえの きろくを ひらく</button> : home?.value?.eligible && challengeEnabled() ? <button className="island-primary" disabled={disabled || saving} onClick={onStart}>ちょうせん</button>
            : <><p>{challengeEnabled() ? 'たしざんを れんしゅうすると ちょうせんできるよ。' : 'いまは チャレンジを おやすみしているよ。'}</p>
                <button className="island-secondary" disabled={disabled || saving} onClick={onLearn}>まなぶ</button></>}
        <details><summary>チャレンジの あそびかた・きねん</summary><p>1ぷんで なんもん できるかな。1ぷん おえると しょうじょう、10もん できると トロフィー。</p><p>こたえを いれて「こたえる」。まちがえても へらないよ。「わからない」で つぎへ いけるよ。</p>
            <p>ほかの がめんへ うつったり、とじたりすると おしまい。とちゅうの きろくは ベストに のこらないよ。</p>
            <p>はやさの きろくだよ。たしざんが みについたかは、いつもの まなびで たしかめるよ。</p></details>
        {(error || home?.error) && <div role="alert"><p>きろくを ひらけなかったよ。</p><button className="island-secondary" disabled={saving} onClick={() => setNonce(n => n + 1)}>もういちど たしかめる</button></div>}
        {summary && summary.awards.length > 0 && <div className="challenge-awards">
            {summary.awards.map(award => <div className="challenge-award" key={award.id}>
                <h4>{award.id === 'certificate' ? <Award /> : <Trophy />}{award.id === 'certificate' ? '1ぷんに ちょうせん' : '10までの たしざん・1ぷん'}</h4>
                <p>{summary.displayed.includes(award.id) ? 'いえに かざっているよ' : 'もっているよ'}</p>
                <button className="island-secondary" disabled={disabled || saving} onClick={() => void toggle(award.id)}>{summary.displayed.includes(award.id) ? 'しまう' : 'いえに かざる'}</button>
                <details><summary>きねんの きろく</summary><p>{new Date(award.acquiredAt).toLocaleDateString('ja-JP')}に もらったよ。{award.correct}もん できた きねん。</p><p>じぶんの ベスト：{summary.best}もん</p></details>
            </div>)}
        </div>}
        {home?.value?.latestRun?.result && <button className="island-text-button" disabled={disabled || saving} onClick={onResult}>まえの チャレンジを みる</button>}
    </article>;
}
