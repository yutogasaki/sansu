import type { Command } from '../../../domain/growingIsland';
import type { GrowingRecord } from '../../../domain/growingIsland/repository';
import { RULES } from '../../../domain/growingIsland/rules';
import { islandIdOf } from '../../../domain/growingIsland/voyages';

type Decorate = Extract<Command, { type: 'decorate' }>;
type Intent = { id: string; islandId: string; command: Decorate };
type Operation = { intent: Intent; baseRevision: number; pending: boolean; confirmed: boolean };
export interface RoomSaveSnapshot {
    record?: GrowingRecord;
    status: 'loading' | 'ready' | 'saving' | 'saved' | 'unknown' | 'error';
    busy: boolean;
    error?: string;
}
interface Persistence {
    read: () => Promise<GrowingRecord | undefined>;
    write: (intent: Intent, receiptSinceRevision: number) => Promise<{ record: GrowingRecord }>;
}

/** One house session. UI timeouts never cancel a repository transaction or its PWA hold. */
export class RoomSaveSession {
    private record?: GrowingRecord;
    private operation?: Operation;
    private active = true;
    private notification = 0;
    private timer?: ReturnType<typeof setTimeout>;
    private status: RoomSaveSnapshot['status'] = 'loading';
    private error?: string;

    constructor(private readonly profileId: string, private readonly persistence: Persistence,
        private readonly publish: (snapshot: RoomSaveSnapshot) => void) {}

    private emit() {
        if (this.active) this.publish({ record: this.record, status: this.status, busy: this.operation?.pending ?? false, error: this.error });
    }
    private current(op: Operation) { return this.active && this.operation === op && islandIdOf(this.record) === op.intent.islandId; }
    private accept(record: GrowingRecord) {
        if (!this.active || record.profileId !== this.profileId || (this.record && islandIdOf(record) !== islandIdOf(this.record))) return;
        if (!this.record || record.revision > this.record.revision) this.record = record;
    }
    private confirmed(record: GrowingRecord, op: Operation) {
        if (record.profileId !== this.profileId || islandIdOf(record) !== op.intent.islandId || !record.state.applied.includes(op.intent.id)) return false;
        op.confirmed = true; this.status = 'saved'; this.error = undefined;
        clearTimeout(this.timer);
        return true;
    }
    async observe(record?: GrowingRecord) {
        const notification = ++this.notification;
        if (!this.active) return;
        if (!record) { this.failLoading(); return; }
        if (record.profileId !== this.profileId) return;
        if (this.record && islandIdOf(record) !== islandIdOf(this.record)) {
            // An old cross-island notification is not authority to switch back.
            try {
                const latest = await this.persistence.read();
                if (!this.active || notification !== this.notification || !latest || latest.profileId !== this.profileId) return;
                if (islandIdOf(latest) !== islandIdOf(this.record)) {
                    clearTimeout(this.timer); this.operation = undefined; this.record = undefined;
                    this.status = 'ready'; this.error = undefined;
                }
                record = latest;
            } catch { return; }
        }
        this.accept(record);
        if (this.status === 'loading' || (this.status === 'error' && !this.operation)) { this.status = 'ready'; this.error = undefined; }
        if (this.operation) this.confirmed(record, this.operation);
        this.emit();
    }
    failLoading() {
        this.status = 'error'; this.error = 'いえを よみこめなかったよ。もういちど たしかめてね。'; this.emit();
    }
    async decorate(command: Decorate) {
        if (!this.active || !this.record || this.operation?.pending || (this.operation && !this.operation.confirmed)) return;
        const op: Operation = { intent: { id: crypto.randomUUID(), islandId: islandIdOf(this.record), command }, baseRevision: this.record.revision, pending: false, confirmed: false };
        this.operation = op;
        await this.write(op);
    }
    private async write(op: Operation) {
        op.pending = true; this.status = 'saving'; this.error = undefined; this.emit();
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            if (this.current(op) && !op.confirmed) {
                this.status = 'unknown'; this.error = 'のこせたか たしかめているよ。とじても だいじょうぶだよ。'; this.emit();
            }
        }, 8000);
        try {
            const result = await this.persistence.write(op.intent, op.baseRevision);
            if (!this.current(op)) return;
            this.accept(result.record);
            this.confirmed(result.record, op);
        } catch {
            if (!this.current(op)) return;
            // The repository promise has settled before querying. No retry races the writer.
            op.pending = false;
            await this.check(op);
        } finally {
            if (this.current(op)) {
                clearTimeout(this.timer); op.pending = false; this.emit();
            }
        }
    }
    private retrySafe(op: Operation, record: GrowingRecord) {
        // Every applied command increments revision; fewer than 500 cannot evict this receipt.
        const elapsed = record.revision - op.baseRevision;
        return elapsed >= 0 && elapsed < RULES.appliedMemory;
    }
    private async check(op: Operation) {
        try {
            const record = await this.persistence.read();
            if (!this.current(op)) return;
            if (!record || record.profileId !== this.profileId || islandIdOf(record) !== op.intent.islandId) {
                this.status = 'unknown'; this.error = 'いまの いえを もういちど ひらいてね。'; this.emit(); return;
            }
            this.accept(record);
            if (!op.confirmed && !this.confirmed(record, op)) {
                if (!op.pending && !this.retrySafe(op, this.record ?? record)) {
                    // The old outcome is unknowable, but its writer has finished. Show the
                    // current room and permit a NEW explicit choice, never replay the old one.
                    this.operation = undefined; this.status = 'ready';
                    this.error = 'いまの へやを みてね。えらびなおせるよ。';
                    this.emit(); return;
                }
                this.status = !op.pending ? 'error' : 'unknown';
                this.error = this.status === 'error' ? 'のこせなかったよ。もういちど ためせるよ。' : 'のこせたか まだ わからないよ。もういちど たしかめてね。';
            }
        } catch {
            if (this.current(op) && !op.confirmed) { this.status = 'unknown'; this.error = 'まだ たしかめられないよ。'; }
        }
        if (this.current(op)) this.emit();
    }
    async retry() {
        if (!this.active) return;
        const op = this.operation;
        if (!op) {
            try { await this.observe(await this.persistence.read()); } catch { this.failLoading(); }
            return;
        }
        await this.check(op);
        if (!this.current(op) || op.pending || op.confirmed || this.status !== 'error' || !this.record || !this.retrySafe(op, this.record)) return;
        await this.write(op);
    }
    dispose() { this.active = false; ++this.notification; clearTimeout(this.timer); }
}
