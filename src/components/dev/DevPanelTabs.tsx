import React from "react";

export type DevTabId = "profile" | "progress" | "math" | "vocab" | "history" | "ikimono" | "constants";

interface DevPanelTabsProps {
    activeTab: DevTabId;
    onTabChange: (tab: DevTabId) => void;
}

const TABS: { id: DevTabId; label: string; icon: string }[] = [
    { id: "profile", label: "プロファイル", icon: "📊" },
    { id: "progress", label: "進捗", icon: "📈" },
    { id: "math", label: "算数", icon: "🔢" },
    { id: "vocab", label: "英語", icon: "🔤" },
    { id: "history", label: "履歴", icon: "📜" },
    { id: "ikimono", label: "いきもの", icon: "🦔" },
    { id: "constants", label: "定数", icon: "⚙️" },
];

export const DevPanelTabs: React.FC<DevPanelTabsProps> = ({ activeTab, onTabChange }) => {
    return (
        <div className="flex overflow-x-auto border-b border-slate-200 bg-white">
            {TABS.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`
                        flex-shrink-0 px-3 py-2 text-sm font-medium transition-colors
                        ${activeTab === tab.id
                            ? "text-violet-600 border-b-2 border-violet-600"
                            : "text-slate-500 hover:text-slate-700"
                        }
                    `}
                >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                </button>
            ))}
        </div>
    );
};
