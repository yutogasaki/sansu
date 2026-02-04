import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';


interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: "sm" | "md" | "lg";
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    width = "sm"
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: "max-w-xs",
        md: "max-w-md",
        lg: "max-w-lg"
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Content */}
            <div className={`relative bg-white rounded-2xl w-full ${sizeClasses[width]} shadow-2xl transform transition-all flex flex-col max-h-[90vh]`}>
                {title && (
                    <div className="p-4 border-b border-slate-100 flex items-center justify-center">
                        <h3 className="text-lg font-bold text-slate-700">{title}</h3>
                    </div>
                )}

                <div className="p-6 overflow-y-auto">
                    {children}
                </div>

                {footer && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
