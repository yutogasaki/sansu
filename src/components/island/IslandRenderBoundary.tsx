import { Component, type ReactNode } from 'react';

/** Keep navigation reachable when a scene or a lazy chunk fails to load. */
export class IslandRenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (!this.state.failed) return this.props.children;
        return <section className="island-loading" role="alert">
            <p>しまを ひらけなかったよ。よみなおして ためしてね。</p>
            <button className="island-secondary" onClick={() => window.location.reload()}>よみなおす</button>
            <a className="island-text-button" href="#/settings">せっていへ</a>
        </section>;
    }
}
