import type { ReactNode } from 'react';
import './NumberFieldsLayout.css';

/** Saved field labels identify the display shape; values keep their original order. */
export function NumberFieldsLayout({ fields, children, className }: {
    fields?: readonly { label?: string }[];
    children: ReactNode;
    className?: string;
}) {
    const labels = fields?.map(field => field.label).join('/');
    const layout = labels === '分子/分母' ? 'fraction' : labels === '整数/分子/分母' ? 'mixed' : undefined;
    return <div className={className} data-number-layout={layout}>{children}</div>;
}
