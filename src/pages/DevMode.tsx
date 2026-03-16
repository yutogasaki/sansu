import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DevPanelTabs, DevTabId } from "../components/dev/DevPanelTabs";
import { DevProfileTab } from "../components/dev/DevProfileTab";
import { DevProgressTab } from "../components/dev/DevProgressTab";
import { DevMathTab } from "../components/dev/DevMathTab";
import { DevVocabTab } from "../components/dev/DevVocabTab";
import { DevHistoryTab } from "../components/dev/DevHistoryTab";
import { DevConstantsTab } from "../components/dev/DevConstantsTab";
import { DevIkimonoTab } from "../components/dev/DevIkimonoTab";
import { useDevPanel } from "../hooks/useDevPanel";
import { Spinner } from "../components/ui/Spinner";
import { MemoryState } from "../domain/types";
import { ScreenScaffold } from "../components/ScreenScaffold";

export const DevMode: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab") as DevTabId | null;
    const initialTab: DevTabId = tabParam && ["profile", "progress", "math", "vocab", "history", "ikimono", "constants"].includes(tabParam)
        ? tabParam
        : "profile";
    const [activeTab, setActiveTab] = useState<DevTabId>(initialTab);

    const {
        profile,
        loading,
        error,
        updateProfile,
        updatePeriodicTestState,
        getMathMemoryStates,
        getVocabMemoryStates,
        updateMathMemoryState,
        updateVocabMemoryState
    } = useDevPanel();

    // Memory states for math/vocab tabs
    const [mathMemory, setMathMemory] = useState<MemoryState[]>([]);
    const [vocabMemory, setVocabMemory] = useState<MemoryState[]>([]);
    const isMountedRef = useRef(true);
    const mathRequestIdRef = useRef(0);
    const vocabRequestIdRef = useRef(0);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            mathRequestIdRef.current += 1;
            vocabRequestIdRef.current += 1;
        };
    }, []);

    const refreshMathMemory = useCallback(async () => {
        const requestId = ++mathRequestIdRef.current;
        const nextMemory = await getMathMemoryStates();
        if (!isMountedRef.current || mathRequestIdRef.current !== requestId) {
            return;
        }

        setMathMemory(nextMemory);
    }, [getMathMemoryStates]);

    const refreshVocabMemory = useCallback(async () => {
        const requestId = ++vocabRequestIdRef.current;
        const nextMemory = await getVocabMemoryStates();
        if (!isMountedRef.current || vocabRequestIdRef.current !== requestId) {
            return;
        }

        setVocabMemory(nextMemory);
    }, [getVocabMemoryStates]);

    // Load memory states when tab changes
    useEffect(() => {
        if (activeTab === "math" && profile) {
            void refreshMathMemory();
        } else if (activeTab === "vocab" && profile) {
            void refreshVocabMemory();
        }
    }, [activeTab, profile, refreshMathMemory, refreshVocabMemory]);

    useEffect(() => {
        if (searchParams.get("tab") === activeTab) {
            return;
        }

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("tab", activeTab);
        setSearchParams(nextSearchParams, { replace: true });
    }, [activeTab, searchParams, setSearchParams]);

    const handleUpdateMathMemory = async (skillId: string, updates: Partial<MemoryState>) => {
        await updateMathMemoryState(skillId, updates);
        await refreshMathMemory();
    };

    const handleUpdateVocabMemory = async (wordId: string, updates: Partial<MemoryState>) => {
        await updateVocabMemoryState(wordId, updates);
        await refreshVocabMemory();
    };
    const tabs = <DevPanelTabs activeTab={activeTab} onTabChange={setActiveTab} />;

    if (loading) {
        return (
            <ScreenScaffold title="開発者パネル" footerSpacing="none" scroll={false}>
                <Spinner fullScreen />
            </ScreenScaffold>
        );
    }

    if (error || !profile) {
        return (
            <ScreenScaffold title="開発者パネル" footerSpacing="none" scroll={false}>
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-red-500">エラー: {error || "プロファイルが見つかりません"}</span>
                </div>
            </ScreenScaffold>
        );
    }

    return (
        <ScreenScaffold
            title="開発者パネル"
            onBack={() => navigate("/")}
            topSlot={tabs}
            contentClassName="pb-[var(--screen-bottom-with-footer)]"
        >
                {activeTab === "profile" && (
                    <DevProfileTab profile={profile} onUpdate={updateProfile} />
                )}
                {activeTab === "progress" && (
                    <DevProgressTab
                        profile={profile}
                        onUpdate={updateProfile}
                        onUpdatePeriodicTest={updatePeriodicTestState}
                    />
                )}
                {activeTab === "math" && (
                    <DevMathTab
                        memoryStates={mathMemory}
                        onUpdateMemory={handleUpdateMathMemory}
                        onRefreshMemory={refreshMathMemory}
                    />
                )}
                {activeTab === "vocab" && (
                    <DevVocabTab
                        memoryStates={vocabMemory}
                        onUpdateMemory={handleUpdateVocabMemory}
                        onRefreshMemory={refreshVocabMemory}
                    />
                )}
                {activeTab === "history" && (
                    <DevHistoryTab profile={profile} />
                )}
                {activeTab === "ikimono" && (
                    <DevIkimonoTab profileId={profile.id} />
                )}
                {activeTab === "constants" && (
                    <DevConstantsTab />
                )}
        </ScreenScaffold>
    );
};
