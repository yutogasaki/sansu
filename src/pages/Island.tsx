import { IslandHelp, IslandTutorial, TUTORIAL_TOPICS } from '../components/island/tutorial/IslandTutorial';
import { useIslandTutorial } from '../components/island/tutorial/useIslandTutorial';
import type { TutorialId } from '../domain/island/tutorialState';
import HomeJourneyPreview from '../components/island/homeJourney/HomeJourneyPreview';
import { homeJourneyEnabled } from '../domain/island/homeJourney';
import { crossedHomeJourneyStep } from '../components/island/homeJourney/growthReveal';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Gift, Leaf, Settings2, X } from 'lucide-react';
import { useIslandNavigation } from '../components/island/useIslandNavigation';
import type { IslandScreen } from '../domain/island/navigation';
import { db } from '../db';
import { getActiveProfile, updateProfileAtomically } from '../domain/user/repository';
import type { UserProfile } from '../domain/types';
import { assertIslandPlan, claimIslandReward, openIsland, saveIslandEdit, startIslandPlan } from '../domain/island/repository';
import { parkHissanGrid } from '../domain/park/learning';
import { islandObservationBinding } from '../domain/island/learningObservation';
import { useIslandLearningObservation, type IslandLearningRequest } from '../components/island/useIslandLearningObservation';
import { commitIslandLearningSession, isFirstIslandPlan } from '../domain/island/learningSession';
import { setIslandNextSubject } from '../domain/island/subjectPreference';
import { findAvailablePosition, ISLAND_ITEMS, isValidIslandPlacement } from '../domain/island/catalog';
import { ISLAND_DELIVERY_ID, ISLAND_VISUAL_CANDIDATE, ISLAND_LEARNING_CANDIDATE } from '../domain/island/feature';
import type { IslandBasicItemKind, IslandHabitatId, IslandItem, IslandLearningAction, IslandPlan, IslandRecord } from '../domain/island/types';
import { selectIslandGrowthTarget, setIslandItemAppearance } from '../domain/island/growthRepository';
import { holdPwaUpdateForCriticalPersistence, reachPwaUpdateCheckpoint } from '../pwa';
import { playSound, setSoundEnabled } from '../utils/audio';
import IslandStage from '../components/island/IslandStage';
import { IslandInventory, IslandPlacement, IslandPlacementActions, IslandPlay, IslandRewards } from '../components/island/IslandItems';
import { useIslandActions } from '../components/island/useIslandActions';
import { useIslandDiscoveries } from '../components/island/useIslandDiscoveries';
import { IslandDistricts, IslandGrowthChoices, IslandGrowthSummary, type IslandDistrict } from '../components/island/IslandGrowth';
import { IslandAlbum } from '../components/island/IslandAlbum';
import { getIslandGrowthMilestone, isIslandHabitatUnlocked } from '../domain/island/growth';
import { IslandMilestoneNotice, IslandMilestoneReturn, type IslandMilestone } from '../components/island/IslandMilestone';
import { runIslandMilestoneLearningAction, useIslandMilestoneNotice } from '../components/island/useIslandMilestoneNotice';
import { IslandLearningPanel } from '../components/island/IslandLearningPanel';
import { useEnglishListening } from '../hooks/useEnglishListening';
import { EnglishListening, EnglishListeningEntry } from '../components/domain/EnglishListening';
import { IslandSoundControl } from '../components/island/IslandSoundControl';
import { islandFeedbackForReceipt, type IslandLearningFeedback, type IslandReaction } from '../components/island/learningFeedback';
import { getIslandCosmetics } from '../domain/island/customization';
import type { IslandAppearanceSlotId } from '../domain/island/appearance';
import { IslandCustomization, IslandCustomizationPreviewNotice } from '../components/island/IslandCustomization';
import { IslandRewardGoal, IslandRewardGoalFeedback } from '../components/island/IslandRewardGoal';
import { IslandHomeActions } from '../components/island/IslandHomeActions';
import { IslandLearningKeepsakes } from '../components/island/IslandLearningKeepsakes';
import { useIslandLearningKeepsakes } from '../components/island/useIslandLearningKeepsakes';
import type { IslandLearningKeepsakeId } from '../domain/island/learningKeepsakes';
import { islandDistrictForPosition, islandHomeDistrict } from '../components/island/islandDistrictView';
import { useIslandRewardGoal } from '../components/island/useIslandRewardGoal';
import type { IslandRewardGoalTarget } from '../domain/island/rewardGoalTypes';
import { useIslandCustomization } from '../components/island/useIslandCustomization';
import { IslandStarReceipt } from '../components/island/IslandStarReceipt';
import { islandPlanStars } from '../domain/island/pacing';
import { islandStarReceipt } from '../components/island/islandStarReceiptEligibility';
import { IslandDiscoveryGuide } from '../components/island/IslandDiscoveryGuide';
import { islandDiscoveryGuide } from '../components/island/islandDiscoveryHints';
import { islandGrowthPreview } from '../components/island/islandGrowthPreview';
import { getIslandExperience, ISLAND_RESIDENT_IDS, ISLAND_RESIDENT_PROFILES, type IslandResidentId } from '../domain/island/experience';
import { getOwnedIslandFurniture, isIslandOptionalFurnitureKind, type IslandOptionalFurnitureKind } from '../domain/island/furniture';
import { IslandFurniture } from '../components/island/IslandFurniture';
import { useIslandFurniture } from '../components/island/useIslandFurniture';
import { islandFurnitureTrial } from '../components/island/islandFurnitureTrial';
import { furniturePlacementKey, type IslandFurniturePlacementResult } from '../components/island/islandFurniturePlacement';
import { IslandExperiencePanel } from '../components/island/IslandExperiencePanel';
import { useIslandExperience } from '../components/island/useIslandExperience';
import { IslandExpression } from '../components/island/IslandExpression';
import { useIslandExpression } from '../components/island/useIslandExpression';
import { getIslandExpression, type IslandExpressionEquipAction, type IslandExpressionItemId, type IslandExpressionRequirement } from '../domain/island/expression';
import { useIslandAmbience } from '../components/island/useIslandAmbience';
import { IslandPhotoCamera, IslandPhotoGallery } from '../components/island/IslandPhotos';
import { useIslandPhotos } from '../components/island/useIslandPhotos';
import { IslandSharedMemories, type IslandDisplayPreview } from '../components/island/IslandSharedMemories';
import { findSharedDisplayPosition } from '../components/island/islandSharedPlacement';
import { IslandWorkReplay } from '../components/island/IslandWorkReplay';
import { useIslandSharedMemories } from '../components/island/useIslandSharedMemories';
import { isValidSharedDisplayPlacement, resolveSharedTarget, SHARED_DISPLAY_IDS, sharedDisplayKey, sharedTargetName, sharedWorkCaptureKey,
    type SharedDisplayId, type SharedTarget, type SharedTargetRef } from '../domain/island/sharedMemories';
import type { IslandSharedSceneRequest, IslandStageState } from '../components/island/three/types';
import { IslandWorkshop, type IslandWorkshopView } from '../components/island/IslandWorkshop';
import { useIslandWorkshop } from '../components/island/useIslandWorkshop';
import { useIslandWorkshopAudio } from '../components/island/useIslandWorkshopAudio';
import { getIslandWorkshop, getWorkshopSpecimenName, workshopSpecimenIdentity } from '../domain/island/workshop';
import type { WorkshopSceneRequest } from '../components/island/three/workshopScene';
import '../components/domain/LearningAnswerForm.css';
import '../components/island/Island.css';
import '../components/island/IslandDisplayLayout.css';
import '../components/island/IslandWideWorkspace.css';

type Screen = IslandScreen;
const RENDERER_RECOVERY_HINT = '「もういちど みる」で、しまを ひらこう。';

function sharingHint(items: IslandItem[], selectedId: string) {
    const selected = items.find(item => item.id === selectedId);
    if (!selected) return undefined;
    const pair = [
        { kinds: ['flower', 'bench'], hint: 'ベンチの まえに おはなを おくと…？' },
        { kinds: ['lantern', 'mushroom'], hint: 'きのこの いすの まえに あかりを おくと…？' },
        { kinds: ['fountain', 'swing'], hint: 'ブランコの まえに ふんすいを おくと…？' },
    ].find(pair => pair.kinds.includes(selected.kind) && pair.kinds.every(kind => items.some(item => item.kind === kind)));
    return pair?.hint;
}

