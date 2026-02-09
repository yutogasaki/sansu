import React, { useEffect, useMemo, useState } from "react";
import { ikimonoStorage } from "../../utils/storage";
import { IkimonoState, IkimonoStage } from "../ikimono/types";
import { calculateStage, createNewIkimonoState, LIFECYCLE_DAYS, STAGE_BOUNDARIES } from "../ikimono/lifecycle";

interface DevIkimonoTabProps {
    profileId: string;
}

const toLocalInputValue = (iso: string | undefined) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromLocalInputValue = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
};

const buildStageRanges = () => {
    const ranges: { stage: IkimonoStage; startDay: number; endDay: number }[] = [];
    let prevEnd = 0;
    for (const item of STAGE_BOUNDARIES) {
        ranges.push({ stage: item.stage, startDay: prevEnd, endDay: item.endDay });
        prevEnd = item.endDay;
    }
    return ranges;
};

const setBirthDateDaysAgo = (daysAgo: number): string => {
    const ms = daysAgo * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms).toISOString();
};

export const DevIkimonoTab: React.FC<DevIkimonoTabProps> = ({ profileId }) => {
    const [storedState, setStoredState] = useState<IkimonoState | null>(null);
    const [draftState, setDraftState] = useState<IkimonoState | null>(null);

    const stageRanges = useMemo(() => buildStageRanges(), []);

    const loadState = () => {
        const current = ikimonoStorage.getState();
        setStoredState(current);
        setDraftState(current ?? createNewIkimonoState(profileId, 1));
    };

    useEffect(() => {
        loadState();
    }, [profileId]);

    const derived = useMemo(() => {
        if (!draftState?.birthDate) return null;
        const info = calculateStage(draftState.birthDate);
        const elapsedMs = Date.now() - new Date(draftState.birthDate).getTime();
        const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
        return { ...info, elapsedDays: Math.max(0, elapsedDays) };
    }, [draftState?.birthDate]);

    const applyDraft = () => {
        if (!draftState) return;
        ikimonoStorage.setState(draftState);
        loadState();
    };

    const createNew = (incrementGeneration: boolean) => {
        const baseGen = storedState?.generation ?? 0;
        const generation = incrementGeneration ? baseGen + 1 : Math.max(baseGen, 1);
        const next = createNewIkimonoState(profileId, generation);
        ikimonoStorage.setState(next);
        loadState();
    };

    const clearState = () => {
        ikimonoStorage.clear();
        loadState();
    };

    const setStage = (stage: IkimonoStage) => {
        if (!draftState) return;
        if (stage === "gone") {
            setDraftState({
                ...draftState,
                birthDate: setBirthDateDaysAgo(LIFECYCLE_DAYS + 1),
            });
            return;
        }
        const range = stageRanges.find(item => item.stage === stage);
        if (!range) return;
        const targetDay = range.startDay + (range.endDay - range.startDay) / 2;
        setDraftState({
            ...draftState,
            birthDate: setBirthDateDaysAgo(targetDay),
        });
    };

    const storedMismatch = storedState && storedState.profileId !== profileId;

    return (
        <div className="p-4 space-y-4">
            <h3 className="font-bold text-slate-700">いきもの状態</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm space-y-3">
                <div className="text-xs text-slate-500">
                    アクティブプロフィール: <span className="font-mono">{profileId}</span>
                </div>
                {storedMismatch && (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                        保存されている profileId が一致していません。
                    </div>
                )}

                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm text-slate-700">profileId</span>
                    <input
                        type="text"
                        value={draftState?.profileId ?? ""}
                        onChange={e => setDraftState(draftState ? { ...draftState, profileId: e.target.value } : null)}
                        className="w-40 text-sm border border-slate-200 rounded px-2 py-1"
                    />
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm text-slate-700">birthDate</span>
                    <input
                        type="datetime-local"
                        value={toLocalInputValue(draftState?.birthDate)}
                        onChange={e => setDraftState(draftState ? { ...draftState, birthDate: fromLocalInputValue(e.target.value) } : null)}
                        className="text-sm border border-slate-200 rounded px-2 py-1"
                    />
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm text-slate-700">generation</span>
                    <input
                        type="number"
                        value={draftState?.generation ?? 1}
                        onChange={e => setDraftState(draftState ? { ...draftState, generation: Math.max(1, Number(e.target.value)) } : null)}
                        className="w-20 text-sm border border-slate-200 rounded px-2 py-1 text-right"
                    />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                    <button
                        className="px-3 py-1 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                        onClick={() => setDraftState(draftState ? { ...draftState, birthDate: new Date().toISOString() } : null)}
                    >
                        いま生まれた
                    </button>
                    <button
                        className="px-3 py-1 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                        onClick={() => createNew(false)}
                    >
                        新規作成
                    </button>
                    <button
                        className="px-3 py-1 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                        onClick={() => createNew(true)}
                    >
                        次の世代
                    </button>
                    <button
                        className="px-3 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                        onClick={clearState}
                    >
                        クリア
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                    {stageRanges.map(range => (
                        <button
                            key={range.stage}
                            className="px-2.5 py-1 text-xs rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            onClick={() => setStage(range.stage)}
                        >
                            {range.stage}
                        </button>
                    ))}
                    <button
                        className="px-2.5 py-1 text-xs rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                        onClick={() => setStage("gone")}
                    >
                        gone
                    </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <button
                        className="px-4 py-1.5 text-sm rounded bg-violet-600 text-white hover:bg-violet-700"
                        onClick={applyDraft}
                        disabled={!draftState}
                    >
                        保存
                    </button>
                    <button
                        className="px-3 py-1.5 text-xs rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
                        onClick={loadState}
                    >
                        再読み込み
                    </button>
                </div>
            </div>

            <h3 className="font-bold text-slate-700">推定ステージ</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm text-sm text-slate-600 space-y-1">
                <div>stage: <span className="font-mono">{derived?.stage ?? "(未設定)"}</span></div>
                <div>fadeOpacity: <span className="font-mono">{derived ? derived.fadeOpacity.toFixed(2) : "(未設定)"}</span></div>
                <div>経過日数: <span className="font-mono">{derived ? derived.elapsedDays.toFixed(2) : "(未設定)"}</span></div>
                <div className="text-xs text-slate-400">LIFECYCLE_DAYS: {LIFECYCLE_DAYS}</div>
            </div>
        </div>
    );
};
