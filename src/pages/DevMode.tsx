import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { DevPanelTabs, DevTabId } from "../components/dev/DevPanelTabs";
import { DevProfileTab } from "../components/dev/DevProfileTab";
import { DevProgressTab } from "../components/dev/DevProgressTab";
import { DevMathTab } from "../components/dev/DevMathTab";
import { DevVocabTab } from "../components/dev/DevVocabTab";
import { DevHistoryTab } from "../components/dev/DevHistoryTab";
import { DevConstantsTab } from "../components/dev/DevConstantsTab";
import { useDevPanel } from "../hooks/useDevPanel";
import { MemoryState } from "../domain/types";

export const DevMode: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<DevTabId>("profile");

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

    // Load memory states when tab changes
    useEffect(() => {
        if (activeTab === "math" && profile) {
            getMathMemoryStates().then(setMathMemory);
        } else if (activeTab === "vocab" && profile) {
            getVocabMemoryStates().then(setVocabMemory);
        }
    }, [activeTab, profile]);

    const refreshMathMemory = () => {
        getMathMemoryStates().then(setMathMemory);
    };

    const refreshVocabMemory = () => {
        getVocabMemoryStates().then(setVocabMemory);
    };

    const handleUpdateMathMemory = async (skillId: string, updates: Partial<MemoryState>) => {
        await updateMathMemoryState(skillId, updates);
        refreshMathMemory();
    };

    const handleUpdateVocabMemory = async (wordId: string, updates: Partial<MemoryState>) => {
        await updateVocabMemoryState(wordId, updates);
        refreshVocabMemory();
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                <Header title="開発者パネル" onBack={() => navigate("/")} />
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-slate-500">読み込み中...</span>
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                <Header title="開発者パネル" onBack={() => navigate("/")} />
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-red-500">エラー: {error || "プロファイルが見つかりません"}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header title="開発者パネル" onBack={() => navigate("/")} />
            <DevPanelTabs activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex-1 overflow-y-auto">
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
                {activeTab === "constants" && (
                    <DevConstantsTab />
                )}
            </div>
        </div>
    );
};
