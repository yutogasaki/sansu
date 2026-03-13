import React from "react";
import { ArithmeticGateModal } from "./ArithmeticGateModal";
import { createMultiplicationGateChallenge } from "./arithmeticGate";

interface ParentGateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ParentGateModal: React.FC<ParentGateModalProps> = ({ isOpen, onClose, onSuccess }) => {
    return (
        <ArithmeticGateModal
            isOpen={isOpen}
            title="ほごしゃ かくにん"
            description={(
                <>
                    設定を変更するには、以下の計算に答えてください。<br />
                    <span className="text-xs text-slate-400">(お子様の誤操作防止のため)</span>
                </>
            )}
            challengeFactory={createMultiplicationGateChallenge}
            placeholder="答え"
            errorText="答えが違います"
            questionClassName="rounded-xl bg-slate-50 py-4 font-black text-primary"
            onCancel={onClose}
            onSuccess={onSuccess}
        />
    );
};
