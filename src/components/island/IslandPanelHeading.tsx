import type { ReactNode, Ref } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import './IslandPanelHeading.css';

interface IslandPanelHeadingProps {
    title: ReactNode;
    titleRef?: Ref<HTMLHeadingElement>;
    description?: ReactNode;
    actions?: ReactNode;
    onExit: () => void;
    disabled?: boolean;
    kind?: 'back' | 'close';
    exitLabel?: string;
    exitAriaLabel?: string;
    houseAction?: 'home' | 'close';
}

/** One visual contract; the caller retains its existing return/save behavior. */
export function IslandPanelHeading({ title, titleRef, description, actions, onExit, disabled, kind = 'back',
    exitLabel, exitAriaLabel, houseAction }: IslandPanelHeadingProps) {
    const Icon = kind === 'back' ? ArrowLeft : X;
    const exit = <button type="button" className="island-icon-button island-panel-back" disabled={disabled}
        aria-label={exitAriaLabel} data-keepsake-action={houseAction} onClick={onExit}>
        <Icon size={20} aria-hidden="true" /><span>{exitLabel ?? (kind === 'back' ? 'もどる' : 'とじる')}</span>
    </button>;
    return <div className="island-sheet-title island-panel-heading" data-exit-kind={kind}>
        {kind === 'back' && exit}
        <div className="island-panel-heading-copy"><h2 ref={titleRef} tabIndex={titleRef ? -1 : undefined}>{title}</h2>{description && <p>{description}</p>}</div>
        {kind === 'close' && exit}
        {actions && <div className="island-panel-heading-actions">{actions}</div>}
    </div>;
}
