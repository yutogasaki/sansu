import React from "react";
import {
    MAKIMODON_DISCOVERY_PAGE,
    type DiscoveryPageFeatureId,
} from "../../domain/explore";
import type { DiscoveryPageArtVariant } from "./DiscoveryPageArt";
import { MakimodonEncounterArt } from "./MakimodonEncounterArt";
import "./MakimodonResearchArt.css";

interface MakimodonResearchArtProps {
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    variant?: DiscoveryPageArtVariant;
}

export const MakimodonResearchArt: React.FC<MakimodonResearchArtProps> = ({
    discoveredFeatureIds,
    variant = "reveal",
}) => {
    const [tripFeatureId, pathFeatureId, payoffFeatureId] = (
        MAKIMODON_DISCOVERY_PAGE.chain.featureIds
    );
    const showTrip = discoveredFeatureIds.includes(tripFeatureId);
    const showPath = discoveredFeatureIds.includes(pathFeatureId);
    const showPayoff = discoveredFeatureIds.includes(payoffFeatureId);
    const mainStage = showPayoff ? "payoff" : showPath ? "path" : showTrip ? "trip" : "rolled";
    const accessibleDescription = showPayoff
        ? "巻かれた帯のような生き物、マキモドン。ほどけて道になった体が全部巻き戻り、相棒を背中へ運んだ調査ページ。"
        : `まだ名前のわからない巻かれた生き物。${discoveredFeatureIds.length}つの体のひみつを見つけた調査ページ。`;

    return (
        <div
            className={`makimodon-research-art makimodon-research-art--${variant}`}
            role="img"
            aria-label={accessibleDescription}
            data-composition="large-payoff-two-causes"
        >
            <div className="makimodon-research-art__paper" aria-hidden="true" />

            <div
                className="makimodon-research-art__hero"
                data-role="payoff"
                aria-hidden="true"
            >
                <MakimodonEncounterArt stage={mainStage} decorative reducedMotion />
            </div>

            {showTrip ? (
                <div
                    className="makimodon-research-art__beat makimodon-research-art__beat--trip"
                    data-role="cause"
                    aria-hidden="true"
                >
                    <MakimodonEncounterArt stage="trip" decorative reducedMotion />
                    <span>ほどけて、ぺたん。</span>
                </div>
            ) : null}

            {showPath ? (
                <div
                    className="makimodon-research-art__beat makimodon-research-art__beat--path"
                    data-role="cause"
                    aria-hidden="true"
                >
                    <MakimodonEncounterArt stage="path" decorative reducedMotion />
                    <span>みちに なった。</span>
                </div>
            ) : null}

            <svg
                className="makimodon-research-art__ink-path"
                viewBox="0 0 360 260"
                aria-hidden="true"
            >
                <path d="M111 51C151 35 193 38 226 66C241 79 248 94 252 113" />
                <path d="m244 102 9 14 9-16" />
                {showPayoff ? (
                    <>
                        <path d="M96 218C132 234 171 230 202 211" />
                        <path d="m190 210 14 0-6 12" />
                    </>
                ) : null}
            </svg>

            {showPayoff ? (
                <div className="makimodon-research-art__identity" aria-hidden="true">
                    <span>くるくる もどって、どん。</span>
                    <strong>マキモドン！</strong>
                </div>
            ) : null}

            {showPayoff ? (
                <div className="makimodon-research-art__payoff-copy" aria-hidden="true">
                    <strong>ぜんぶ まきもどった！</strong>
                    <span>あいぼうが せなかへ どん。</span>
                </div>
            ) : null}
        </div>
    );
};
