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
        <header className="flex items-center justify-between h-14 px-4 bg-white/42 backdrop-blur-md border border-white/60 rounded-2xl z-10 relative shadow-[0_10px_20px_-18px_rgba(15,23,42,0.7)]">
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

            {title && center && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    {/* If title exists on left, maybe we don't want center? 
                         But user asked for center. 
                         Let's just put it in center. */}
                </div>
            )}

            {center && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {center}
                </div>
            )}

            <div>{rightAction}</div>
        </header>
    );
};
