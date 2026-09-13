import type { RuleEligibility } from '../../../domain/islandLife/discovery';
import { createDiscoveryScene, type DiscoveryScene, type PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import type { LifeState } from '../../../domain/islandLife/model';

type Episode = { event?: DiscoveryScene; collector?: DiscoveryPresentation; pending?: boolean; cancelled?: boolean };
export class GatheringCollector {
    private episodes = new Map<string, Episode>();
    constructor(private readonly profileId: string, private readonly presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void) {}
    sample(state: LifeState, rules: RuleEligibility[], shown: (rule: RuleEligibility) => boolean, mono: number, wall: number) {
        const current = new Set(rules.map(rule => rule.semanticSignature));
        for (const [key, episode] of this.episodes) if (!current.has(key)) { episode.cancelled = true; episode.collector?.cancel(); this.episodes.delete(key); }
        for (const rule of rules) {
            const core = shown(rule);
            let episode = this.episodes.get(rule.semanticSignature);
            if (!episode) { episode = {}; this.episodes.set(rule.semanticSignature, episode); }
            if (core && !episode.pending && !episode.event) {
                const active = episode; active.pending = true;
                void createDiscoveryScene(this.profileId, state, rule, 'live', crypto.randomUUID(), wall).then(event => {
                    if (active.cancelled) return;
                    active.event = event; active.collector = new DiscoveryPresentation(event);
                }).catch(() => { if (!active.cancelled) active.pending = false; });
            }
            const evidence = episode.collector?.sample(mono, wall, { rendered: true, foreground: true, onScreen: core, unoccluded: core, preview: false, coreShown: core });
            if (episode.event && evidence) this.presented(episode.event, evidence);
        }
    }
    pause() { for (const episode of this.episodes.values()) episode.collector?.sample(performance.now(), Date.now(), { rendered: false, foreground: false, onScreen: false, unoccluded: false, preview: false, coreShown: false }); }
    cancel() { for (const episode of this.episodes.values()) { episode.cancelled = true; episode.collector?.cancel(); } this.episodes.clear(); }
}
