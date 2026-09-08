import type { ReactNode } from 'react';
import type { IslandExpressionSelection } from '../../domain/island/expression';
import './IslandAlbumDecoration.css';

export type IslandAlbumDecoration = IslandExpressionSelection['album'];

/** Binding and stamps live outside photo pixels, in both preview and the album. */
export function IslandAlbumBinding({ decoration, children }: { decoration?: IslandAlbumDecoration; children: ReactNode }) {
    return <div className="island-album-binding" data-album-cover={decoration?.cover ?? 'default'}>
        {decoration?.cover === 'leaf-album-cover' && <div className="island-album-binding-title" aria-label="はっぱの ひょうし">
            <svg viewBox="0 0 100 48" aria-hidden="true"><path d="M12 42Q45 6 88 10" className="island-album-stem" />
                <path d="M25 29Q3 24 8 5Q33 4 25 29M42 18Q25 3 43 1Q63 4 42 18M58 13Q62 33 80 25Q82 10 58 13M34 24Q31 46 55 42Q64 22 34 24" /></svg>
            <span>しゃしんの アルバム</span></div>}
        {children}
    </div>;
}

export function IslandAlbumStamp({ decoration }: { decoration?: IslandAlbumDecoration }) {
    if (decoration?.stamp !== 'butterfly-stamp') return null;
    return <span className="island-album-stamp" data-album-stamp="butterfly-stamp" aria-label="ちょうの スタンプ">
        <svg viewBox="0 0 64 48" aria-hidden="true"><path d="M30 25C7 -5 0 21 17 29C-1 43 26 47 30 29M34 25C57 -5 64 21 47 29C65 43 38 47 34 29" />
            <path d="M32 18V37M32 20L26 11M32 20L38 11" className="island-album-butterfly-body" /></svg>
    </span>;
}
