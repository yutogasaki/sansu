import { IkimonoStage } from "./types";

export type VisibleIkimonoStage = Exclude<IkimonoStage, "gone">;

export type FuwafuwaMilestoneKind =
    | "birth"
    | "growth"
    | "adult"
    | "farewell_soon";

export interface IkimonoTransitionState {
    profileId: string;
    generation: number;
    lastSeenStage: VisibleIkimonoStage;
}

const STAGE_ORDER: Record<VisibleIkimonoStage, number> = {
    egg: 0,
    hatching: 1,
    small: 2,
    medium: 3,
    adult: 4,
    fading: 5,
};

export function getMilestoneKind(stage: VisibleIkimonoStage): FuwafuwaMilestoneKind | null {
    switch (stage) {
        case "small":
            return "birth";
        case "medium":
            return "growth";
        case "adult":
            return "adult";
        case "fading":
            return "farewell_soon";
        case "egg":
        case "hatching":
        default:
            return null;
    }
}

export function getNextTransitionState(
    previous: IkimonoTransitionState | null,
    profileId: string,
    generation: number,
    stage: VisibleIkimonoStage,
): { nextState: IkimonoTransitionState; milestone: FuwafuwaMilestoneKind | null } {
    const nextState: IkimonoTransitionState = {
        profileId,
        generation,
        lastSeenStage: stage,
    };

    if (!previous || previous.profileId !== profileId || previous.generation !== generation) {
        return { nextState, milestone: null };
    }

    if (STAGE_ORDER[stage] <= STAGE_ORDER[previous.lastSeenStage]) {
        return { nextState, milestone: null };
    }

    return {
        nextState,
        milestone: getMilestoneKind(stage),
    };
}
