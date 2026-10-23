import { createContext } from 'react';

/** An optional presentation outlet; standalone worksheets keep their guidance. */
export const LearningGuidanceHost = createContext<HTMLElement | null>(null);

export const LearningSupportHost = createContext<HTMLElement | null>(null);
