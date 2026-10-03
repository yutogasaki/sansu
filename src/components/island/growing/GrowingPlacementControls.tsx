export function GrowingPlacementControls({ itemName, message, shortfall, valid, pending, onConfirm, onChoose, onCancel }: {
    itemName: string; message: string; shortfall: number; valid: boolean; pending: boolean;
    onConfirm: () => void; onChoose: () => void; onCancel: () => void;
}) {
    return <div className="growing-placing">
        <p id="growing-placement-message" role="status"><span>{itemName}：</span><span>{pending ? 'しまを たしかめているよ' : shortfall > 0 ? `しずくが あと ${shortfall}こ いるよ` : message}</span></p>
        {shortfall > 0
            ? <button className="growing-primary" aria-describedby="growing-placement-message" disabled={pending} onClick={onChoose}>えらびなおす</button>
            : <button className="growing-primary" aria-describedby="growing-placement-message" disabled={!valid || pending} onClick={onConfirm}>ここに おく</button>}
        <button aria-describedby="growing-placement-message" disabled={pending} onClick={onCancel}>やめる</button>
    </div>;
}
