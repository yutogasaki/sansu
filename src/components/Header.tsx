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
    center?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, showBack, onBack, rightAction, center }) => {
    const navigate = useNavigate();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    return (
        <header className="app-glass-strong relative z-10 flex min-h-14 items-center justify-between rounded-[1.6rem] px-4 py-3 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.65)]">
            <div className="flex items-center gap-2">
                {showBack && (
                    <Button variant="icon" onClick={handleBack} size="sm">
                        <Icons.Back className="w-6 h-6" />
                    </Button>
                )}
                <div className="flex flex-col">
                    {title && <h1 className="text-xl font-bold text-text-main leading-tight">{title}</h1>}
                    {subtitle && <span className="text-xs text-text-sub font-bold">{subtitle}</span>}
                </div>
            </div>

            {center && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {center}
                </div>
            )}

            <div>{rightAction}</div>
        </header>
    );
};
