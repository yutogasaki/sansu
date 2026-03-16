import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icons } from "./icons";
import { warmUpTTS } from "../utils/tts";

type TabItem = {
    to: string;
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
    activePaths?: string[];
};

export const Footer: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;

    const leftTabs: TabItem[] = [
        { to: "/", icon: Icons.Home, label: "ホーム" },
        { to: "/stats", icon: Icons.Stats, label: "きろく" },
    ];

    const rightTabs: TabItem[] = [
        { to: "/battle", icon: Icons.Play, label: "たいせん" },
        { to: "/settings", icon: Icons.Settings, label: "せってい", activePaths: ["/settings", "/parents", "/dev"] },
    ];

    const renderTab = (item: TabItem) => {
        const activePaths = item.activePaths ?? [item.to];
        const isActive = activePaths.some((path) => (
            path === "/"
                ? currentPath === "/"
                : currentPath === path || currentPath.startsWith(`${path}/`)
        ));

        return (
            <button
                key={item.to}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                    if (item.to === currentPath) return;
                    navigate(item.to);
                }}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: "8px 16px",
                    color: isActive ? "#2BBAA0" : "#B2BEC3",
                    transition: "color 0.2s ease",
                }}
            >
                <item.icon
                    width={22}
                    height={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    style={{ pointerEvents: "none" }}
                    aria-hidden="true"
                />
                <span
                    style={{
                        fontSize: 10,
                        fontWeight: 500,
                        fontFamily: "var(--font-body)",
                        pointerEvents: "none",
                    }}
                >
                    {item.label}
                </span>
            </button>
        );
    };

    return (
        <nav
            style={{
                position: "fixed",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "min(100%, 430px)",
                height: "calc(56px + env(safe-area-inset-bottom, 0px))",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                background: "var(--toolbar-bg)",
                backdropFilter: "blur(var(--blur-lg))",
                WebkitBackdropFilter: "blur(var(--blur-lg))",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "var(--toolbar-shadow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
                zIndex: 50,
            }}
        >
            {leftTabs.map(renderTab)}

            <button
                className="fab"
                type="button"
                aria-label="まなぶ"
                onClick={() => {
                    warmUpTTS();
                    navigate("/study");
                }}
            >
                <Icons.Study
                    width={26}
                    height={26}
                    strokeWidth={2.6}
                    color="#FFFFFF"
                    aria-hidden="true"
                />
            </button>

            {rightTabs.map(renderTab)}
        </nav>
    );
};
