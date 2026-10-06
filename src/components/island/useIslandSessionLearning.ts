import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { IslandScreen } from '../../domain/island/navigation';
import { db } from '../../db';
import type { UserProfile } from '../../domain/types';
import { parkHissanGrid } from '../../domain/park/learning';
import { islandObservationBinding } from '../../domain/island/learningObservation';
import { useIslandLearningObservation, type IslandLearningRequest } from './useIslandLearningObservation';
import { commitIslandLearningSession, isFirstIslandPlan } from '../../domain/island/learningSession';
import type { IslandHabitatId, IslandLearningAction, IslandPlan, IslandRecord } from '../../domain/island/types';
import { playSound } from '../../utils/audio';
import type { useIslandActions } from './useIslandActions';
import { getIslandGrowthMilestone } from '../../domain/island/growth';
import type { IslandMilestone } from './IslandMilestone';
import { runIslandMilestoneLearningAction, useIslandMilestoneNotice } from './useIslandMilestoneNotice';
import type { useEnglishListening } from '../../hooks/useEnglishListening';
import { islandFeedbackForReceipt, type IslandLearningFeedback, type IslandReaction } from './learningFeedback';
import { learningPartyMoment } from '../../domain/island/learningParty';
import { islandPlanStars } from '../../domain/island/pacing';
import { islandStarReceipt } from './islandStarReceiptEligibility';

import type { useIslandNavigation } from './useIslandNavigation';

type LearningInputs = {
    profile: UserProfile; island: IslandRecord | undefined; plan: IslandPlan | undefined;
    setPlan: Dispatch<SetStateAction<IslandPlan | undefined>>;
    setSnapshot: Dispatch<SetStateAction<IslandRecord | undefined>>;
    setNextPlanError: Dispatch<SetStateAction<boolean>>;
    screen: IslandScreen; setScreen: (screen: IslandScreen) => void;
    navigation: ReturnType<typeof useIslandNavigation>;
    run: ReturnType<typeof useIslandActions>['run'];
    milestoneNotice: ReturnType<typeof useIslandMilestoneNotice>;
    listening: ReturnType<typeof useEnglishListening>;
    observation: ReturnType<typeof useIslandLearningObservation>;
};

/** Presentation receipts follow the same atomic learning commit as before. */
export function useIslandSessionLearning({ profile, island, plan, setPlan, setSnapshot, setNextPlanError,
    screen, setScreen, navigation, run, milestoneNotice, listening, observation }: LearningInputs) {
    const [latestMilestone, setLatestMilestone] = useState<IslandMilestone>();
    const [starReceipt, setStarReceipt] = useState<{ id: string; stars: number }>();
    const lastStarReceipt = useRef<string | undefined>(undefined);
    const [pulse, setPulse] = useState(0);
    const [reaction, setReaction] = useState<IslandReaction & { growthTarget?: IslandHabitatId }>();
    const [learningFeedback, setLearningFeedback] = useState<IslandLearningFeedback>();
    const answer = async (action: IslandLearningAction) => {
        if (!plan || screen !== 'learning') return;
        const currentSlot = plan.slots[plan.cursor];
        const written = action.type === 'answer' ? parkHissanGrid(currentSlot.problem) : null;
        const intermediate = written && (currentSlot.hissanStep ?? 0) < written.steps.length - 1;
        let request: IslandLearningRequest | undefined;
        const { result, announce } = await runIslandMilestoneLearningAction(run, milestoneNotice, action, () => {
            request = observation.request(islandObservationBinding(plan), action);
            return commitIslandLearningSession(profile.id, plan.id, plan.revision, request.action, db, request.observation);
        }, intermediate ? 0 : 180);
        if (!result) return;
        const { receipt, nextPlan, latestIsland } = result;
        if (receipt.plan.slots[plan.cursor]?.completed && !currentSlot.completed && action.type !== 'skipped') {
            listening.record(currentSlot.problem, receipt.plan.status === 'completed');
        }
        observation.succeeded(request);
        setPlan(nextPlan ?? receipt.plan); setSnapshot(latestIsland ?? receipt.island);
        setNextPlanError(Boolean(result.nextPlanError));
        const response = islandFeedbackForReceipt(plan, receipt.plan, receipt.event);
        const earnedReceipt = islandStarReceipt(plan, receipt.plan, receipt.event, lastStarReceipt.current);
        if (earnedReceipt) { lastStarReceipt.current = earnedReceipt; setStarReceipt({ id: earnedReceipt, stars: islandPlanStars(receipt.plan) }); }
        const partyMoment = response && ['correct', 'supported'].includes(response.feedback.kind)
            ? learningPartyMoment(island?.learningParty, receipt.island.learningParty) : undefined;
        setLearningFeedback(response ? { ...response.feedback, ...(partyMoment ? { party: partyMoment } : {}) } : undefined);
        if (response?.feedback.kind === 'retry' || response?.feedback.kind === 'support') milestoneNotice.dismiss();
        if (island && receipt.plan.growthTarget && receipt.plan.status === 'completed') {
            const milestone = getIslandGrowthMilestone(island, receipt.island);
            if (milestone) {
                const earned = { id: receipt.plan.id, ...milestone };
                setLatestMilestone(earned);
                if (!result.nextPlanError) announce?.(earned);
            }
        }
        setReaction(response?.reaction ? { ...response.reaction, growthTarget: plan.growthTarget } : undefined);
        if (response?.reaction?.kind === 'correct') {
            setPulse(value => value + 1);
            if (profile.soundEnabled && plan.subject === 'vocab') playSound(partyMoment?.kind === 'ride' || partyMoment?.kind === 'stamp' || receipt.plan.status === 'completed' ? 'clear' : 'correct');
        }
        if (plan.subject === 'vocab' && response?.feedback.kind === 'retry') playSound('incorrect');
        if (plan.subject === 'vocab' && response?.feedback.kind === 'step') playSound('step');
        if (receipt.plan.status === 'completed' && !nextPlan) {
            if (isFirstIslandPlan(receipt.plan) && !receipt.plan.growthTarget) { if (!navigation) setScreen('reward'); }
            else setNextPlanError(true);
        }
    };
    const slot = plan?.slots[plan.cursor];
    // Reserve one crop for the entire section, including later diagrams and their help.
    const complex = Boolean(plan?.slots.some(candidate => candidate.problem.inputType === 'multi-number'
        || candidate.problem.questionVisual?.kind === 'operation-base10' || parkHissanGrid(candidate.problem)));
    return { answer, slot, complex, latestMilestone, setLatestMilestone, starReceipt, setStarReceipt,
        pulse, reaction, setReaction, learningFeedback, setLearningFeedback };
}
