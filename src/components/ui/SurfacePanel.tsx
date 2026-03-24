import React from "react";
import { cn } from "../../utils/cn";
import { Card } from "./Card";

interface SectionLabelProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({ className, children, ...props }) => (
    <h2
        className={cn(
            "px-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500/90",
            className
        )}
        {...props}
    >
        {children}
    </h2>
);

type SurfacePanelProps = React.ComponentPropsWithoutRef<typeof Card>;

export const SurfacePanel = React.forwardRef<HTMLDivElement, SurfacePanelProps>(
    ({ className, children, ...props }, ref) => (
        <Card
            ref={ref}
            className={cn(
                "p-4 space-y-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)]",
                className
            )}
            {...props}
        >
            {children}
        </Card>
    )
);

SurfacePanel.displayName = "SurfacePanel";

interface SurfacePanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
}

export const SurfacePanelHeader: React.FC<SurfacePanelHeaderProps> = ({
    className,
    title,
    description,
    action,
    ...props
}) => (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)} {...props}>
        <div className="min-w-0 flex-1 basis-[12rem]">
            <h3 className="text-[15px] font-black tracking-[-0.01em] text-slate-800">{title}</h3>
            {description ? (
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{description}</p>
            ) : null}
        </div>
        {action ? <div className="shrink-0 mobile:flex mobile:w-full mobile:justify-end">{action}</div> : null}
    </div>
);

type InsetPanelProps = React.HTMLAttributes<HTMLDivElement>;

export const InsetPanel = React.forwardRef<HTMLDivElement, InsetPanelProps>(
    ({ className, children, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "rounded-[18px] border border-white/80 bg-white/58 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
);

InsetPanel.displayName = "InsetPanel";

type PanelDividerProps = React.HTMLAttributes<HTMLDivElement>;

export const PanelDivider: React.FC<PanelDividerProps> = ({ className, ...props }) => (
    <div className={cn("h-px bg-white/75", className)} {...props} />
);

interface SettingRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
}

export const SettingRow: React.FC<SettingRowProps> = ({
    className,
    title,
    description,
    action,
    ...props
}) => (
    <div
        className={cn("flex flex-wrap items-start justify-between gap-3", className)}
        {...props}
    >
        <div className="min-w-0 flex-1 basis-[12rem]">
            <div className="font-bold text-slate-700">{title}</div>
            {description ? (
                <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            ) : null}
        </div>
        {action ? <div className="shrink-0 mobile:flex mobile:w-full mobile:justify-end">{action}</div> : null}
    </div>
);

interface SegmentedControlOption<T extends string> {
    value: T;
    label: React.ReactNode;
}

interface SegmentedControlProps<T extends string> extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
    value: T;
    options: SegmentedControlOption<T>[];
    onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
    className,
    value,
    options,
    onChange,
    ...props
}: SegmentedControlProps<T>) {
    const gridClassName =
        options.length <= 2
            ? "grid-cols-2"
            : options.length === 3
                ? "grid-cols-2 land:grid-cols-3 sm:grid-cols-3"
                : "grid-cols-2 sm:grid-cols-4";

    return (
        <div
            className={cn(
                "grid gap-1.5 rounded-[16px] border border-white/80 bg-white/55 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]",
                gridClassName,
                className
            )}
            {...props}
        >
            {options.map((option, index) => {
                const isActive = option.value === value;
                const isLastMobileWideOption = options.length === 3 && index === options.length - 1;

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "min-w-0 rounded-[12px] px-3 py-2.5 text-center text-sm font-bold leading-4 transition-all",
                            isLastMobileWideOption && "col-span-2 land:col-span-1 sm:col-span-1",
                            isActive
                                ? "bg-white text-slate-800 shadow-[0_10px_22px_-16px_rgba(15,23,42,0.32)]"
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

interface SelectionCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: React.ReactNode;
    description?: React.ReactNode;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
}

export const SelectionCard = React.forwardRef<HTMLButtonElement, SelectionCardProps>(
    ({ className, label, description, leading, trailing, ...props }, ref) => (
        <button
            ref={ref}
            type="button"
            className={cn(
                "group relative flex w-full items-center gap-4 rounded-[18px] border border-white/85 bg-white/72 px-4 py-4 text-left shadow-[0_16px_32px_-24px_rgba(15,23,42,0.24)] transition-all hover:border-cyan-300 hover:bg-cyan-50/60 hover:shadow-[0_18px_38px_-24px_rgba(34,197,94,0.18)] active:scale-[0.985] disabled:opacity-50",
                className
            )}
            {...props}
        >
            {leading ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-700 group-hover:bg-white">
                    {leading}
                </div>
            ) : null}
            <div className="min-w-0 flex-1">
                <div className="font-bold text-lg text-slate-700 group-hover:text-slate-900">{label}</div>
                {description ? (
                    <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
                ) : null}
            </div>
            {trailing ? (
                <div className="shrink-0 text-slate-300 group-hover:text-cyan-600">
                    {trailing}
                </div>
            ) : null}
        </button>
    )
);

SelectionCard.displayName = "SelectionCard";
