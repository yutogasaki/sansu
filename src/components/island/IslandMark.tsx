import { Leaf, type LucideProps } from 'lucide-react';

/** The same leaf used to identify the island and its supporting screens. */
export function IslandMark(props: LucideProps) {
    return <Leaf aria-hidden="true" data-island-mark="leaf" {...props} />;
}
