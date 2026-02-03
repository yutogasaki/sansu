import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { MATH_CURRICULUM } from "../domain/math/curriculum";

// スキル名の日本語ラベル
const SKILL_LABELS: Record<string, string> = {
    // 数える
    count_10: "10まで数える",
    count_50: "50まで数える",
    count_100: "100まで数える",
    count_fill: "□を埋める",
    compare_1d: "1桁の比較",
    compare_2d: "2桁の比較",
    // 足し算
    add_1d_1: "1桁+1桁(簡単)",
    add_1d_2: "1桁+1桁",
    add_2d1d_nc: "2桁+1桁(繰り上がりなし)",
    add_2d1d_c: "2桁+1桁(繰り上がり)",
    add_2d2d_nc: "2桁+2桁(繰り上がりなし)",
    add_2d2d_c: "2桁+2桁(繰り上がり)",
    add_3d3d: "3桁+3桁",
    add_4d: "4桁の足し算",
    // 引き算
    sub_1d1d_nc: "1桁-1桁(繰り下がりなし)",
    sub_1d1d_c: "1桁-1桁(繰り下がり)",
    sub_2d1d_nc: "2桁-1桁(繰り下がりなし)",
    sub_2d1d_c: "2桁-1桁(繰り下がり)",
    sub_2d2d: "2桁-2桁",
    sub_3d3d: "3桁-3桁",
    sub_4d: "4桁の引き算",
    // 掛け算
    mul_99_1: "九九(1の段)",
    mul_99_2: "九九(2の段)",
    mul_99_3: "九九(3の段)",
    mul_99_4: "九九(4の段)",
    mul_99_5: "九九(5の段)",
    mul_99_6: "九九(6の段)",
    mul_99_7: "九九(7の段)",
    mul_99_8: "九九(8の段)",
    mul_99_9: "九九(9の段)",
    mul_99_rand: "九九(ランダム)",
    mul_2d1d: "2桁×1桁",
    mul_3d1d: "3桁×1桁",
    mul_2d2d: "2桁×2桁",
    mul_3d2d: "3桁×2桁",
    // 割り算
    div_99_rev: "九九の逆(割り算)",
    div_2d1d_exact: "2桁÷1桁(割り切れる)",
    div_rem_q1: "余りあり(商1桁)",
    div_rem_q2: "余りあり(商2桁)",
    div_2d2d_exact: "2桁÷2桁",
    div_3d1d_exact: "3桁÷1桁",
    div_3d2d_exact: "3桁÷2桁",
    // 小数
    dec_add: "小数の足し算",
    dec_sub: "小数の引き算",
    dec_mul_int: "小数×整数",
    dec_div_int: "小数÷整数",
    dec_mul_dec: "小数×小数",
    dec_div_dec: "小数÷小数",
    // 分数
    frac_add_same: "同分母の足し算",
    frac_sub_same: "同分母の引き算",
    frac_add_diff: "異分母の足し算",
    frac_sub_diff: "異分母の引き算",
    frac_mixed: "帯分数(足)",
    frac_mixed_sub: "帯分数(引)",
    frac_mul_int: "分数×整数",
    frac_mul_frac: "分数×分数",
    frac_div_int: "分数÷整数",
    frac_div_frac: "分数÷分数",
    scale_10x: "10倍・100倍",
};

export const DevMode: React.FC = () => {
    const navigate = useNavigate();
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

    const handleStart = () => {
        if (selectedSkill) {
            // スキルIDをクエリパラメータで渡す
            navigate(`/study?dev_skill=${selectedSkill}`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header title="開発者モード" onBack={() => navigate("/")} />

            <div className="flex-1 overflow-y-auto p-4 space-y-4 land:grid land:grid-cols-2 land:gap-4 land:space-y-0">
                <p className="text-sm text-slate-500 land:col-span-2">
                    テストしたいスキルを選んでください
                </p>

                {Object.entries(MATH_CURRICULUM).map(([level, skills]) => (
                    <Card key={level} className="p-4">
                        <h3 className="font-bold text-slate-700 mb-3">
                            レベル {level}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {skills.map((skill) => (
                                <Button
                                    key={skill}
                                    size="sm"
                                    variant={selectedSkill === skill ? "primary" : "secondary"}
                                    onClick={() => setSelectedSkill(skill)}
                                    className="text-xs"
                                >
                                    {SKILL_LABELS[skill] || skill}
                                </Button>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>

            {/* 選択中のスキル表示と開始ボタン */}
            {selectedSkill && (
                <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                    <div className="text-center">
                        <span className="text-sm text-slate-500">選択中: </span>
                        <span className="font-bold text-slate-700">
                            {SKILL_LABELS[selectedSkill] || selectedSkill}
                        </span>
                    </div>
                    <Button
                        size="xl"
                        className="w-full"
                        onClick={handleStart}
                    >
                        このスキルでテスト開始
                    </Button>
                </div>
            )}
        </div>
    );
};
