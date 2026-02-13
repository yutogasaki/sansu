import React from "react";
import { ikimonoGalleryStorage } from "../../utils/storage";
import { IkimonoGalleryEntry } from "./types";

interface IkimonoGalleryProps {
    profileId: string;
}

const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}`;
};

export const IkimonoGallery: React.FC<IkimonoGalleryProps> = ({ profileId }) => {
    const entries: IkimonoGalleryEntry[] = ikimonoGalleryStorage.getAll(profileId);
    const sorted = [...entries].sort((a, b) => b.generation - a.generation);

    return (
        <div>
            <h3 className="text-base font-black text-slate-800 mb-3">
                おもいで ギャラリー
            </h3>

            {sorted.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400 bg-white/60 rounded-2xl border border-white/80">
                    まだ おもいで は ないよ
                </div>
            ) : (
                <div className="space-y-2">
                    {sorted.map((entry) => (
                        <div
                            key={entry.generation}
                            className="flex items-center gap-3 px-4 py-3 bg-white/70 rounded-2xl border border-white/80 shadow-sm"
                        >
                            <div className="text-2xl">🥚</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-400">
                                    だい{entry.generation}せだい
                                </div>
                                <div className="text-sm font-black text-slate-700 truncate">
                                    「{entry.name}」
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 font-bold whitespace-nowrap">
                                {formatDate(entry.birthDate)} 〜 {formatDate(entry.departedDate)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
