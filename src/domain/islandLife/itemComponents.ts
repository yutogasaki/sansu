import type { LifeItem } from './model';

export function itemComponents(items: LifeItem[]): LifeItem[][] {
    const remaining = new Map(items.filter(item => item.cell).map(item => [item.id, item]));
    const result: LifeItem[][] = [];
    while (remaining.size) {
        const first = remaining.values().next().value!;
        const group = [first]; remaining.delete(first.id);
        for (let cursor = 0; cursor < group.length; cursor++) {
            for (const item of remaining.values()) {
                if (Math.abs(item.cell!.x - group[cursor].cell!.x) + Math.abs(item.cell!.z - group[cursor].cell!.z) === 1) {
                    group.push(item); remaining.delete(item.id);
                }
            }
        }
        result.push(group);
    }
    return result;
}

