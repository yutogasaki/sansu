import React, { useState } from "react";
import { Button } from "../ui/Button";

interface ParentGuardProps {
    isOpen: boolean;
    onSuccess: () => void;
    onCancel: () => void;
}

// 保護者ガード用：簡単な計算問題
const generateParentGuardQuestion = () => {
    const a = Math.floor(Math.random() * 5) + 3; // 3-7
    const b = Math.floor(Math.random() * 5) + 3; // 3-7
    return { question: `${a} + ${b} = ?`, answer: String(a + b) };
};

export const ParentGuard: React.FC<ParentGuardProps> = ({ isOpen, onSuccess, onCancel }) => {
    const [question, setQuestion] = useState(generateParentGuardQuestion());
    const [input, setInput] = useState("");

    const handleSubmit = () => {
        if (input === question.answer) {
            onSuccess();
            // Reset for next time
            setInput("");
            setQuestion(generateParentGuardQuestion());
        } else {
            setInput("");
            setQuestion(generateParentGuardQuestion());
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-xl">
                <h3 className="text-lg font-bold text-center text-slate-700">ほごしゃ かくにん</h3>
                <p className="text-center text-slate-500 text-sm">けいさん もんだい に こたえて ください</p>
                <div className="text-center text-2xl font-bold text-slate-800">{question.question}</div>
                <input
                    type="number"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 text-center text-2xl font-bold focus:border-yellow-400 outline-none"
                    autoFocus
                    placeholder="?"
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={onCancel}
                    >
                        やめる
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={handleSubmit}
                        disabled={!input}
                    >
                        OK
                    </Button>
                </div>
            </div>
        </div>
    );
};
