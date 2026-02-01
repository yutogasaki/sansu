import React from "react";
import { useNavigate } from "react-router-dom";
import { Icons } from "./icons";
import { Button } from "./ui/Button";

interface HeaderProps {
    title?: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, showBack, onBack, rightAction }) => {
    const navigate = useNavigate();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    return (
        <header className="flex items-center justify-between h-14 px-4 bg-transparent z-10 relative">
            <div className="flex items-center gap-2">
                {showBack && (
                    <Button variant="icon" onClick={handleBack} size="sm">
                        <Icons.Back className="w-6 h-6" />
                    </Button>
                )}
                <div className="flex flex-col">
                    {title && <h1 className="text-lg font-bold text-slate-700 leading-tight">{title}</h1>}
                    {subtitle && <span className="text-xs text-slate-400 font-bold">{subtitle}</span>}
                </div>
            </div>
            <div>{rightAction}</div>
        </header>
    );
};
