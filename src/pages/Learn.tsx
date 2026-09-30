import { useNavigate } from 'react-router-dom';
import { useFinishChallenge } from '../hooks/useFinishChallenge';
import { FinishChallengeEntry } from '../components/finish/FinishChallenge';
import { finishStudyPath } from '../components/finish/finishNavigation';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { islandEnabled } from '../domain/island/feature';

export function Learn() {
    const navigate = useNavigate();
    const finish = useFinishChallenge();
    const practice = () => navigate(islandEnabled() ? '/island?start=learn' : '/study');
    if (finish.status === 'loading') return <Spinner fullScreen message="じゅんび しているよ" />;
    return <main className="finish-page">
        <h1>まなぶ</h1>
        {finish.status === 'error' ? <section className="finish-card"><p>しあげの じゅんびを たしかめられなかったよ</p><Button onClick={finish.retry}>もういちど たしかめる</Button></section>
            : finish.challenges.map(challenge => <FinishChallengeEntry key={challenge.subject} subject={challenge.subject} level={challenge.mainLevel} nextLevel={challenge.nextLevel} onStart={() => navigate(finishStudyPath(challenge.subject))} />)}
        <div className="finish-practice"><Button variant={finish.challenges.length ? 'secondary' : 'primary'} size="xl" onClick={practice}>いつもの れんしゅう</Button>{finish.challenges.length > 0 && <p>しあげは あとでも だいじょうぶ</p>}</div>
    </main>;
}

export default Learn;
