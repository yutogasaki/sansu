/** Observe only successful foreground frames of explicit, touched common activity. */
export class SharedPlayOverlap {
    private actors = new Map<string, { last: number; elapsed: number }>();
    observe(now: number, ids: readonly string[]) {
        const present = new Set(ids);
        for (const id of this.actors.keys()) if (!present.has(id)) this.actors.delete(id);
        const ready: { actorId: string; overlapMs: number }[] = [];
        for (const id of present) {
            const previous = this.actors.get(id), gap = previous ? now - previous.last : 0;
            const elapsed = previous && gap >= 0 && gap <= 500 ? previous.elapsed + Math.min(gap, 250) : 0;
            this.actors.set(id, { last: now, elapsed });
            if (elapsed >= 3000) ready.push({ actorId: id, overlapMs: elapsed });
        }
        return ready;
    }
    clear() { this.actors.clear(); }
}
