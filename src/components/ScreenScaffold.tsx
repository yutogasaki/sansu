import React from "react";
import { Header } from "./Header";
import { cn } from "../utils/cn";

type FooterSpacing = "nav" | "base" | "none";

interface ScreenScaffoldProps {
    title: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    rightAction?: React.ReactNode;
    topSlot?: React.ReactNode;
    children: React.ReactNode;
    containerClassName?: string;
    contentClassName?: string;
    scroll?: boolean;
    footerSpacing?: FooterSpacing;
}

const footerSpacingClassMap: Record<FooterSpacing, string> = {
    nav: "pb-[var(--screen-bottom-with-footer)]",
    base: "pb-[var(--screen-bottom-padding)]",
    none: "",
};

export const ScreenScaffold: React.FC<ScreenScaffoldProps> = ({
    title,
    subtitle,
    showBack,
    onBack,
    rightAction,
    topSlot,
    children,
    containerClassName,
    contentClassName,
    scroll = true,
    footerSpacing = "nav",
}) => {
    return (
        <div className={cn("flex h-full min-h-0 flex-col bg-transparent", containerClassName)}>
            <Header
                title={title}
                subtitle={subtitle}
                showBack={showBack}
                onBack={onBack}
                rightAction={rightAction}
            />
            {topSlot}
            <div
                className={cn(
                    "flex-1",
                    scroll ? "overflow-y-auto" : "overflow-hidden",
                    footerSpacingClassMap[footerSpacing],
                    contentClassName
                )}
            >
                {children}
            </div>
        </div>
    );
};
