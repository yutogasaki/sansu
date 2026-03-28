import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import {
    DevStudySubject,
    getDevStudyFlatItems,
    getDevStudySelectionSummary,
} from "./devStudySelection";

interface DevStudySwitcherProps {
    isOpen: boolean;
    onClose: () => void;
    subject: DevStudySubject;
    selectedId?: string | null;
    onApply: (next: { subject: DevStudySubject; id: string }) => void;
}

export const DevStudySwitcher: React.FC<DevStudySwitcherProps> = ({
    isOpen,
    onClose,
    subject,
    selectedId,
    onApply,
}) => {
    const [draftSubject, setDraftSubject] = useState<DevStudySubject>(subject);
    const [draftId, setDraftId] = useState<string | null>(selectedId || null);
    const draftItems = useMemo(
        () => getDevStudyFlatItems(draftSubject),
        [draftSubject]
    );

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setDraftSubject(subject);
        const nextItems = getDevStudyFlatItems(subject);
        const nextId = selectedId && nextItems.some(item => item.id === selectedId)
            ? selectedId
            : (nextItems[0]?.id ?? null);
        setDraftId(nextId);
    }, [isOpen, subject, selectedId]);

    useEffect(() => {
        if (!draftId || !draftItems.some(item => item.id === draftId)) {
            setDraftId(draftItems[0]?.id ?? null);
        }
    }, [draftId, draftItems]);

    const handleSubjectChange = (nextSubject: DevStudySubject) => {
        setDraftSubject(nextSubject);
        const nextItems = getDevStudyFlatItems(nextSubject);
        setDraftId(nextItems[0]?.id ?? null);
    };

    const handleApply = () => {
        if (!draftId) {
            return;
        }

        onApply({ subject: draftSubject, id: draftId });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="開発者モードの切替"
            width="md"
            footer={(
                <div className="flex gap-3">
                    <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
                        閉じる
                    </Button>
                    <Button size="lg" className="flex-1" onClick={handleApply} disabled={!draftId}>
                        この設定で続ける
                    </Button>
                </div>
            )}
        >
            <div className="space-y-5">
                <div className="space-y-2">
                    <div className="text-xs font-black tracking-[0.16em] text-slate-400">きょうか</div>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { id: "math" as const, label: "算数" },
                            { id: "vocab" as const, label: "英語" },
                        ]).map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSubjectChange(item.id)}
                                className={`rounded-[18px] border px-4 py-3 text-sm font-black transition-colors ${draftSubject === item.id
                                    ? "border-cyan-100/90 bg-cyan-50/90 text-cyan-700"
                                    : "border-white/80 bg-white/70 text-slate-500 hover:bg-white/82"
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-xs font-black tracking-[0.16em] text-slate-400">
                        {draftSubject === "math" ? "問題一覧" : "単語一覧"}
                    </div>
                    <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-[22px] border border-white/80 bg-white/50 p-2">
                        {draftItems.map(item => {
                            const isSelected = draftId === item.id;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setDraftId(item.id)}
                                    className={`flex w-full items-start gap-3 rounded-[18px] border px-4 py-3 text-left transition-colors ${isSelected
                                        ? "border-cyan-100/90 bg-cyan-50/92"
                                        : "border-white/80 bg-white/72 text-slate-600 hover:bg-white/86"
                                        }`}
                                >
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tracking-[0.06em] ${isSelected
                                        ? "bg-cyan-100 text-cyan-700"
                                        : "bg-slate-100 text-slate-500"
                                        }`}>
                                        {item.levelPositionLabel}
                                    </span>
                                    <span className="min-w-0">
                                        <span className={`block text-sm font-black ${isSelected ? "text-cyan-800" : "text-slate-800"}`}>
                                            {item.label}
                                        </span>
                                        {item.helper ? (
                                            <span className="mt-1 block text-xs text-slate-500">
                                                {item.helper}
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {draftId && (
                    <div className="rounded-[22px] border border-white/80 bg-white/62 px-4 py-4">
                        <div className="text-[11px] font-black tracking-[0.16em] text-slate-400">現在の候補</div>
                        <div className="mt-2 text-base font-black text-slate-800">
                            {getDevStudySelectionSummary(draftSubject, draftId)?.itemLabel}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                            {getDevStudySelectionSummary(draftSubject, draftId)?.subjectLabel} {getDevStudySelectionSummary(draftSubject, draftId)?.levelLabel}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
