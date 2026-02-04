import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

interface ParentGateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ParentGateModal: React.FC<ParentGateModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [problem, setProblem] = useState<{ a: number, b: number } | null>(null);
    const [answer, setAnswer] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Generate a random multiplication problem (2x2 to 9x9)
            // Multiplication is more secure than simple addition for a parental gate.
            const a = Math.floor(Math.random() * 8) + 2; // 2-9
            const b = Math.floor(Math.random() * 8) + 2; // 2-9
            setProblem({ a, b });
            setAnswer('');
            setError(false);
        }
    }, [isOpen]);

    if (!isOpen || !problem) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseInt(answer, 10);
        if (val === problem.a * problem.b) {
            onSuccess();
        } else {
            setError(true);
            setAnswer('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-xl">
                <h3 className="text-lg font-bold text-center text-slate-700">ほごしゃ かくにん</h3>
                <p className="text-center text-slate-500 text-sm">
                    設定を変更するには、以下の計算に答えてください。<br />
                    <span className="text-xs text-slate-400">(お子様の誤操作防止のため)</span>
                </p>

                <div className="text-center text-2xl font-black text-primary bg-slate-50 py-4 rounded-xl">
                    {problem.a} × {problem.b} = ?
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="tel"
                            pattern="\d*"
                            value={answer}
                            onChange={(e) => {
                                setAnswer(e.target.value);
                                setError(false);
                            }}
                            className={`w-full border-2 rounded-xl p-3 text-center text-2xl font-bold focus:outline-none transition-colors ${error ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 focus:border-primary text-slate-800'
                                }`}
                            placeholder="答え"
                            autoFocus
                        />
                        {error && <p className="text-red-500 text-xs mt-2 text-center font-bold">答えが違います</p>}
                    </div>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                        >
                            やめる
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={!answer}
                        >
                            OK
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
