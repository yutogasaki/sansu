import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { IslandPhotoGallery } from './IslandPhotos';
import { IslandNavigationContext, useIslandNavigationState } from './useIslandNavigation';

type PhotoState = ComponentProps<typeof IslandPhotoGallery>['photos'];
function state(): PhotoState {
    return { status: 'idle', snapshot: undefined, readError: undefined, error: undefined, preview: undefined,
        savedPhotoId: undefined, requestId: undefined, canRetry: false, processing: false,
        retryRead: vi.fn(), capture: vi.fn(), consume: vi.fn(), cancel: vi.fn(), remove: vi.fn(async () => false), retry: vi.fn() };
}
function Gallery({ photos }: { photos: PhotoState }) {
    const navigation = useIslandNavigationState(true);
    return <IslandNavigationContext.Provider value={navigation}>
        <IslandPhotoGallery photos={photos} disabled={false} onCamera={vi.fn()} onClose={vi.fn()} onLearn={vi.fn()} />
    </IslandNavigationContext.Provider>;
}
const render = (photos: PhotoState, detail = true) => renderToStaticMarkup(<MemoryRouter initialEntries={[`/island?view=photos${detail ? '&photo=missing' : ''}`]}><Gallery photos={photos} /></MemoryRouter>);
const exit = (html: string) => html.match(/<button[^>]*class="[^"]*island-panel-back[^"]*"[^>]*>/)?.[0];
describe('photo exits survive missing data', () => {
    it.each(['loading', 'read-error', 'missing'] as const)('keeps one visible close control for %s detail', mode => {
        const photos = state();
        if (mode === 'read-error') photos.readError = 'よみこめなかったよ';
        if (mode === 'missing') photos.snapshot = { album: { profileId: 'child', version: 1, revision: 0 }, photos: [] };
        const html = render(photos);
        expect(html.match(/island-panel-back/g)).toHaveLength(1);
        expect(exit(html)).not.toContain('disabled');
        expect(html).toContain('data-exit-kind="close"');
        if (mode === 'loading') expect(html).toContain('アルバムを ひらいているよ');
        if (mode === 'read-error') expect(html).toContain('もういちど ひらく');
        if (mode === 'missing') expect(html).toContain('いま たなに ないよ');
        expect(photos.remove).not.toHaveBeenCalled();
    });
    it('blocks the exit during a deletion, then leaves it available after a failed operation', () => {
        const photos = state(); photos.processing = true;
        expect(exit(render(photos))).toContain('disabled');
        photos.processing = false; photos.error = 'まだ はずせなかったよ'; photos.canRetry = true;
        const html = render(photos);
        expect(exit(html)).not.toContain('disabled'); expect(html).toContain('もういちど ためす');
        expect(photos.retry).not.toHaveBeenCalled();
    });
    it('keeps the same parent return on an album read failure', () => {
        const photos = state(); photos.readError = 'よみこめなかったよ';
        const html = render(photos, false);
        expect(exit(html)).toContain('しゃしんの アルバムから もどる');
        expect(html).toContain('data-exit-kind="back"');
    });
});
