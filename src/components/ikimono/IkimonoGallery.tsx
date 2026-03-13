import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ikimonoGalleryStorage } from "../../utils/storage";
import { FuwafuwaAlbumStage, getFuwafuwaAlbumMemory } from "./fuwafuwaAlbumCopy";

interface IkimonoGalleryProps {
    profileId: string;
}

type GalleryEntry = ReturnType<typeof ikimonoGalleryStorage.getAll>[number];

const formatPeriodLabel = (iso: string): string => {
    const date = new Date(iso);
    return `${date.getFullYear()}/${date.getMonth() + 1}`;
};

const formatDateLabel = (iso: string): string => {
    const date = new Date(iso);
    return `${date.getFullYear()}ねん ${date.getMonth() + 1}がつ ${date.getDate()}にち`;
};

const getDaysTogether = (birthDate: string, departedDate: string): number => {
    const diff = new Date(departedDate).getTime() - new Date(birthDate).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
};

const MEMORY_THEME: Record<FuwafuwaAlbumStage, { badge: string; aura: string; panel: string }> = {
    egg: {
        badge: "border-emerald-100 bg-emerald-50 text-emerald-700",
        aura: "border-cyan-100 bg-cyan-50 text-cyan-700",
        panel: "border-emerald-100 bg-[linear-gradient(145deg,rgba(236,253,245,0.96)_0%,rgba(240,249,255,0.92)_100%)]",
    },
    hatching: {
        badge: "border-sky-100 bg-sky-50 text-sky-700",
        aura: "border-amber-100 bg-amber-50 text-amber-700",
        panel: "border-sky-100 bg-[linear-gradient(145deg,rgba(239,246,255,0.96)_0%,rgba(255,251,235,0.94)_100%)]",
    },
    small: {
        badge: "border-pink-100 bg-pink-50 text-pink-700",
        aura: "border-orange-100 bg-orange-50 text-orange-700",
        panel: "border-pink-100 bg-[linear-gradient(145deg,rgba(253,242,248,0.96)_0%,rgba(255,247,237,0.94)_100%)]",
    },
    medium: {
        badge: "border-cyan-100 bg-cyan-50 text-cyan-700",
        aura: "border-emerald-100 bg-emerald-50 text-emerald-700",
        panel: "border-cyan-100 bg-[linear-gradient(145deg,rgba(236,254,255,0.96)_0%,rgba(236,253,245,0.94)_100%)]",
    },
    adult: {
        badge: "border-violet-100 bg-violet-50 text-violet-700",
        aura: "border-slate-200 bg-slate-50 text-slate-600",
        panel: "border-violet-100 bg-[linear-gradient(145deg,rgba(245,243,255,0.96)_0%,rgba(248,250,252,0.94)_100%)]",
    },
    fading: {
        badge: "border-amber-100 bg-amber-50 text-amber-700",
        aura: "border-rose-100 bg-rose-50 text-rose-700",
        panel: "border-amber-100 bg-[linear-gradient(145deg,rgba(255,251,235,0.96)_0%,rgba(255,241,242,0.94)_100%)]",
    },
};

