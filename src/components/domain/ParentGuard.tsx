import React from "react";
import { ArithmeticGateModal } from "../gate/ArithmeticGateModal";
import { createAdditionGateChallenge } from "../gate/arithmeticGate";

interface ParentGuardProps {
    isOpen: boolean;
    onSuccess: () => void;
    onCancel: () => void;
}

export const ParentGuard: React.FC<ParentGuardProps> = ({ isOpen, onSuccess, onCancel }) => {
    return (
        <ArithmeticGateModal
            isOpen={isOpen}
            title="ほごしゃ かくにん"
            description="けいさん もんだい に こたえて ください"
            challengeFactory={createAdditionGateChallenge}
            refreshOnError
            onCancel={onCancel}
            onSuccess={onSuccess}
        />
    );
};
