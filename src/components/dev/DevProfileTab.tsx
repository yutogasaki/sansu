import React from "react";
import { UserProfile } from "../../domain/types";
import { DevFieldRow } from "./DevFieldRow";

interface DevProfileTabProps {
    profile: UserProfile;
    onUpdate: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void;
}

const gradeOptions = [
    { value: "-2", label: "年少" },
    { value: "-1", label: "年中" },
    { value: "0", label: "年長" },
    { value: "1", label: "1年生" },
    { value: "2", label: "2年生" },
    { value: "3", label: "3年生" },
    { value: "4", label: "4年生" },
    { value: "5", label: "5年生" },
    { value: "6", label: "6年生" },
] as const;

export const DevProfileTab: React.FC<DevProfileTabProps> = ({ profile, onUpdate }) => {
    return (
        <div className="p-4 space-y-4">
            <h3 className="font-bold text-slate-700">基本情報</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <DevFieldRow label="ID" code="id" value={profile.id} />
                <DevFieldRow
                    label="名前"
                    code="name"
                    value={profile.name}
                    editable
                    type="text"
                    onChange={value => {
                        if (typeof value === "string") {
                            onUpdate("name", value);
                        }
                    }}
                />
                <DevFieldRow
                    label="学年"
                    code="grade"
                    value={profile.grade}
                    editable
                    type="select"
                    options={gradeOptions}
                    onChange={value => {
                        if (typeof value === "string") {
                            onUpdate("grade", Number(value));
                        }
                    }}
                />
            </div>

            <h3 className="font-bold text-slate-700">設定</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <DevFieldRow
                    label="出題モード"
                    code="subjectMode"
                    value={profile.subjectMode}
                    editable
                    type="select"
                    options={[
                        { value: "mix", label: "ミックス" },
                        { value: "math", label: "算数のみ" },
                        { value: "vocab", label: "英語のみ" },
                    ]}
                    onChange={value => {
                        if (value === "mix" || value === "math" || value === "vocab") {
                            onUpdate("subjectMode", value);
                        }
                    }}
                />
                <DevFieldRow
                    label="効果音"
                    code="soundEnabled"
                    value={profile.soundEnabled}
                    editable
                    type="boolean"
                    onChange={value => onUpdate("soundEnabled", value === true)}
                />
                <DevFieldRow
                    label="漢字表示"
                    code="kanjiMode"
                    value={profile.kanjiMode}
                    editable
                    type="boolean"
                    onChange={value => onUpdate("kanjiMode", value === true)}
                />
                <DevFieldRow
                    label="英語自動読み"
                    code="englishAutoRead"
                    value={profile.englishAutoRead}
                    editable
                    type="boolean"
                    onChange={value => onUpdate("englishAutoRead", value === true)}
                />
                <DevFieldRow
                    label="日次目標"
                    code="dailyGoal"
                    value={profile.dailyGoal}
                    editable
                    type="number"
                    onChange={value => onUpdate("dailyGoal", typeof value === "number" ? Math.max(0, value) : undefined)}
                />
            </div>
        </div>
    );
};
