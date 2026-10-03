import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { islandEnabled } from '../domain/island/feature';
import { useFinishChallenge } from '../hooks/useFinishChallenge';
import { FinishChallengeEntry } from '../components/finish/FinishChallenge';
import { finishStudyPath } from '../components/finish/finishNavigation';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { useIslandNavigation } from '../components/island/useIslandNavigation';
import { Spinner } from '../components/ui/Spinner';
import { warmUpTTS } from '../utils/tts';

export function Learn() {
    const requested = new URLSearchParams(useLocation().search).get('challenge');
    const navigation = useIslandNavigation();
    if (requested !== 'math' && requested !== 'vocab') {
        if (navigation) return null; // Layout owns the live learning surface.
        return <Navigate to={islandEnabled() ? '/island?start=learn' : '/study'} replace />;
    }
    return <ChallengeConfirmation subject={requested} />;
}

function ChallengeConfirmation({ subject }: { subject: 'math' | 'vocab' }) {
    const navigate = useNavigate();
    const navigation = useIslandNavigation();
    const state = useFinishChallenge();
    const challenge = state.challenges.find(item => item.subject === subject);
    const open = (path: string) => navigation ? navigation.open(path) : navigate(path);
    const practice = () => { warmUpTTS(); open(islandEnabled() ? '/island?start=learn' : '/study'); };
    return <ScreenScaffold title="レベルアップ" showBack onBack={() => navigation ? navigation.back() : navigate('/stats')}
        contentClassName="finish-confirmation" containerClassName="finish-confirmation-screen">
        <div data-learning-flow-candidate="learning-flow-v5">
            {state.status === 'loading' ? <Spinner message="じゅんびを たしかめているよ…" />
                : state.status === 'error' ? <section className="finish-card" role="alert">
                    <h2>きろくを 読みこめなかったよ</h2>
                    <Button onClick={state.retry}>もういちど 読みこむ</Button>
                </section> : challenge ? <FinishChallengeEntry subject={subject} level={challenge.mainLevel} nextLevel={challenge.nextLevel}
                    onStart={() => { warmUpTTS(); open(finishStudyPath(subject)); }} />
                : <section className="finish-card"><h2>つぎへ むけて れんしゅう中</h2>
                    <p className="finish-description">いまの じゅんびを きろくで みられるよ。</p>
                    <Button variant="secondary" onClick={() => open('/stats')}>きろくを みる</Button>
                </section>}
            <Button variant="secondary" className="finish-practice-action" onClick={practice}>れんしゅうを つづける</Button>
        </div>
    </ScreenScaffold>;
}

export default Learn;
