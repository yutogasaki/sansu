import type { LifeRecord, Style } from './model';

/** Cosmetic-only read of the last applied hero outfit; no replay or advancement of Life. */
export function savedHeroStyle(record?: LifeRecord): Style {
    if (!record) return 'original';
    for (let i = record.actions.length - 1; i >= 0; i--) {
        const action = record.actions[i], command = action.command;
        if (action.at <= record.now && command.type === 'style' && !command.itemId) return command.style;
    }
    return record.economyCheckpoint?.state.heroStyle ?? 'original';
}
