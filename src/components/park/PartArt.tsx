import type { PartKind } from '../../domain/park/types';

export function PartShape({ kind }: { kind: PartKind }) {
    switch (kind) {
        case 'slide': return <g stroke="var(--park-ink)" strokeWidth="4" strokeLinejoin="round">
            <path d="M-36 0V-92H-14V0M-35-66H-14M-35-40H-14" fill="none" />
            <path d="M-19-96C9-99-2-28 39-16L43-2C-4-4-5-61-20-79Z" fill="var(--park-coral)" />
            <path d="M-19-91C7-83 3-29 38-12" fill="none" stroke="var(--park-cream)" strokeWidth="5" />
        </g>;
        case 'trampoline': return <g stroke="var(--park-ink)" strokeWidth="4" strokeLinecap="round">
            <path d="M-32-11L-35 1M30-11L34 1M-12-10L-17 0M10-10L14 0" />
            <ellipse cy="-16" rx="41" ry="12" fill="var(--park-coral)" />
            <ellipse cy="-18" rx="30" ry="7" fill="var(--park-cream)" />
        </g>;
        case 'bubble': return <g stroke="var(--park-ink)" strokeWidth="4">
            <path d="M-36 0V-57C-36-105 36-105 36-57V0" fill="none" stroke="var(--park-mint-dark)" strokeWidth="14" />
            <circle cy="-59" r="23" fill="var(--park-cream)" fillOpacity=".65" strokeWidth="2" />
            <path d="M-14-63Q-12-75-3-76" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" />
            <path d="M-46 0H-25M25 0H46" strokeLinecap="round" />
        </g>;
        case 'mat': return <g stroke="var(--park-ink)" strokeWidth="3">
            <path d="M-41-10Q-40-20-27-19H30Q42-17 42-7L34 0H-39Z" fill="var(--park-mint-dark)" />
            <path d="M-26-12H-17M-6-12H3M14-12H23" stroke="var(--park-cream)" strokeWidth="4" />
        </g>;
        case 'bell': return <g stroke="var(--park-ink)" strokeWidth="4" strokeLinejoin="round">
            <path d="M-28 0V-94H17" fill="none" />
            <path d="M-10-50L-5-73Q5-88 19-73L24-50Z" fill="var(--park-yellow)" />
            <circle cx="7" cy="-46" r="6" fill="var(--park-coral)" />
            <path d="M30-75L41-84M34-62L46-62" fill="none" />
        </g>;
        case 'paint': return <g stroke="var(--park-ink)" strokeWidth="3">
            <path d="M-31 0V-77Q0-104 31-77V0" fill="none" stroke="var(--park-coral)" strokeWidth="13" />
            <path d="M-24-65L-2-87M-24-27L24-75M-9-7L24-40" stroke="var(--park-cream)" strokeWidth="6" />
            <path d="M-42 0H-22M22 0H42" />
        </g>;
    }
}

export function PartIcon({ kind }: { kind: PartKind }) {
    return <svg viewBox="-55 -110 110 120" aria-hidden="true"><PartShape kind={kind} /></svg>;
}

export function ToyDoll({ pink, bubble, bubblePink, popped }: { pink: boolean; bubble: boolean; bubblePink: boolean; popped?: boolean }) {
    return <g stroke="var(--park-ink)" strokeWidth="3" strokeLinecap="round">
        {bubble && !popped && <g>
            <circle cy="-32" r="40" fill={bubblePink ? 'var(--park-coral)' : 'white'} fillOpacity=".25" stroke={bubblePink ? 'var(--park-coral)' : 'var(--park-mint-dark)'} />
            <path d="M-28-41Q-24-60-11-62" stroke="white" strokeWidth="5" fill="none" />
        </g>}
        <ellipse cy="-4" rx="20" ry="5" fill="var(--park-ink)" opacity=".12" stroke="none" />
        <path d="M-10-10L-14-1M10-10L14-1" />
        <path d="M-12-37Q-21-5 0-8Q21-5 12-37" fill={pink ? 'var(--park-coral)' : 'var(--park-yellow)'} />
        <circle cy="-47" r="17" fill={pink ? 'var(--park-coral)' : 'var(--park-yellow)'} />
        <path d="M-19-47Q-26-58-17-59M19-47Q26-58 17-59" fill="var(--park-yellow)" />
        <path d="M-5-48v1M6-48v1M-3-40Q1-36 5-40" fill="none" />
        <path d="M-14-29L-25-22M14-29L25-22" />
        {popped && <g stroke="var(--park-coral)" strokeWidth="4">
            <path d="M-44-37l-9-4M40-43l12-6M-20-78l-4-9M21-78l5-9" />
            <circle cx="-29" cy="-61" r="5" fill="none" /><circle cx="37" cy="-19" r="5" fill="none" />
        </g>}
    </g>;
}