const AlbumDetailModal: React.FC<{
    entry: GalleryEntry | null;
    onClose: () => void;
}> = ({ entry, onClose }) => {
    if (!entry) return null;

    const daysTogether = getDaysTogether(entry.birthDate, entry.departedDate);
    const memory = getFuwafuwaAlbumMemory(
        daysTogether,
        `${entry.name}:${entry.generation}:${entry.birthDate}:${entry.departedDate}:${entry.species ?? 0}`,
    );
    const theme = MEMORY_THEME[memory.phase];
    const imageSpecies = entry.species ?? 0;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/48 p-5 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/85 bg-white/95 shadow-[0_36px_90px_-40px_rgba(15,23,42,0.62)]"
                    onClick={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-sm transition hover:bg-white"
                        aria-label="とじる"
                    >
                        <X size={16} />
                    </button>

                    <div className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(236,254,255,0.96)_0%,rgba(255,247,237,0.92)_100%)] px-6 pt-8 pb-6 text-center">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(255,255,255,0.55),transparent_22%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.38),transparent_18%),radial-gradient(circle_at_56%_74%,rgba(251,191,36,0.18),transparent_24%)]" />

                        <motion.div
                            animate={{ y: [0, -5, 0], scale: [1, 1.03, 1] }}
                            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                            className="relative z-10 mx-auto mb-5 h-36 w-36 rounded-full border-[4px] border-white/90 bg-white p-1 shadow-[0_22px_52px_-30px_rgba(15,23,42,0.45)]"
                        >
                            <picture className="block h-full w-full overflow-hidden rounded-full bg-white">
                                <source srcSet={`/ikimono/${imageSpecies}-${memory.imageSuffix}.webp`} type="image/webp" />
                                <img
                                    src={`/ikimono/${imageSpecies}-${memory.imageSuffix}.png`}
                                    alt={entry.name}
                                    className="h-full w-full rounded-full object-cover"
                                    draggable={false}
                                />
                            </picture>
                        </motion.div>

                        <div className="relative z-10 inline-flex rounded-full border border-white/80 bg-white/76 px-3 py-1 text-[11px] font-black tracking-wide text-slate-500">
                            だい{entry.generation}せだい
                        </div>

                        <h4 className="relative z-10 mt-3 text-[1.45rem] font-black text-slate-800">
                            {entry.name}
                        </h4>
                        <p className="relative z-10 mt-2 text-xs font-bold leading-6 text-slate-500">
                            {memory.cardTone}
                        </p>

                        <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
                            <div className={`rounded-full border px-3 py-1 text-[11px] font-black tracking-wide ${theme.badge}`}>
                                {memory.phaseLabel}
                            </div>
                            <div className={`rounded-full border px-3 py-1 text-[11px] font-black tracking-wide ${theme.aura}`}>
                                {memory.auraLabel}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 px-6 pt-5 pb-6">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/90 bg-cyan-50/82 px-4 py-3 text-center">
                                <div className="text-[11px] font-black tracking-wide text-cyan-700">いっしょにいた</div>
                                <div className="mt-1 text-xl font-black text-slate-800">{daysTogether}にち</div>
                            </div>
                            <div className="rounded-2xl border border-white/90 bg-amber-50/82 px-4 py-3 text-center">
                                <div className="text-[11px] font-black tracking-wide text-amber-700">おもいで</div>
                                <div className="mt-1 text-xl font-black text-slate-800">{entry.generation}だいめ</div>
                            </div>
                        </div>

                        <div className={`rounded-[1.45rem] border px-4 py-4 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.5)] ${theme.panel}`}>
                            <div className="text-[11px] font-black tracking-wide text-slate-400">
                                このころの ふわふわ
                            </div>
                            <div className="mt-2 text-sm font-black leading-7 text-slate-800">
                                {memory.headline}
                            </div>
                            <p className="mt-2 text-xs font-bold leading-6 text-slate-600">
                                {memory.reflection}
                            </p>
                            <p className="mt-3 text-[11px] font-black leading-5 text-slate-500">
                                {memory.closing}
                            </p>
                        </div>

                        <div className="rounded-[1.35rem] border border-white/85 bg-white/78 px-4 py-4 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.5)]">
                            <div className="text-[11px] font-black tracking-wide text-slate-400">きろく</div>
                            <div className="mt-2 text-sm font-bold leading-7 text-slate-700">
                                {formatDateLabel(entry.birthDate)} から
                                <br />
                                {formatDateLabel(entry.departedDate)} まで
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-400">
                                {formatPeriodLabel(entry.birthDate)} 〜 {formatPeriodLabel(entry.departedDate)}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(140deg,#0ea5a4_0%,#14b8a6_52%,#38bdf8_100%)] px-5 py-4 text-base font-black text-white shadow-[0_18px_34px_-18px_rgba(8,145,178,0.8)] transition active:scale-[0.985]"
                        >
                            また みにくる
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
};

export const IkimonoGallery: React.FC<IkimonoGalleryProps> = ({ profileId }) => {
    const [selectedEntry, setSelectedEntry] = useState<GalleryEntry | null>(null);
    const sorted = useMemo(() => {
        const entries = ikimonoGalleryStorage.getAll(profileId);
        return [...entries].sort((a, b) => b.generation - a.generation);
    }, [profileId]);

    return (
        <div>
            <AlbumDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />

            <h3 className="mb-3 text-base font-black text-slate-800">
                ふわふわ アルバム
            </h3>

            {sorted.length === 0 ? (
                <div className="rounded-2xl border border-white/80 bg-white/60 py-6 text-center text-sm text-slate-400">
                    まだ ふわふわ の おもいで は ないよ
                </div>
            ) : (
                <div className="space-y-2">
                    {sorted.map((entry) => {
                        const daysTogether = getDaysTogether(entry.birthDate, entry.departedDate);
                        const memory = getFuwafuwaAlbumMemory(
                            daysTogether,
                            `${entry.name}:${entry.generation}:${entry.birthDate}:${entry.departedDate}:${entry.species ?? 0}`,
                        );
                        const theme = MEMORY_THEME[memory.phase];

                        return (
                            <button
                                key={entry.generation}
                                type="button"
                                onClick={() => setSelectedEntry(entry)}
                                className="flex w-full items-center gap-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-left shadow-sm transition hover:bg-white/90"
                                aria-label={`${entry.name} の ふわふわを みる`}
                            >
                                <picture className="h-10 w-10 overflow-hidden rounded-full bg-white">
                                    <source srcSet={`/ikimono/${entry.species ?? 0}-${memory.imageSuffix}.webp`} type="image/webp" />
                                    <img
                                        src={`/ikimono/${entry.species ?? 0}-${memory.imageSuffix}.png`}
                                        alt=""
                                        className="h-10 w-10 rounded-full object-cover"
                                        draggable={false}
                                    />
                                </picture>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-400">
                                        だい{entry.generation}せだい
                                    </div>
                                    <div className="truncate text-sm font-black text-slate-700">
                                        「{entry.name}」
                                    </div>
                                    <div className="mt-1 truncate text-[11px] font-bold text-slate-500">
                                        {memory.cardTone}
                                    </div>
                                </div>
                                <div className="shrink-0 whitespace-nowrap text-right">
                                    <div className="text-xs font-bold text-slate-400">
                                        {formatPeriodLabel(entry.birthDate)} 〜 {formatPeriodLabel(entry.departedDate)}
                                    </div>
                                    <div className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[10px] font-black tracking-wide ${theme.badge}`}>
                                        {memory.phaseLabel}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
