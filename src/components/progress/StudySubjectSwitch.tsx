import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';

/** Every learning mode opens the same subject settings; existing reservations stay intact. */
export function StudySubjectSwitch({ disabled, easy = false, returnTo = '/island' }: { disabled?: boolean; easy?: boolean; returnTo?: string }) {
    const navigate = useNavigate();
    return <Button variant="secondary" size="sm" disabled={disabled} onClick={() => navigate('/settings?section=learning', {
        state: { islandParent: { href: returnTo } },
    })}>{easy ? 'きょうかを えらぶ' : '教科を えらぶ'}</Button>;
}
