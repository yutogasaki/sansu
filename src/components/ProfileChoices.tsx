import type { UserProfile } from '../domain/types';
import './ProfileChoices.css';

export function ProfileChoices({ profiles, activeId, switchingId, disabled, onSelect }: {
    profiles: UserProfile[]; activeId: string; switchingId: string | null; disabled: boolean; onSelect: (id: string) => void;
}) {
    return <div className="settings-profile-choices">{profiles.map(person => <button key={person.id} type="button"
        className="settings-profile-choice" aria-label={`${person.name || 'ゲスト'}${person.id === activeId ? '（いま あそんでいる）' : 'に きりかえる'}`}
        aria-pressed={person.id === activeId} disabled={disabled}
        onClick={() => onSelect(person.id)}>
        <span className="settings-profile-avatar" aria-hidden="true">{Array.from(person.name || '?')[0]}</span>
        <span className="settings-profile-name">{person.name || 'ゲスト'}</span>
        <span className="settings-profile-state">{switchingId === person.id ? 'きりかえ中…' : person.id === activeId ? '✓ いま あそんでいる' : 'この人で あそぶ'}</span>
    </button>)}</div>;
}