function IslandSession({ profile }: { profile: UserProfile }) {
    const navigate = useNavigate();
    const location = useLocation();
    const navigation = useIslandNavigation();
    const hasShell = Boolean(navigation);
    const [homeMenuOpen, setHomeMenuOpen] = useState(false);
    const active = navigation?.active ?? true;
    const [entry] = useState(() => {
        const query = new URLSearchParams(location.search);
        const requested = query.get('start') === 'learn';
        const target = query.get('profile');
        query.delete('start'); query.delete('profile');
        return { requested, start: requested && (!target || target === profile.id),
            cleanUrl: `${location.pathname}${query.size ? `?${query}` : ''}${location.hash}` };
    });
    const entryCleared = useRef(false);
    const [opening, setOpening] = useState(true);
    const [nextPlanError, setNextPlanError] = useState(false);
    const [snapshot, setSnapshot] = useState<IslandRecord>();
    const live = useLiveQuery(() => db.islands.get(profile.id), [profile.id]);
    const island = live && (!snapshot || live.revision >= snapshot.revision) ? live : snapshot;
    const [plan, setPlan] = useState<IslandPlan>();
    const [localScreen, setLocalScreen] = useState<Screen>('home');
    // An old reservation's gift is part of the same focused session. Changing
    // the route here would incorrectly allow a deferred PWA reload mid-receipt.
    const learningScreen = plan?.status === 'completed' && isFirstIslandPlan(plan) && !plan.growthTarget ? 'reward' : 'learning';
    const screen = navigation ? navigation.learning ? learningScreen : navigation.view : localScreen;
    const setScreen = navigation?.setView ?? setLocalScreen;
    const listening = useEnglishListening(profile.id, active && screen === 'learning' && profile.subjectMode !== 'math', profile.vocabLevels ?? [], plan?.slots[plan.cursor]?.problem);
    const [workshopView, setWorkshopView] = useState<IslandWorkshopView>({ mode: 'observe', selectedSpecimenId: 'driftwood', selectedPartId: 'straight', selectedToolId: 'brush' });
    const [workshopRequest, setWorkshopRequest] = useState<WorkshopSceneRequest>();
    const [sharedSelection, setSharedSelection] = useState<SharedDisplayId>();
    const [sharedPreview, setSharedPreview] = useState<IslandDisplayPreview>();
    const [sharedRequest, setSharedRequest] = useState<IslandSharedSceneRequest>();
    const [sharedFeedback, setSharedFeedback] = useState<string>();
    const [workReplay, setWorkReplay] = useState<{ ref: SharedTargetRef; target: Extract<SharedTarget, { kind: 'work' }> }>();
    const [showCurrentDraft, setShowCurrentDraft] = useState(false);
    const [growthPreviewHabitat, setGrowthPreviewHabitat] = useState<IslandHabitatId>();
    const [growthViewHabitat, setGrowthViewHabitat] = useState<IslandHabitatId>('garden');
    const [guideLocation, setGuideLocation] = useState<{ habitat: IslandHabitatId; discoveryId?: string }>({ habitat: 'garden' });
    const [returnToGuide, setReturnToGuide] = useState(false);
    const [photoTargetId, setPhotoTargetId] = useState('island');
    const [photoOrigin, setPhotoOrigin] = useState<Screen>('home');
    const [portraitResident, setPortraitResident] = useState<'otter' | 'rabbit' | 'fox'>();
    const [keepsakeFocus, setKeepsakeFocus] = useState<IslandLearningKeepsakeId>();
    const [houseSection, setHouseSection] = useState<'home' | 'keepsakes' | 'notices'>('home');
    useLayoutEffect(() => { setHouseSection('home'); setKeepsakeFocus(undefined); }, [navigation?.houseEntry]);
    const [returnToHouse, setReturnToHouse] = useState(false);
    const [expressionResident, setExpressionResident] = useState<IslandResidentId>();
    const [expressionEntryItem, setExpressionEntryItem] = useState<IslandExpressionItemId>('raincoat');
    const [expressionFlagFocus, setExpressionFlagFocus] = useState(false);
    const [expressionWalk, setExpressionWalk] = useState<IslandStageState['expressionWalkRequest']>();
    const [preparingLearning, setPreparingLearning] = useState(false);
    const [experienceEntryTab, setExperienceEntryTab] = useState<'island' | 'layouts'>('island');
    const [preview, setPreview] = useState<IslandItem>();
    const [placementSuggestionId, setPlacementSuggestionId] = useState<string>();
    const [playRequest, setPlayRequest] = useState<IslandStageState['playRequest']>();
    const [furnitureKind, setFurnitureKind] = useState<IslandOptionalFurnitureKind>('telescope');
    const [furnitureResident, setFurnitureResident] = useState<IslandResidentId>('otter');
    const [furniturePartner, setFurniturePartner] = useState<IslandResidentId>('rabbit');
    const [furniturePlacementSearch, setFurniturePlacementSearch] = useState<string>();
    const [furniturePlacementResult, setFurniturePlacementResult] = useState<IslandFurniturePlacementResult>();
    const [cosmeticFocus, setCosmeticFocus] = useState<IslandAppearanceSlotId | 'all'>('all');
    const [returnToFurniture, setReturnToFurniture] = useState(false);
    const [chosenDistrict, setDistrict] = useState<IslandDistrict>();
    const district = islandHomeDistrict(island, chosenDistrict);
    const [latestMilestone, setLatestMilestone] = useState<IslandMilestone>();
    const [homeJourneyGrowthAt, setHomeJourneyGrowthAt] = useState<number>();
    const [starReceipt, setStarReceipt] = useState<{ id: string; stars: number }>();
    const lastStarReceipt = useRef<string | undefined>(undefined);
    const [albumComparison, setAlbumComparison] = useState<IslandHabitatId | 'all'>('garden');
    const [playMessage, setPlayMessage] = useState<string>();
    const [pulse, setPulse] = useState(0);
    const [reaction, setReaction] = useState<IslandReaction & { growthTarget?: IslandHabitatId }>();
    const [learningFeedback, setLearningFeedback] = useState<IslandLearningFeedback>();
    const [feedback, setFeedback] = useState('');
    const [loadError, setLoadError] = useState(false);
    const { busy, busyKind, error, run } = useIslandActions();
    const milestoneNotice = useIslandMilestoneNotice(profile.id, active && screen === 'learning' && !preparingLearning,
        Boolean(error || loadError || nextPlanError));
    const comparisonDisabled = busy && busyKind !== 'discovery';
    const [tutorialStageReady, setTutorialStageReady] = useState(false);
    const tutorial = useIslandTutorial({ profileId: profile.id, eligible: profile.islandTutorialVersion === 1 && (screen !== 'play' || Boolean(island?.items.some(item => item.position))), screen, active,
        allowed: !opening && !busy && !preparingLearning && !error && !loadError && !nextPlanError && !homeMenuOpen
            && (tutorialStageReady || screen === 'inventory' || screen === 'home' && homeJourneyEnabled()) && !homeJourneyGrowthAt && !(screen === 'play' && playMessage),
        grown: Boolean(island?.completedSets), canView: !homeJourneyEnabled() });
    const customization = useIslandCustomization(island, active && screen === 'customization', run, setSnapshot);
    const furniture = useIslandFurniture(island, active && screen === 'furniture', run, setSnapshot);
    const experience = useIslandExperience(island, active && screen === 'experience', run, setSnapshot);
    const expression = useIslandExpression(island, active && screen === 'expression', run, setSnapshot);
    const keepsakes = useIslandLearningKeepsakes(island, active && screen === 'keepsakes' && !preparingLearning, run,
        updated => setSnapshot(previous => previous?.profileId === updated.profileId && previous.revision > updated.revision ? previous : updated));
    const rewardGoal = useIslandRewardGoal(island, active && !homeMenuOpen && !preparingLearning && ['home', 'customization', 'furniture', 'expression'].includes(screen) ? screen : undefined,
        run, updated => setSnapshot(previous => previous?.profileId === updated.profileId && previous.revision > updated.revision ? previous : updated));
    const photos = useIslandPhotos(profile.id, active && (screen === 'camera' || screen === 'photos' || screen === 'expression'), run);
    const sharedActions = useIslandSharedMemories(island, active && (screen === 'shared' || screen === 'workshop' && Boolean(workReplay)
        || screen === 'camera' && photoOrigin === 'shared'), run, (updated, action) => {
        setSnapshot(updated);
        if (action?.type === 'place-display') setSharedPreview(previous => previous && previous.displayId === action.displayId
            && previous.expectedDisplayKey === action.expectedDisplayKey && JSON.stringify(previous.ref) === JSON.stringify(action.target)
            && previous.position.x === action.position.x && previous.position.z === action.position.z && previous.rotation === action.rotation ? undefined : previous);
        if (action?.type === 'start-from-work' && workReplay && JSON.stringify(workReplay.ref) === JSON.stringify(action.target)) {
            setWorkReplay(undefined); setShowCurrentDraft(false); setWorkshopRequest(undefined);
        }
    });
    const workshopActions = useIslandWorkshop(island, screen === 'workshop', busy, run, setSnapshot);
    const workshopAudio = useIslandWorkshopAudio(active && profile.soundEnabled && screen === 'workshop');
    const experienceState = getIslandExperience(island ?? {});
    const experienceScene = screen === 'experience' ? experience.previewIsland ?? island : island;
    const expressionScene = screen === 'expression' ? expression.previewState?.selection ?? getIslandExpression(island ?? {}).selection
        : getIslandExpression(experienceScene ?? {}).selection;
    const sceneAmbience = expressionScene.soundscape ?? getIslandExperience(experienceScene ?? {}).ambience;
    const ambience = useIslandAmbience(sceneAmbience, profile.soundEnabled,
        active && !preparingLearning && ['home', 'play', 'experience', 'expression', 'showcase'].includes(screen),
        screen === 'expression' && expression.previewAction?.type === 'equip-soundscape');
    const discoveries = useIslandDiscoveries({ profileId: profile.id, island, enabled: active && !homeMenuOpen && ['home', 'play', 'showcase'].includes(screen), busy, run, onSaved: setSnapshot });
    const observation = useIslandLearningObservation();
    useEffect(() => { setSoundEnabled(profile.soundEnabled); }, [profile.soundEnabled]);
    useEffect(() => {
        let mounted = true;
        const release = holdPwaUpdateForCriticalPersistence();
        void (async () => {
            const opened = await openIsland(profile.id);
            const pending = opened.pendingPlanId ? await db.islandPlans.get(opened.pendingPlanId) : undefined;
            if (!mounted) return;
            if (opened.pendingPlanId && (!pending || pending.profileId !== profile.id || pending.status !== 'active')) throw new Error('Pending learning unavailable');
            if (pending) assertIslandPlan(pending, profile.id);
            let reserved = pending;
            if (!hasShell && entry.start && !reserved) {
                try { reserved = await startIslandPlan(profile.id); }
                catch { if (mounted) setNextPlanError(true); }
            }
            if (!mounted) return;
            setSnapshot(opened);
            setPlan(reserved);
            if (!hasShell && entry.start) setLocalScreen('learning');
            if (!hasShell && entry.requested && (reserved || !entry.start)) {
                entryCleared.current = true;
                navigate(entry.cleanUrl, { replace: true });
            }
        })().catch(() => { if (mounted) setLoadError(true); }).finally(() => {
            release();
            if (mounted) setOpening(false);
        });
        return () => { mounted = false; };
    }, [profile.id, entry, navigate, hasShell]);

    const clearEntry = () => {
        if (hasShell || !entry.requested || entryCleared.current) return;
        entryCleared.current = true;
        navigate(entry.cleanUrl, { replace: true });
    };

    const begin = async () => {
        if (navigation && !navigation.learning) { navigation.startLearning(); return; }
        setPreparingLearning(true);
        // The shell keeps the ordinary page's selection and previews for close.
        if (!navigation) {
        expression.reset(); setExpressionWalk(undefined); setExpressionResident(undefined);
        setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined);
        furniture.reset(); setPlayRequest(undefined);
        photos.cancel();
        setSharedRequest({ id: crypto.randomUUID(), command: { type: 'stop' } });
        }
        ambience.stop();
        workshopAudio.stop();
        if (screen === 'workshop') setWorkshopRequest({ id: crypto.randomUUID(), command: { type: 'stop' } });
        const reserved = await run(() => startIslandPlan(profile.id));
        setPreparingLearning(false);
        if (!reserved || reachPwaUpdateCheckpoint('island-learning', { protectNextSession: true })) return;
        clearEntry(); setNextPlanError(false);
        if (!navigation) {
        customization.reset();
        experience.reset();
        setWorkshopRequest(undefined);
        setSharedPreview(undefined); setWorkReplay(undefined); setShowCurrentDraft(false);
        setGrowthPreviewHabitat(undefined); setReturnToGuide(false);
        setStarReceipt(undefined);
        if (screen !== 'learning') setLatestMilestone(undefined);
        setReturnToHouse(false);
        setPreview(undefined); setFeedback(''); setReaction(undefined);
        }
        setPlan(reserved); setScreen('learning');
    };
    const home = () => {
        if ((busy && !(['album', 'guide'].includes(screen) && busyKind === 'discovery'))
            || reachPwaUpdateCheckpoint('island-home', { protectNextSession: true })) return;
        const destination = returnToHouse && ['album', 'photos', 'shared', 'reward'].includes(screen) ? 'keepsakes' : 'home';
        photos.cancel(); clearEntry(); setNextPlanError(false);
        expression.reset(); setExpressionWalk(undefined); setExpressionResident(undefined);
        furniture.reset(); setPlayRequest(undefined); setReturnToFurniture(false);
        setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined);
        setSharedRequest({ id: crypto.randomUUID(), command: { type: 'stop' } });
        setSharedPreview(undefined); setWorkReplay(undefined); setShowCurrentDraft(false);
        workshopAudio.stop();
        discoveries.revisit();
        customization.reset();
        experience.reset();
        setWorkshopRequest(undefined);
        setGrowthPreviewHabitat(undefined); setReturnToGuide(false);
        setStarReceipt(undefined);
        setReturnToHouse(false); setHouseSection('home'); setKeepsakeFocus(undefined);
        setPreview(undefined); setFeedback(''); setLearningFeedback(undefined); setReaction(undefined);
        if (navigation) navigation.back(); else setScreen(destination);
    };
    const learningStarted = useRef(false);
    const beginRequestedLearning = useEffectEvent(() => { void begin(); });
    const exitMismatchedLearning = useEffectEvent(() => navigation?.back());
    useEffect(() => {
        if (!navigation?.learning) { learningStarted.current = false; return; }
        if (navigation.targetProfile && navigation.targetProfile !== profile.id) { exitMismatchedLearning(); return; }
        if (busy || opening || loadError || learningStarted.current) return;
        learningStarted.current = true;
        beginRequestedLearning();
    }, [navigation?.learning, navigation?.targetProfile, busy, opening, loadError, profile.id]);
    const reportBlocked = navigation?.setBlocked;
    const reportLearningBlocked = navigation?.setLearningBlocked;
    useLayoutEffect(() => {
        reportBlocked?.(active && (busy && busyKind !== 'discovery' || preparingLearning || opening));
        reportLearningBlocked?.(busy || preparingLearning || opening);
        return () => { reportBlocked?.(false); reportLearningBlocked?.(false); };
    }, [reportBlocked, reportLearningBlocked, active, busy, busyKind, preparingLearning, opening]);
    const recoverPlacement = useEffectEvent(() => navigation?.open('/island?view=inventory', true));
    const placementWasPrepared = useRef(false);
    useEffect(() => {
        if (screen !== 'placement') { placementWasPrepared.current = false; return; }
        if (preview) { placementWasPrepared.current = true; return; }
        // Clearing a saved/cancelled preview may render before the route change.
        // Recover only an editor entered without a selection, never that exit.
        if (hasShell && active && !opening && !navigation?.blocked && !placementWasPrepared.current) recoverPlacement();
    }, [hasShell, active, opening, screen, preview, navigation?.blocked]);
    const enterHouse = () => {
        if (comparisonDisabled) return;
        setReturnToHouse(false);
        setHouseSection('home');
        setKeepsakeFocus(undefined); setPreview(undefined); setReaction(undefined); setPlayRequest(undefined); setScreen('keepsakes');
    };
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
        if (receipt.plan.status === 'completed') {
            const step = crossedHomeJourneyStep(island?.homeJourney, (latestIsland ?? receipt.island).homeJourney);
            if (step) setHomeJourneyGrowthAt(step.at);
        }
        setNextPlanError(Boolean(result.nextPlanError));
        const response = islandFeedbackForReceipt(plan, receipt.plan, receipt.event);
        const earnedReceipt = islandStarReceipt(plan, receipt.plan, receipt.event, lastStarReceipt.current);
        if (earnedReceipt) { lastStarReceipt.current = earnedReceipt; setStarReceipt({ id: earnedReceipt, stars: islandPlanStars(receipt.plan) }); }
        setLearningFeedback(response?.feedback);
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
            if (profile.soundEnabled) playSound(receipt.plan.status === 'completed' ? 'clear' : 'correct');
        }
        if (response?.feedback.kind === 'retry') playSound('incorrect');
        if (response?.feedback.kind === 'step') playSound('step');
        if (receipt.plan.status === 'completed' && !nextPlan) {
            if (isFirstIslandPlan(receipt.plan) && !receipt.plan.growthTarget) { if (!navigation) setScreen('reward'); }
            else setNextPlanError(true);
        }
    };
    const select = (item: IslandItem, current = island) => {
        if (!current || busy) return;
        setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined);
        setReturnToFurniture(screen === 'furniture' && isIslandOptionalFurnitureKind(item.kind));
        setPlayRequest(undefined);
        setPlacementSuggestionId(item.position ? undefined : item.id);
        const position = item.position ?? findAvailablePosition(current, item.kind, item.id) ?? { x: 0, z: 1 };
        setDistrict(islandDistrictForPosition(current, position));
        setPreview({ ...item, position });
        setFeedback(''); setScreen('placement');
    };
    const openCustomization = () => {
        if (busy) return;
        setCosmeticFocus('all');
        customization.open(); setPreview(undefined); setReaction(undefined); setPlayRequest(undefined);
        setFeedback(''); setScreen('customization');
    };
    const openFurniture = () => {
        if (busy) return;
        customization.reset(); experience.reset(); furniture.reset();
        setPreview(undefined); setPlayRequest(undefined); setReaction(undefined); setPlayMessage(undefined);
        setReturnToFurniture(false); setScreen('furniture');
    };
    const receiveFurniture = async (retry = false) => {
        const kind = retry ? furniture.pendingKind : furnitureKind;
        if (!kind || busy) return;
        setPlayRequest(undefined);
        const updated = retry ? await furniture.retry?.() : await furniture.purchase(kind);
        if (!updated) return;
        const item = getOwnedIslandFurniture(updated, kind);
        if (item) select(item, updated);
    };
    const openGuide = () => {
        if (comparisonDisabled) return;
        setPreview(undefined); setReaction(undefined); setPlayRequest(undefined); setScreen('guide');
    };
    const openExperience = () => {
        if (busy) return;
        expression.reset(); setExpressionWalk(undefined); setExpressionResident(undefined);
        experience.reset(); photos.cancel(); setPreview(undefined); setReaction(undefined); setPlayRequest(undefined); setExperienceEntryTab('island'); setScreen('experience');
    };
    const openExpression = () => {
        if (busy) return;
        setExpressionEntryItem('raincoat');
        customization.reset(); experience.reset(); expression.reset(); photos.cancel();
        setExpressionWalk(undefined); setExpressionResident(undefined); setExpressionFlagFocus(false);
        setPreview(undefined); setReaction(undefined); setPlayRequest(undefined); setScreen('expression');
    };
    const openRewardGoal = (target: IslandRewardGoalTarget) => {
        if (busy) return;
        if (target.category === 'customization') { openCustomization(); customization.open(target.itemId); }
        else if (target.category === 'furniture') { openFurniture(); setFurnitureKind(target.kind); }
        else { openExpression(); setExpressionEntryItem(target.itemId); }
    };
    const previewExpression = (action: IslandExpressionEquipAction | undefined) => {
        expression.preview(action);
        setExpressionWalk(action?.type === 'equip-trail' && action.itemId ? { id: crypto.randomUUID(), residentId: action.residentId } : undefined);
    };
    const visitExpression = (requirement: IslandExpressionRequirement) => {
        if (busy) return;
        expression.reset(); setExpressionWalk(undefined); setExpressionResident(undefined);
        if (requirement === 'bell') {
            if (!island || island.completedSets < 1) { void begin(); return; }
            openWorkshop(); setWorkshopView(view => ({ ...view, mode: 'build', selectedPartId: 'bell', residentId: undefined }));
        } else {
            setGuideLocation({ habitat: requirement === 'ribbon-butterfly' ? 'garden' : 'grove', discoveryId: requirement }); openGuide();
        }
    };
    const openWorkshop = () => {
        if (busy || !island || island.completedSets < 1) return;
        setWorkReplay(undefined); setShowCurrentDraft(false);
        ambience.stop(); setWorkshopRequest(undefined); setPreview(undefined); setReaction(undefined); setPlayRequest(undefined); setScreen('workshop');
    };
    const sharedCommand = (command: IslandSharedSceneRequest['command']) => {
        setSharedFeedback(undefined); setSharedRequest({ id: crypto.randomUUID(), command });
    };
    const openShared = (ref?: SharedTargetRef, selected?: SharedDisplayId) => {
        if (busy || !island || island.completedSets < 1) return;
        photos.cancel(); workshopAudio.stop(); setWorkshopRequest(undefined); setPlayRequest(undefined); setReaction(undefined);
        setSharedFeedback(undefined); setSharedPreview(undefined); setSharedSelection(selected); setWorkReplay(undefined); setShowCurrentDraft(false);
        sharedCommand({ type: 'stop' }); setDistrict('all'); setScreen('shared');
        if (ref) {
            try {
                const target = resolveSharedTarget(island, ref);
                const displayId = SHARED_DISPLAY_IDS.find(id => island.sharedMemories?.displays[id]?.target.targetKey === target.targetKey);
                if (displayId) { setSharedSelection(displayId); return; }
                const id = SHARED_DISPLAY_IDS.find(id => !island.sharedMemories?.displays[id]) ?? 'display-1';
                const current = island.sharedMemories?.displays[id];
                const position = current?.position ?? findSharedDisplayPosition(island, id, target) ?? { x: 0, z: 1 };
                setSharedSelection(id); setSharedPreview({ displayId: id, target, ref, position, rotation: current?.rotation ?? 0,
                    valid: isValidSharedDisplayPlacement(island, id, target, position), expectedDisplayKey: sharedDisplayKey(current) });
            } catch { setSharedFeedback('この ものを もういちど えらんでね。'); }
        }
    };
    const revisitShared = (ref: SharedTargetRef, target: SharedTarget) => {
        if (busy) return;
        sharedCommand({ type: 'stop' }); setSharedPreview(undefined); workshopAudio.stop(); setWorkshopRequest(undefined);
        setShowCurrentDraft(false);
        if (target.kind === 'work') { setWorkReplay({ ref, target }); setWorkshopView(view => ({ ...view, mode: 'build', residentId: undefined })); }
        else { setWorkReplay(undefined); setWorkshopView(view => ({ ...view, mode: 'observe', selectedSpecimenId: target.specimenId, residentId: undefined })); }
        setScreen('workshop');
    };
    const photograph = () => {
        if (busy) return;
        photos.cancel(); setPhotoOrigin(screen);
        setPhotoTargetId(screen === 'shared' && sharedSelection && island?.sharedMemories?.displays[sharedSelection] ? `display-${sharedSelection}`
            : screen === 'workshop' ? 'inlet' : screen === 'keepsakes' ? 'keepsakes' : ['play', 'showcase'].includes(screen) ? 'current'
            : screen === 'experience' && portraitResident ? `resident-${portraitResident}` : 'island');
        setScreen('camera');
    };
    const openPhotos = () => {
        if (busy) return;
        if (screen === 'keepsakes' || screen === 'camera' && photoOrigin === 'keepsakes') setReturnToHouse(true);
        photos.cancel(); setWorkshopRequest(undefined); setPlayRequest(undefined); setReaction(undefined); setScreen('photos');
    };
    const tryDiscovery = (itemId: string, discoveryId: string) => {
        if (busy || !island) return;
        const entry = islandDiscoveryGuide(island, discoveryId);
        if (entry) setGuideLocation({ habitat: entry.entry.habitatId, discoveryId });
        setReturnToGuide(true); setPreview(undefined); setPlayMessage(undefined); setDistrict('all');
        setScreen('play'); setPlayRequest({ id: crypto.randomUUID(), itemId, discoveryId });
    };
    const play = (itemId: string) => {
        if (busy || screen !== 'play') return;
        setPlayMessage(undefined);
        setPlayRequest({ id: crypto.randomUUID(), itemId });
    };
    const chooseGrowth = async (habitatId: IslandHabitatId) => {
        if (!island) return;
        const updated = await run(() => selectIslandGrowthTarget(profile.id, island.revision, habitatId));
        if (!updated) return;
        setSnapshot(updated); setGrowthPreviewHabitat(undefined); setScreen('home');
    };
    const appearance = async (level: number) => {
        if (!island || !preview) return;
        const updated = await run(() => setIslandItemAppearance(profile.id, island.revision, preview.id, level));
        if (!updated) return;
        setSnapshot(updated);
        const item = updated.items.find(candidate => candidate.id === preview.id);
        if (item) setPreview(previous => previous ? { ...previous, appearanceLevel: item.appearanceLevel } : previous);
    };
    const claim = async (rewardId: string, kind: IslandBasicItemKind) => {
        if (!island) return;
        const updated = await run(() => claimIslandReward(profile.id, island.revision, rewardId, kind));
        if (!updated) return;
        setSnapshot(updated);
        const item = updated.items.find(candidate => candidate.id === `${rewardId}:item`);
        if (item) select(item, updated);
    };
    const place = async (store = false) => {
        if (!island || !preview?.position) return;
        const updated = await run(() => saveIslandEdit(profile.id, island.revision, store
            ? { type: 'store', itemId: preview.id }
            : { type: 'place', itemId: preview.id, position: preview.position!, rotation: preview.rotation }));
        if (!updated) return;
        setSnapshot(updated); setPreview(undefined); setPlayRequest(undefined); setPlayMessage(undefined);
        setScreen(navigation ? 'home' : returnToFurniture ? 'furniture' : returnToGuide ? 'guide' : returnToHouse ? 'keepsakes' : 'home');
        setReturnToHouse(false); setHouseSection('home'); setKeepsakeFocus(undefined);
        setFeedback(store ? 'もちものに とっておくよ' : `${ISLAND_ITEMS[preview.kind].name}を おいたよ`);
    };
    const slot = plan?.slots[plan.cursor];
    const tryTutorial = (id: TutorialId) => {
        const topic = TUTORIAL_TOPICS.find(topic => topic.id === id)!;
        const target = id === 'view' ? 'play' : topic.screen;
        if (id === 'view' || id === 'play') { setPlayRequest(undefined); setPlayMessage(undefined); setPreview(undefined); }
        tutorial.start(id, target);
        if (id === 'photo') photograph();
        else if (id === 'customization') openCustomization();
        else if (id === 'growth') {
            setGrowthViewHabitat(plan?.growthTarget ?? island?.growth?.focus ?? 'garden'); setScreen('growth');
        } else setScreen(target);
    };
    const learning = screen === 'learning';
    // Reserve one crop for the entire section, including later diagrams and their help.
    const complex = Boolean(plan?.slots.some(candidate => candidate.problem.inputType === 'multi-number'
        || candidate.problem.questionVisual?.kind === 'operation-base10' || parkHissanGrid(candidate.problem)));
    if (loadError) return <div className="island-loading" role="alert">しまを ひらけなかったよ。<button className="island-primary" onClick={() => window.location.reload()}>もういちど ひらく</button></div>;
    if (opening || !island) return <div className="island-loading" role="status">しまを ひらいているよ…</div>;
    const valid = Boolean(preview?.position && isValidIslandPlacement(island, preview.id, preview.position, preview.rotation));
    const growthLook = screen === 'growth' && growthPreviewHabitat ? islandGrowthPreview(island, growthPreviewHabitat) : undefined;
    const stageIsland = growthLook?.island ?? (screen === 'experience' ? experience.previewIsland : undefined) ?? island;
    const furnitureTrial = screen === 'furniture' && !busy && !furniture.pendingKind ? islandFurnitureTrial(island, furnitureKind) : undefined;
    const furniturePlacementChoice = screen === 'placement' && preview && isIslandOptionalFurnitureKind(preview.kind) && !busy
        ? { residentId: furnitureResident, ...(preview.kind === 'tea-table' ? { partnerId: furniturePartner } : {}) } : undefined;
    const placementAvailability = preview && furniturePlacementChoice && furniturePlacementResult?.key === furniturePlacementKey(preview, furniturePlacementChoice)
        ? furniturePlacementResult : undefined;
    const photoResidents = ISLAND_RESIDENT_IDS.filter(id => id !== 'fox' || island.completedSets >= 4 && isIslandHabitatUnlocked(island, 'waterside'));
    const photoResident = photoResidents.find(id => photoTargetId === `resident-${id}`);
    const cameraInlet = screen === 'camera' && photoTargetId === 'inlet';
    const photoDisplayId = SHARED_DISPLAY_IDS.find(id => photoTargetId === `display-${id}` && island.sharedMemories?.displays[id]);
    const photoDisplay = photoDisplayId ? island.sharedMemories?.displays[photoDisplayId] : undefined;
    const keepsakeRoomActive = !preparingLearning && (screen === 'keepsakes' || screen === 'camera' && photoTargetId === 'keepsakes');
    const photoTargets = [{ id: 'island', label: 'しまぜんぶ' }, ...photoResidents.map(id => ({ id: `resident-${id}`, label: experienceState.residents[id].name })),
        ...(['play', 'showcase'].includes(photoOrigin) ? [{ id: 'current', label: 'いまの けしき' }] : []),
        ...SHARED_DISPLAY_IDS.flatMap(id => island.sharedMemories?.displays[id] ? [{ id: `display-${id}`, label: sharedTargetName(island, island.sharedMemories.displays[id]!.target) }] : []),
        ...(photoOrigin === 'workshop' ? [{ id: 'inlet', label: workshopView.mode === 'build' ? 'つくった しくみ' : 'みつけた もの' }] : []),
        ...(photoOrigin === 'keepsakes' ? [{ id: 'keepsakes', label: 'いえ' }] : [])];
    const savePlacement = () => { setFurniturePlacementSearch(undefined); void place(); };
    const cancelPlacement = navigation ? home : returnToFurniture ? () => {
        setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined); setPreview(undefined); setScreen('furniture');
    } : home;
    return <main className="island-page" data-tutorial-topic={tutorial.current?.id} data-layout-version="display-v1" data-game-id="mystic-island-v1" data-mode={screen} data-home-layout={screen === 'home' ? 'world-first-v2' : undefined} data-complex={Boolean(learning && complex)}
        data-visual-candidate-id={ISLAND_VISUAL_CANDIDATE} data-delivery-id={ISLAND_DELIVERY_ID}
        data-learning-candidate={ISLAND_LEARNING_CANDIDATE}
        data-island-revision={island.revision} data-discovery-count={island.growth?.discoveries.length ?? 0}
        data-build-revision={__BUILD_REVISION__} data-build-version={__APP_VERSION__} data-busy={busy}>
        {!['showcase', 'placement'].includes(screen) && <header className="island-header"><div className="island-brand" data-learning-milestone={learning ? Boolean(milestoneNotice.milestone) : undefined}>
            <Leaf size={20} /><div><p>{profile.name}の</p><h1 title={island.experience?.islandName}>{island.experience?.islandName ?? 'ふしぎな しま'}</h1></div>
            {milestoneNotice.milestone && <IslandMilestoneNotice milestone={milestoneNotice.milestone} island={island} />}</div>
            <div className="island-header-actions"><IslandSoundControl key={screen} enabled={profile.soundEnabled} disabled={busy} onChange={enabled => run(async () => {
                const updated = await updateProfileAtomically(profile.id, current => ({ ...current, soundEnabled: enabled }));
                if (!updated) throw new Error('Profile unavailable');
                return updated;
            }).then(updated => Boolean(updated))} />
            {learning ? <div className="island-learning-return">
                {island.pendingRewards.length > 0 && <span className="island-learning-gifts" aria-label={`おくりもの ${island.pendingRewards.length}こ`}><Gift size={15} aria-hidden="true" />{island.pendingRewards.length}</span>}
                <button className="island-text-button island-learning-pause" disabled={busy || preparingLearning} onClick={() => {
                    if (navigation) navigation.back(); else home();
                }}><X size={20} />とじる</button></div>
                : navigation ? null : <button className="island-icon-button" aria-label="せってい" disabled={busy} onClick={() => navigate('/settings')}><Settings2 size={20} /></button>}</div>
        </header>}
        {(error || loadError) && <div className="island-error" role="alert"><p>{error}</p><button className="island-text-button" onClick={() => window.location.reload()}>よみなおす</button></div>}
        {screen === 'placement' && preview && <IslandPlacementActions valid={valid} disabled={busy} onSave={savePlacement} onCancel={cancelPlacement} />}
        {active && screen === 'home' && homeJourneyEnabled() && <HomeJourneyPreview state={island.homeJourney}
            growthAt={homeJourneyGrowthAt} onGrowthShown={() => setHomeJourneyGrowthAt(undefined)} />}
        {active && !(screen === 'home' && homeJourneyEnabled()) && !['help', 'album', 'photos', 'inventory'].includes(screen) && <IslandStage onTutorialReady={setTutorialStageReady} onCameraPractice={() => tutorial.practice('view')} closeHomeView={screen === 'home'} compactCameraControls={screen === 'home'} items={stageIsland.items} completedSets={island.completedSets} pulse={pulse} learning={learning}
            learningKeepsakes={keepsakeRoomActive ? { state: island.learningKeepsakes, selectedId: keepsakeFocus } : undefined}
            onHomeEnter={!busy && ['home', 'play'].includes(screen) ? enterHouse : undefined}
            onHomeAction={!busy && screen === 'keepsakes' ? action => {
                if (action.type === 'album') { setReturnToHouse(true); setAlbumComparison('garden'); setScreen('album'); }
                else if (action.type === 'notices') { setKeepsakeFocus(undefined); setHouseSection('notices'); }
                else { keepsakes.select(action.id); setKeepsakeFocus(action.id); setHouseSection('keepsakes'); }
            } : undefined}
            furnitureTrial={furnitureTrial}
            furnitureTrialChoice={furnitureTrial ? { residentId: furnitureResident, ...(furnitureKind === 'tea-table' ? { partnerId: furniturePartner } : {}) } : undefined}
            furniturePlacement={furniturePlacementChoice} furniturePlacementSearchRequestId={furniturePlacementChoice ? furniturePlacementSearch : undefined}
            onFurniturePlacement={result => {
                if (busy || screen !== 'placement' || !preview || !furniturePlacementChoice || result.key !== furniturePlacementKey(preview, furniturePlacementChoice)) return;
                setFurniturePlacementResult(result);
                if (result.suggestion?.requestId === furniturePlacementSearch && result.suggestion) {
                    const suggestion = result.suggestion;
                    setDistrict(islandDistrictForPosition(island, suggestion.position));
                    setPreview(previous => previous?.id === result.itemId ? { ...previous, position: suggestion.position, rotation: suggestion.rotation } : previous);
                    setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined);
                }
            }}
            cosmeticFocus={screen === 'customization' ? cosmeticFocus : undefined}
            experience={stageIsland.experience}
            expressionSelection={screen === 'expression' ? expressionScene : getIslandExpression(stageIsland).selection}
            expressionCaptionKey={screen === 'expression' ? `${expressionResident ?? 'world'}:${expression.previewAction?.type === 'equip-trail' ? expressionWalk?.id ?? '' : ''}` : undefined}
            expressionResidentId={screen === 'expression' && !preparingLearning ? expressionResident : undefined}
            expressionFlagFocus={screen === 'expression' && !preparingLearning && expressionFlagFocus}
            expressionWalkRequest={screen === 'expression' && !preparingLearning && expression.previewAction?.type === 'equip-trail' ? expressionWalk : undefined}
            shared={{ island: stageIsland, active: screen === 'shared' || screen === 'camera' && photoOrigin === 'shared',
                selectedDisplayId: screen === 'shared' ? sharedSelection : undefined,
                focusDisplayId: screen === 'shared' && !sharedPreview ? sharedSelection : screen === 'camera' ? photoDisplayId : undefined,
                preview: screen === 'shared' ? sharedPreview : undefined }}
            sharedRequest={sharedRequest}
            onSharedAction={sharedActions.capture}
            onSharedDisplaySelect={!learning && !busy && ['home', 'play', 'shared', 'showcase'].includes(screen) ? id => {
                if (screen === 'shared') { sharedCommand({ type: 'stop' }); setSharedPreview(undefined); setSharedSelection(id); }
                else openShared(undefined, id);
            } : undefined}
            onSharedFeedback={setSharedFeedback}
            photographing={screen === 'camera'}
            workshop={screen === 'workshop' || cameraInlet ? { ...workshopView, workshop: getIslandWorkshop(island), active: true, busy,
                replayLayout: workReplay ? showCurrentDraft ? getIslandWorkshop(island).draftCheckpoint.draft.layout : workReplay.target.layout : undefined } : undefined}
            workshopRequest={screen === 'workshop' || cameraInlet ? workshopRequest : undefined}
            onWorkshopAction={workshopActions.capture}
            onWorkshopGesture={() => { void workshopAudio.unlock(); }} onWorkshopFeedback={workshopAudio.play}
            onWorkshopSpecimenSelect={id => setWorkshopView(view => ({ ...view, selectedSpecimenId: id }))}
            onWorkshopPartSelect={id => setWorkshopView(view => ({ ...view, selectedPartId: id }))}
            residentPortraitId={screen === 'experience' ? portraitResident : screen === 'camera' ? photoResident : undefined}
            cosmetics={screen === 'customization' ? customization.preview ?? getIslandCosmetics(island) : getIslandCosmetics(stageIsland)}
            photoRequestId={screen === 'camera' ? photos.requestId : undefined} onPhoto={photos.consume}
            milestoneNotice={screen === 'furniture' && furnitureTrial ? <aside className="island-growth-preview-notice" role="status"><strong>どうぐの おためし</strong>いまの しまは そのまま。</aside>
                : screen === 'customization' ? <IslandCustomizationPreviewNotice saved={getIslandCosmetics(island)} preview={customization.preview ?? getIslandCosmetics(island)} />
                : <>{growthLook && <aside className="island-growth-preview-notice" role="status"><strong>つぎに 育つ すがた・おためし</strong>{growthLook.description}</aside>}
                    {screen === 'experience' && experience.previewIsland && <aside className="island-growth-preview-notice" role="status"><strong>けしきの おためし</strong>いまの しまは そのまま。</aside>}
                    {screen === 'expression' && expression.previewAction && <aside className="island-growth-preview-notice" role="status"><strong>むりょうの おためし</strong>いまの しまは そのまま。</aside>}
                    {(learning || screen === 'reward') && starReceipt && <IslandStarReceipt key={starReceipt.id} receiptId={starReceipt.id} stars={starReceipt.stars} />}</>}
            growth={stageIsland.growth} growthTarget={plan?.status === 'active' ? plan.growthTarget : undefined}
            comparisonHabitat={screen === 'growth' ? growthViewHabitat : undefined}
            districtFocus={learning || screen === 'shared' || screen === 'customization' || screen === 'expression' || screen === 'furniture' || screen === 'camera' && photoTargetId !== 'current' ? 'all' : district} readOnly={keepsakeRoomActive || ['growth', 'inventory', 'reward', 'customization', 'guide', 'experience', 'expression'].includes(screen)}
            onDiscovery={!homeMenuOpen && ['home', 'play', 'showcase'].includes(screen) ? discoveries.capture : undefined}
            reaction={reaction} learningProgress={(learning || screen === 'reward') && plan
                ? { sectionId: plan.id, completed: plan.cursor, total: plan.slots.length } : undefined}
            preview={preview} previewValid={valid} selectedId={screen === 'play' ? playRequest?.itemId : preview?.id}
            placementSuggestionId={screen === 'placement' ? placementSuggestionId : undefined}
            onPlacementSuggestion={({ itemId, position }) => {
                if (screen !== 'placement' || busy || preview?.id !== itemId) return;
                setDistrict(islandDistrictForPosition(island, position));
                setPreview(previous => previous?.id === itemId ? { ...previous, position } : previous);
                setPlacementSuggestionId(undefined);
            }}
            playRequest={screen === 'play' || screen === 'furniture' && !busy || screen === 'camera' && photoTargetId === 'current' ? playRequest : undefined}
            onRendererRecovered={() => { setPlayMessage(message => message === RENDERER_RECOVERY_HINT ? undefined : message); setWorkshopRequest(undefined); setSharedRequest(undefined); }}
            onPlayResult={result => {
                if (result.requestId !== playRequest?.id) return;
                if (result.status === 'playing') tutorial.practice('play');
                if (screen === 'furniture') {
                    setPlayMessage(result.status === 'playing' ? 'なかまと ためしているよ。'
                        : result.reason === 'renderer' ? RENDERER_RECOVERY_HINT
                            : result.reason === 'resident-unavailable' || result.reason === 'partner-unavailable' ? 'いま こられる なかまを えらんでみよう。'
                                : 'どうぐの まわりに、とおれる すきまを あけてみよう。');
                    return;
                }
                setPlayMessage(result.status === 'blocked' ? 'どうぶつが とおれる すきまを あけて みよう。'
                    : result.status === 'unavailable' ? (result.reason === 'renderer' ? RENDERER_RECOVERY_HINT : 'もちものから しまに おいて、あそぼう。')
                        : result.activity ? (result.activity === 'flower' ? 'おはなを おすそわけ。' : result.activity === 'star' ? 'ほしの ひかりを おすそわけ。'
                            : result.activity === 'bubble' ? 'みずたまを おすそわけ。' : 'なかまと ためしているよ。')
                            : sharingHint(island.items, result.itemId) ?? 'ほかの ばしょも えらべるよ。');
            }}
            onGroundPoint={screen === 'shared' && sharedPreview && !busy ? point => setSharedPreview(previous => {
                if (!previous) return previous;
                const position = { x: Math.round(point.x * 4) / 4, z: Math.round(point.z * 4) / 4 };
                return { ...previous, position, valid: isValidSharedDisplayPlacement(island, previous.displayId, previous.target, position) };
            }) : screen === 'placement' && !busy ? point => { setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined); setPlacementSuggestionId(undefined); setPreview(previous => {
                if (!previous) return previous;
                const position = { x: Math.round(point.x * 4) / 4, z: Math.round(point.z * 4) / 4 };
                return previous.position?.x === position.x && previous.position?.z === position.z ? previous : { ...previous, position };
            }); } : undefined}
            onItemSelect={!learning && !busy && !['customization', 'guide', 'growth', 'experience', 'expression', 'showcase', 'workshop', 'camera', 'photos', 'shared', 'furniture', 'keepsakes'].includes(screen) ? id => {
                if (screen === 'play') play(id);
                else { const item = island.items.find(candidate => candidate.id === id); if (item) select(item); }
            } : undefined} />}
        {tutorial.current && !customization.error && <IslandTutorial id={tutorial.current.id} onShown={tutorial.shown} onClose={tutorial.dismiss}
            text={tutorial.current.id === 'growth' && screen === 'home' ? '学んだぶん、しまが 育ったよ。育った すがたを みてみよう。' : undefined}
            action={tutorial.current.id === 'growth' && screen === 'home' ? 'みにいく' : undefined}
            onAction={() => { tutorial.practice('growth'); setAlbumComparison(latestMilestone?.habitats[0] ?? island.growth?.focus ?? 'garden'); setScreen('album'); }} />}
        {(screen === 'play' || screen === 'placement') && <IslandDistricts island={island} value={district} disabled={busy} onChange={setDistrict} />}
        {learning && nextPlanError ? <section className="island-sheet island-learning-retry">
            <p role="status">{plan?.status === 'completed' ? 'ここまで といたぶんは のこっているよ。' : 'まだ もんだいを ひらけなかったよ。'}</p>
            <button className="island-primary" disabled={busy} onClick={() => void begin()}>つづきの もんだいを ひらく</button>
        </section>
            : learning ? null
            : screen === 'help' ? <IslandHelp island={island} disabled={busy} onClose={home} onTry={tryTutorial} />
            : screen === 'reward' && island.pendingRewards.length ? <IslandRewards island={island} intro={island.completedSets === 1 && Boolean(plan && isFirstIslandPlan(plan))} disabled={busy} onChoose={(id, kind) => void claim(id, kind)} onContinue={() => void begin()} onClose={home} />
            : screen === 'play' ? <IslandPlay items={island.items} disabled={busy} selectedId={playRequest?.itemId} message={playMessage}
                onSelect={play} onMove={select} onInventory={() => setScreen('inventory')} onContinue={() => void begin()} onClose={home} onGuide={openGuide} onPhoto={photograph} />
            : screen === 'inventory' ? <IslandInventory items={island.items} disabled={busy} onSelect={select} onClose={home} onFurniture={openFurniture} />
                : screen === 'furniture' ? <IslandFurniture island={island} kind={furnitureKind} trial={furnitureTrial} disabled={busy}
                    rewardGoal={rewardGoal}
                    pending={Boolean(furniture.pendingKind)} error={furniture.error} feedback={playMessage}
                    residents={photoResidents.map(id => ({ id, name: experienceState.residents[id].name }))}
                    residentId={furnitureResident} partnerId={furniturePartner}
                    onSelect={kind => { setPlayRequest(undefined); setPlayMessage(undefined); setFurnitureKind(kind); }}
                    onResident={id => { setPlayRequest(undefined); setPlayMessage(undefined); setFurnitureResident(id);
                        if (id === furniturePartner) setFurniturePartner(photoResidents.find(candidate => candidate !== id)!); }}
                    onPartner={id => { setPlayRequest(undefined); setPlayMessage(undefined); setFurniturePartner(id); }}
                    onTry={() => { const target = getOwnedIslandFurniture(island, furnitureKind) ?? furnitureTrial;
                        if (!target?.position || busy) return;
                        setPlayMessage(undefined); setPlayRequest({ id: crypto.randomUUID(), itemId: target.id,
                            residentId: furnitureResident, ...(furnitureKind === 'tea-table' ? { partnerId: furniturePartner } : {}) }); }}
                    onPurchase={() => { void receiveFurniture(); }} onRetry={furniture.retry ? () => { void receiveFurniture(true); } : undefined}
                    onPlace={select} onInventory={() => { setPlayRequest(undefined); setScreen('inventory'); }} onClose={home} onLearn={() => void begin()} />
                : screen === 'camera' ? <IslandPhotoCamera photos={photos} targets={photoTargets} targetId={photoTargetId} disabled={busy}
                    onTarget={id => { photos.cancel(); setPhotoTargetId(id); }}
                    onCapture={() => photos.capture({ islandName: experienceState.islandName,
                        composition: cameraInlet ? workshopView.mode === 'build' ? 'work' : 'specimen' : photoDisplay ? 'display' : photoResident ? 'resident' : 'island',
                        targetName: cameraInlet ? workshopView.mode === 'build' ? workReplay && !showCurrentDraft ? workReplay.target.name : 'つくっている しくみ' : getWorkshopSpecimenName(getIslandWorkshop(island), workshopView.selectedSpecimenId)
                            : keepsakeRoomActive ? 'いえ' : photoDisplay ? sharedTargetName(island, photoDisplay.target) : photoResident ? experienceState.residents[photoResident].name : undefined,
                        targetKey: cameraInlet ? workshopView.mode === 'observe' ? workshopSpecimenIdentity(profile.id, workshopView.selectedSpecimenId)
                            : workReplay && !showCurrentDraft ? workReplay.target.targetKey : undefined : photoDisplay?.target.targetKey ?? photoResident })}
                    onGallery={openPhotos} onClose={() => { photos.cancel(); if (navigation) navigation.back(); else setScreen(photoOrigin); }} onLearn={() => void begin()} />
                : screen === 'photos' ? <IslandPhotoGallery photos={photos} decoration={getIslandExpression(island).selection.album} disabled={busy} onCamera={photograph} onClose={home} onLearn={() => void begin()} />
                : screen === 'shared' ? <IslandSharedMemories island={island} selectedId={sharedSelection} preview={sharedPreview} disabled={busy}
                    onSelect={setSharedSelection} onPreview={setSharedPreview} onAction={sharedActions.act} onCommand={sharedCommand}
                    error={sharedActions.error} onRetry={sharedActions.retry} feedback={sharedFeedback}
                    onRevisit={revisitShared} onPhoto={photograph} onClose={home} onLearn={() => void begin()} />
                : screen === 'workshop' && workReplay ? <IslandWorkReplay target={workReplay.target} disabled={busy} showingDraft={showCurrentDraft}
                    onShowDraft={setShowCurrentDraft} onCommand={command => setWorkshopRequest({ id: crypto.randomUUID(), command })}
                    error={sharedActions.error} onRetry={sharedActions.retry ? () => { void sharedActions.retry?.(); } : undefined}
                    onStartFrom={async () => { const updated = await sharedActions.act({ type: 'start-from-work', target: workReplay.ref });
                        if (!updated) return false;
                        setWorkReplay(undefined); setShowCurrentDraft(false); setWorkshopRequest(undefined); return true; }}
                    onPhoto={photograph} onClose={() => openShared(undefined, sharedSelection)} onLearn={() => void begin()} />
                : screen === 'workshop' ? <IslandWorkshop workshop={getIslandWorkshop(island)} view={workshopView} disabled={busy}
                    onPhoto={photograph}
                    onDisplay={id => {
                        if (id === 'work-1' || id === 'work-2') { const work = getIslandWorkshop(island).works[id];
                            if (work) openShared({ kind: 'work', workId: id, targetKey: sharedWorkCaptureKey(profile.id, id, work) }); }
                        else openShared({ kind: 'specimen', specimenId: id });
                    }}
                    onGesture={() => { void workshopAudio.unlock(); }}
                    residents={ISLAND_RESIDENT_IDS.filter(id => id !== 'fox' || island.completedSets >= 4 && isIslandHabitatUnlocked(island, 'waterside'))
                        .map(id => ({ id, name: experienceState.residents[id].name }))}
                    onView={view => { setWorkshopView(view); if (view.mode !== workshopView.mode || view.residentId !== workshopView.residentId) setWorkshopRequest({ id: crypto.randomUUID(), command: { type: 'stop' } }); }}
                    onCommand={command => setWorkshopRequest({ id: crypto.randomUUID(), command })}
                    onAction={workshopActions.act} error={workshopActions.error} onRetry={workshopActions.retry} onClose={home} onLearn={() => void begin()} />
                : screen === 'keepsakes' ? <IslandLearningKeepsakes island={island} controls={keepsakes} disabled={busy} comparisonDisabled={comparisonDisabled}
                    section={houseSection} onSectionChange={section => { setHouseSection(section); setKeepsakeFocus(undefined); }}
                    onSelect={setKeepsakeFocus} onShowRoom={() => setKeepsakeFocus(undefined)}
                    onClose={home} onLearn={() => void begin()} onPhoto={photograph} onPhotos={openPhotos}
                    onAlbum={() => { setReturnToHouse(true); setAlbumComparison('garden'); setScreen('album'); }}
                    onShared={island.completedSets >= 1 ? () => { setReturnToHouse(true); openShared(); } : undefined}
                    onRewards={() => { setReturnToHouse(true); setScreen('reward'); }} />
                : screen === 'expression' ? <IslandExpression island={island} disabled={busy} pending={Boolean(expression.pending)}
                    initialItemId={expressionEntryItem} rewardGoal={rewardGoal}
                    previewAction={expression.previewAction} previewSelection={expressionScene} photo={photos.snapshot?.photos[0]} error={expression.error} onAction={expression.action}
                    onPreview={previewExpression} onFocusResident={setExpressionResident} onFocusFlag={setExpressionFlagFocus} onVisit={visitExpression}
                    soundEnabled={profile.soundEnabled} soundStatus={ambience.status}
                    onRetry={expression.retry ? () => { void expression.retry?.(); } : undefined} onListen={() => { void ambience.start(); }}
                    onClose={navigation ? home : openExperience} onLearn={() => void begin()}
                    onSaveScene={() => { openExperience(); setExperienceEntryTab('layouts'); }} />
                : screen === 'experience' ? <IslandExperiencePanel island={island} disabled={busy} onAction={experience.act} error={experience.error}
                    onExpression={openExpression}
                    initialTab={experienceEntryTab}
                    onRetry={experience.retry ? () => { void experience.retry?.(); } : undefined}
                    onFocusResident={setPortraitResident}
                    previewLayoutId={experience.previewLayoutId} onPreview={experience.preview} onPhoto={photograph}
                    onView={() => { experience.reset(); setScreen('showcase'); }} onClose={home}
                    ambienceStatus={ambience.status} onStartAmbience={() => { void ambience.start(); }}
                    onVisitFavorite={residentId => {
                        const favorite = island.items.find(item => item.kind === ISLAND_RESIDENT_PROFILES[residentId].favoriteItemKind && item.position);
                        if (!favorite) { setGuideLocation({ habitat: residentId === 'otter' ? 'waterside' : residentId === 'rabbit' ? 'garden' : 'village' }); openGuide(); return; }
                        experience.reset(); setPreview(undefined); setPlayMessage(undefined); setScreen('play');
                        setPlayRequest({ id: crypto.randomUUID(), itemId: favorite.id });
                    }} />
                : screen === 'showcase' ? <section className="island-showcase-controls" aria-label="しまの けんがく">
                    <h1>{experienceState.islandName}</h1><div><button className="island-secondary" onClick={photograph}><Camera size={18} />しゃしんに のこす</button>
                        <button className="island-secondary" onClick={() => navigation ? navigation.back() : setScreen('experience')}><X size={18} />とじる</button></div>
                    <IslandDistricts island={island} value={district} disabled={false} onChange={setDistrict} />
                </section>
                : screen === 'customization' ? <IslandCustomization island={island} selectedId={customization.selectedId}
                    rewardGoal={rewardGoal}
                    preview={customization.preview ?? getIslandCosmetics(island)} celebration={customization.celebration} disabled={busy}
                    selectedSlot={customization.selectedSlot} selectionReady={customization.selectionReady} restore={customization.restore}
                    error={customization.error} onRetry={customization.retry ? () => { void customization.retry?.(); } : undefined}
                    onSelect={(id, slot) => { customization.select(id, slot); tutorial.practice('customization'); }} onBrowse={customization.browse} onRestore={customization.selectRestore} onUndoPart={customization.undoPart}
                    onResetPreview={customization.reset} onSaveScene={() => { openExperience(); setExperienceEntryTab('layouts'); }}
                    onFurniture={openFurniture} onFocus={setCosmeticFocus}
                    onAction={action => void customization.act(action)} onClose={home} />
                : screen === 'growth' ? <IslandGrowthChoices island={island} plan={plan} disabled={busy} onSelect={id => void chooseGrowth(id)} onClose={home}
                    previewHabitat={growthPreviewHabitat} onPreview={habitat => { if (habitat) setGrowthViewHabitat(habitat); setGrowthPreviewHabitat(habitat); }} />
                : screen === 'guide' ? <IslandDiscoveryGuide island={island} disabled={busy} closeDisabled={comparisonDisabled} initialHabitat={guideLocation.habitat} initialDiscoveryId={guideLocation.discoveryId}
                    onClose={home} onTry={tryDiscovery} onPlace={(itemId, discoveryId) => {
                        const item = island.items.find(candidate => candidate.id === itemId);
                        const entry = islandDiscoveryGuide(island, discoveryId);
                        if (item && entry) { setGuideLocation({ habitat: entry.entry.habitatId, discoveryId }); setReturnToGuide(true); select(item); }
                    }} onGrow={habitat => {
                        const look = islandGrowthPreview(island, habitat);
                        setGrowthViewHabitat(look ? habitat : 'garden'); setGrowthPreviewHabitat(look ? habitat : undefined); setScreen('growth');
                    }} />
                : screen === 'album' ? <IslandAlbum island={island} initialComparison={albumComparison} disabled={busy} closeDisabled={comparisonDisabled} onClose={home}
                    onPhotos={openPhotos}
                    onShared={() => openShared()}
                    onWorkshop={id => { openWorkshop(); setWorkshopView(view => ({ ...view, mode: id ? 'observe' : 'build', selectedSpecimenId: id ?? view.selectedSpecimenId })); }}
                    onPlace={id => { const item = island.items.find(candidate => candidate.id === id); if (item) select(item); }}
                    onTry={tryDiscovery} />
                : screen === 'placement' && preview ? <IslandPlacement hideActions item={preview} valid={valid} disabled={busy} availability={placementAvailability}
                    onFindUsable={furniturePlacementChoice ? () => { setPlacementSuggestionId(undefined); setFurniturePlacementSearch(crypto.randomUUID()); } : undefined}
                    onArrangeSurroundings={furniturePlacementChoice ? () => {
                        setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined); setPlacementSuggestionId(undefined);
                        setPreview(undefined); setPlayRequest(undefined); setReturnToFurniture(false); setReturnToGuide(false); setScreen('inventory');
                    } : undefined}
                    onPoint={point => { setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined); setPlacementSuggestionId(undefined); setPreview({ ...preview, position: point }); }}
                    onRotate={() => { setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined); setPlacementSuggestionId(undefined); setPreview({ ...preview, rotation: preview.rotation + Math.PI / 2 }); }}
                    onSave={savePlacement} onStore={() => { setFurniturePlacementSearch(undefined); void place(true); }}
                    onCancel={cancelPlacement} onAppearance={level => void appearance(level)} /> : <section className="island-home-controls">
                    {feedback && <p className="island-home-feedback" role="status">{feedback}</p>}

                    {!navigation && <button className="island-primary island-start" disabled={busy} onClick={() => void begin()}>{island.pendingPlanId ? 'つづきから とく' : 'まなぶ'}<ArrowRight size={22} /></button>}

                    {latestMilestone ? <IslandMilestoneReturn milestone={latestMilestone} island={island} disabled={comparisonDisabled} onCompare={() => {
                        setAlbumComparison(latestMilestone.expansion ? 'all' : latestMilestone.habitats[0] ?? 'garden'); setScreen('album');
                    }} /> : null}
                    <IslandHomeActions onHelp={() => setScreen('help')} active={active} onOpenChange={setHomeMenuOpen} busy={busy} comparisonDisabled={comparisonDisabled} workshopUnlocked={island.completedSets >= 1}
                        pendingRewards={island.pendingRewards.length} onPlay={() => {
                        setPlayRequest(undefined); setPlayMessage(undefined); setReaction(undefined); setPreview(undefined); setScreen('play');
                    }} onGuide={openGuide} onWorkshop={openWorkshop} onInventory={() => setScreen('inventory')}
                        onCustomization={openCustomization} onExperience={openExperience} onRewards={() => setScreen('reward')}
                        onKeepsakes={enterHouse}
                        onOtherGames={() => navigate('/battle')}
                        onShared={() => openShared()} onAlbum={() => { setAlbumComparison('garden'); setScreen('album'); }}>
                        <div className="island-menu-progress">
                            {!homeJourneyEnabled() && <IslandGrowthSummary island={island} plan={plan} disabled={busy} onChoose={() => {
                                setGrowthViewHabitat(plan?.growthTarget ?? island.growth?.focus ?? 'garden'); setScreen('growth');
                            }} />}
                            <h3>ながめる ばしょ</h3>
                            <IslandDistricts island={island} value={district} disabled={busy} onChange={setDistrict} />
                            <IslandRewardGoal island={island} disabled={busy} onOpen={openRewardGoal} />
                            <IslandRewardGoalFeedback controls={rewardGoal} disabled={busy} />
                        </div>
                    </IslandHomeActions>
                </section>}
        {plan && slot && <IslandLearningPanel plan={plan} active={active && learning && !nextPlanError}
            hintPending={busyKind === 'learning-hint' && active && learning && !preparingLearning}
            intro={isFirstIslandPlan(plan)} observation={active && learning && !listening.isOpen ? observation : undefined}
            busy={busy || preparingLearning || !active || !learning || listening.isOpen} feedback={learningFeedback} englishAutoRead={profile.englishAutoRead && !listening.isOpen} onAction={action => void answer(action)}
            listeningEntry={listening.sentence ? <EnglishListeningEntry disabled={busy || preparingLearning || listening.isOpen} onOpen={listening.open} /> : undefined}
            subjectChoice={profile.subjectMode === 'mix' ? {
                selected: island.nextSubjectChoice?.afterPlanId === plan.id && island.nextSubjectChoice.subject === plan.subject,
                onChange: selected => { void run(() => setIslandNextSubject(profile.id, island.revision, plan.id, selected))
                    .then(updated => { if (updated) setSnapshot(updated); }); },
            } : undefined} />}
        {listening.isOpen && listening.sentence && <EnglishListening sentence={listening.sentence} easy={profile.uiTextMode === 'easy'} onClose={listening.close} />}
    </main>;
}

export default function Island() {
    const [initial, setInitial] = useState<UserProfile | null>();
    const [error, setError] = useState(false);
    const app = useLiveQuery(() => db.appData.get('app'), []);
    const navigate = useNavigate();
    useEffect(() => {
        let mounted = true;
        void getActiveProfile().then(profile => {
            if (!mounted) return;
            if (!profile) navigate('/onboarding', { replace: true });
            setInitial(profile);
        }).catch(() => { if (mounted) setError(true); });
        return () => { mounted = false; };
    }, [navigate]);
    const profile = app ? app.profiles[app.activeProfileId ?? ''] : initial;
    useEffect(() => {
        if (app && !profile) navigate('/onboarding', { replace: true });
    }, [app, profile, navigate]);
    if (error) return <div className="island-loading" role="alert">まだ ひらけなかったよ。<button onClick={() => window.location.reload()}>もういちど</button></div>;
    return profile ? <IslandSession key={profile.id} profile={profile} /> : <div className="island-loading" role="status">しまを ひらいているよ…</div>;
}
