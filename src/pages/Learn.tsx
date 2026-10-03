import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { islandEnabled } from '../domain/island/feature';

export function Learn() {
    const navigate = useNavigate();
    return <main className="finish-page">
        <h1>まなぶ</h1>
        <Button size="xl" onClick={() => navigate(islandEnabled() ? '/island?start=learn' : '/study')}>いつもの れんしゅう</Button>
        <Button variant="ghost" onClick={() => navigate('/stats')}>レベルアップを みる</Button>
    </main>;
}

export default Learn;
