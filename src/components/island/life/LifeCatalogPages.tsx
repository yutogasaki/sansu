import { Children, useRef, useState, type ReactNode } from 'react';
import './life-catalog-pages.css';

/** Native horizontal scrolling keeps vertical gestures and touch momentum native. */
export default function LifeCatalogPages({ children }: { children: ReactNode }) {
    const pages = Children.toArray(children), viewport = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(0);
    const gesture = useRef<{ x: number; y: number; moved: boolean } | undefined>(undefined);
    const visit = (index: number) => {
        const view = viewport.current;
        if (!view) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        view.scrollTo({ left: index * view.clientWidth, behavior: reduced ? 'instant' : 'smooth' });
    };
    return <div className="life-catalog-pages">
        <div ref={viewport} className="life-catalog-scroll" data-life-catalog-swipe aria-label="つくれるもの"
            onPointerDownCapture={event => { if (event.pointerType !== 'touch') gesture.current = undefined; }}
            onTouchStartCapture={event => { const p = event.touches[0]; gesture.current = { x: p.clientX, y: p.clientY, moved: false }; }}
            onTouchMoveCapture={event => { const p = event.touches[0], start = gesture.current;
                if (start && Math.hypot(p.clientX - start.x, p.clientY - start.y) > 10) start.moved = true;
            }}
            onTouchCancelCapture={() => { gesture.current = undefined; }}
            onClickCapture={event => { const moved = gesture.current?.moved; gesture.current = undefined;
                if (event.detail !== 0 && moved) { event.preventDefault(); event.stopPropagation(); }
            }}
            onScroll={event => { const view = event.currentTarget; setPage(Math.max(0, Math.min(pages.length - 1, Math.round(view.scrollLeft / view.clientWidth)))); }}>
            {pages.map((content, index) => <div key={index} className="life-catalog-page" role="group" aria-label={`${index + 1}ページめ`}>{content}</div>)}
        </div>
        <div className="life-catalog-navigation">
            <small>よこに スワイプ</small>
            <div className="life-catalog-dots" role="group" aria-label="つくれるものの ページ">
                {pages.map((_, index) => <button key={index} type="button" aria-label={`${index + 1}ページめ`} aria-pressed={page === index} onClick={() => visit(index)}><span /></button>)}
            </div>
            <span className="life-catalog-count" aria-live="polite">{page + 1} / {pages.length}</span>
        </div>
    </div>;
}
