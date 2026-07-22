import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeftRight, Handshake, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MakimodonEncounterArt } from "../components/explore/MakimodonEncounterArt";
import { Icons } from "../components/icons";
import { ScreenScaffold } from "../components/ScreenScaffold";

const TWO_PLAYER_OPTIONS = [
    {
        id: "boss_coop",
        title: "ふたりで きょうりょく",
        titleLines: ["ふたりで", "きょうりょく"],
        description: "同時に こたえて、じかんないに ひとつのゲージを へらす",
        badge: "きょうりょく",
        tone: "turquoise",
        icon: Handshake,
        to: "/battle/play?mode=boss_coop",
    },
    {
        id: "tug_of_war",
        title: "つなひき たいせん",
        titleLines: ["つなひき", "たいせん"],
        description: "同時に こたえて、つなを じぶんがわへ ひっぱる",
        badge: "たいせん",
        tone: "coral",
        icon: ArrowLeftRight,
        to: "/battle/play?mode=tug_of_war",
    },
] as const;

export const GameHub: React.FC = () => {
    const navigate = useNavigate();
    const reduceMotion = Boolean(useReducedMotion());

    return (
        <div className="game-hub relative h-full overflow-hidden">
            <span className="game-hub__backdrop-shape game-hub__backdrop-shape--sun" aria-hidden="true" />
            <span className="game-hub__backdrop-shape game-hub__backdrop-shape--leaf" aria-hidden="true" />

            <ScreenScaffold
                title="探検基地"
                subtitle="つぎの へんてこへ すぐ出発"
                contentClassName="game-hub__scroll"
            >
                <div className="game-hub__content">
                    <motion.section
                        className="game-hub__hero"
                        aria-labelledby="game-hub-explore-title"
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.28 }}
                    >
                        <div className="game-hub__hero-art" aria-hidden="true">
                            <MakimodonEncounterArt
                                stage="rolled"
                                reducedMotion={reduceMotion}
                                decorative
                                className="game-hub__featured-creature"
                            />
                        </div>

                        <div className="game-hub__hero-copy">
                            <p className="game-hub__kicker">きょうの へんてこ</p>
                            <h2 id="game-hub-explore-title">まきものの しょうたいを しらべよう</h2>
                            <p>ほどけた みち、のってみる？</p>
                        </div>

                        <button
                            type="button"
                            className="game-hub__launch explore-focus-ring"
                            onClick={() => navigate("/explore")}
                            aria-label="すぐ たんけんを はじめる"
                        >
                            <span>
                                <strong>すぐ たんけん</strong>
                                <small>さんすうで 道をひらく</small>
                            </span>
                            <span className="game-hub__launch-arrow" aria-hidden="true">
                                <Icons.ArrowRight />
                            </span>
                        </button>
                    </motion.section>

                    <section className="game-hub__two-player" aria-labelledby="game-hub-two-player-title">
                        <div className="game-hub__section-heading">
                            <div>
                                <p className="game-hub__section-kicker">となりに だれかいたら</p>
                                <h2 id="game-hub-two-player-title">ふたりで あそぶ</h2>
                            </div>
                            <span>2つの あそび</span>
                        </div>

                        <div className="game-hub__mode-grid">
                            {TWO_PLAYER_OPTIONS.map((option, index) => {
                                const ModeIcon = option.icon;

                                return (
                                    <motion.button
                                        key={option.id}
                                        type="button"
                                        className={`game-hub__mode-card game-hub__mode-card--${option.tone}`}
                                        onClick={() => navigate(option.to)}
                                        aria-label={`${option.title}。${option.description}`}
                                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: reduceMotion ? 0 : 0.22,
                                            delay: reduceMotion ? 0 : 0.05 + index * 0.05,
                                        }}
                                    >
                                        <span className="game-hub__mode-icon" aria-hidden="true">
                                            <ModeIcon />
                                        </span>
                                        <span className="game-hub__mode-badge">{option.badge}</span>
                                        <strong>
                                            {option.titleLines.map((line) => <span key={line}>{line}</span>)}
                                        </strong>
                                        <small>{option.description}</small>
                                        <Icons.ArrowRight className="game-hub__mode-arrow" aria-hidden="true" />
                                    </motion.button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            className="game-hub__setup-link"
                            onClick={() => navigate("/battle/play")}
                        >
                            <SlidersHorizontal aria-hidden="true" />
                            <span>
                                <strong>2人あそびを くわしく えらぶ</strong>
                                <small>なまえ・がくねん・もんだいを 先にきめる</small>
                            </span>
                            <Icons.ArrowRight aria-hidden="true" />
                        </button>
                    </section>
                </div>
            </ScreenScaffold>
        </div>
    );
};
