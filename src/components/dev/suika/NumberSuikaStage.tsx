import { useCallback, useMemo, useRef } from "react";
import {
    G0_SUIKA_PROFILES,
    SUIKA_DEAD_LINE_Y,
    SUIKA_SPAWN_Y,
    SUIKA_WORLD_HEIGHT,
    getSuikaBallRadius,
    type G0SuikaRunState,
} from "../../../domain/explore/g0NumberSuika";
import {
    formatQuantity,
    type SuikaDisplay,
    type SuikaQuantity,
} from "../../../domain/explore/suikaQuantity";
import { getSuikaQuantityFill } from "./suikaPalette";

const EVENT_VISIBLE_MS = 720;
const AIM_STEP = 4;
const VESSEL_STROKE = 1.6;
const CUE_CHAR_WIDTH_RATIO = 0.58;

const getLabelFontSize = (label: string, radius: number): number => {
    if (label.length <= 1) return radius * 0.95;
    if (label.length === 2) return radius * 0.76;
    return radius * 0.58;
};

interface BallLabelProps {
    quantity: SuikaQuantity;
    radius: number;
    display: SuikaDisplay;
}

/** 分数は斜線ではなく縦積みで描く。1/2が「量の半分」として読めることを優先する。 */
const BallLabel = ({ quantity, radius, display }: BallLabelProps) => {
    if (display === "fraction" && quantity.d !== 1) {
        const fontSize = radius * 0.62;
        return (
            <>
                <text
                    className="suika-ball__value"
                    y={-radius * 0.12}
                    fontSize={fontSize}
                >
                    {quantity.n}
                </text>
                <line
                    className="suika-ball__bar"
                    x1={-radius * 0.44}
                    x2={radius * 0.44}
                    y1={radius * 0.08}
                    y2={radius * 0.08}
                    strokeWidth={radius * 0.1}
                />
                <text
                    className="suika-ball__value"
                    y={radius * 0.74}
                    fontSize={fontSize}
                >
                    {quantity.d}
                </text>
            </>
        );
    }

    const label = formatQuantity(quantity, display);
    return (
        <text
            className="suika-ball__value"
            y={radius * 0.33}
            fontSize={getLabelFontSize(label, radius)}
        >
            {label}
        </text>
    );
};

export interface NumberSuikaStageProps {
    run: G0SuikaRunState;
    reducedMotion: boolean;
    interactive: boolean;
    onAim: (x: number) => void;
    onDrop: () => void;
}

export const NumberSuikaStage = ({
    run,
    reducedMotion,
    interactive,
    onAim,
    onDrop,
}: NumberSuikaStageProps) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const pointerActiveRef = useRef(false);

    const profile = G0_SUIKA_PROFILES[run.profileId];
    const heldQuantity = run.queue[0];
    const heldRadius = getSuikaBallRadius(heldQuantity, run.target);

    // preserveAspectRatio="xMidYMid meet" のレターボックス分を戻してから
    // world座標へ変換する。ここを素のrect.width比にすると狙いがずれる。
    const toWorldX = useCallback((clientX: number): number => {
        const svg = svgRef.current;
        if (!svg) return run.aimX;
        const rect = svg.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return run.aimX;

        const scale = Math.min(
            rect.width / run.worldWidth,
            rect.height / SUIKA_WORLD_HEIGHT,
        );
        const offsetX = (rect.width - run.worldWidth * scale) / 2;
        return (clientX - rect.left - offsetX) / scale;
    }, [run.aimX, run.worldWidth]);

    const handlePointerDown = useCallback((
        event: React.PointerEvent<SVGSVGElement>,
    ) => {
        if (!interactive) return;
        pointerActiveRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onAim(toWorldX(event.clientX));
    }, [interactive, onAim, toWorldX]);

    const handlePointerMove = useCallback((
        event: React.PointerEvent<SVGSVGElement>,
    ) => {
        if (!interactive || !pointerActiveRef.current) return;
        onAim(toWorldX(event.clientX));
    }, [interactive, onAim, toWorldX]);

    const handlePointerUp = useCallback((
        event: React.PointerEvent<SVGSVGElement>,
    ) => {
        if (!interactive || !pointerActiveRef.current) return;
        pointerActiveRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onAim(toWorldX(event.clientX));
        onDrop();
    }, [interactive, onAim, onDrop, toWorldX]);

    const handleKeyDown = useCallback((
        event: React.KeyboardEvent<SVGSVGElement>,
    ) => {
        if (!interactive) return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            onAim(run.aimX - AIM_STEP);
            return;
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            onAim(run.aimX + AIM_STEP);
            return;
        }
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            onDrop();
        }
    }, [interactive, onAim, onDrop, run.aimX]);

    // 容器の壁はCSS borderではなくviewBox内へ描く。
    // SVG要素の箱はレターボックスを含むため、CSS枠だと世界とずれる。
    const vesselPath = useMemo(() => {
        const inset = VESSEL_STROKE / 2;
        const left = inset;
        const right = run.worldWidth - inset;
        const bottom = SUIKA_WORLD_HEIGHT - inset;
        const corner = 7;

        return [
            `M ${left} 0`,
            `L ${left} ${bottom - corner}`,
            `Q ${left} ${bottom} ${left + corner} ${bottom}`,
            `L ${right - corner} ${bottom}`,
            `Q ${right} ${bottom} ${right} ${bottom - corner}`,
            `L ${right} 0`,
        ].join(" ");
    }, [run.worldWidth]);

    const visibleEvents = useMemo(() => run.events.filter(
        (event) => run.simTimeMs - event.atMs < EVENT_VISIBLE_MS,
    ), [run.events, run.simTimeMs]);

    // 式は中央揃えなので、端で起きた合体だと容器の外へはみ出て切れる。
    const clampCueX = useCallback((x: number, label: string, fontSize: number) => {
        const halfWidth = (label.length * fontSize * CUE_CHAR_WIDTH_RATIO) / 2;
        return Math.min(
            Math.max(x, halfWidth + 1),
            run.worldWidth - halfWidth - 1,
        );
    }, [run.worldWidth]);

    const dangerous = run.overflowSinceMs !== null;

    return (
        <svg
            ref={svgRef}
            className="suika-stage"
            data-testid="number-suika-stage"
            data-profile-id={run.profileId}
            data-target={`${run.target.n}/${run.target.d}`}
            data-danger={dangerous ? "true" : "false"}
            viewBox={`0 0 ${run.worldWidth} ${SUIKA_WORLD_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            role="application"
            aria-label={`${profile.label}。よこに うごかして たまを おとす。`}
            tabIndex={interactive ? 0 : -1}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
        >
            <path className="suika-stage__vessel" d={vesselPath} />

            <line
                className="suika-stage__deadline"
                x1="0"
                y1={SUIKA_DEAD_LINE_Y}
                x2={run.worldWidth}
                y2={SUIKA_DEAD_LINE_Y}
                data-danger={dangerous ? "true" : "false"}
            />

            {interactive && (
                <line
                    className="suika-stage__aim"
                    x1={run.aimX}
                    y1={SUIKA_SPAWN_Y + heldRadius}
                    x2={run.aimX}
                    y2={SUIKA_WORLD_HEIGHT}
                />
            )}

            {run.balls.map((ball) => {
                const popping = ball.popAtMs !== null;
                const flashing = !reducedMotion
                    && ball.flashUntilMs > run.simTimeMs;
                const rejecting = !reducedMotion
                    && ball.rejectUntilMs > run.simTimeMs;

                return (
                    <g
                        key={ball.id}
                        className="suika-ball"
                        data-quantity={`${ball.quantity.n}/${ball.quantity.d}`}
                        data-popping={popping ? "true" : "false"}
                        data-flashing={flashing ? "true" : "false"}
                        data-rejecting={rejecting ? "true" : "false"}
                        transform={`translate(${ball.x} ${ball.y})`}
                    >
                        <circle
                            r={ball.radius}
                            fill={getSuikaQuantityFill(ball.quantity, run.target)}
                            className="suika-ball__body"
                        />
                        <BallLabel
                            quantity={ball.quantity}
                            radius={ball.radius}
                            display={profile.display}
                        />
                    </g>
                );
            })}

            {interactive && (
                <g
                    className="suika-held"
                    data-quantity={`${heldQuantity.n}/${heldQuantity.d}`}
                    transform={`translate(${run.aimX} ${SUIKA_SPAWN_Y})`}
                >
                    <circle
                        r={heldRadius}
                        fill={getSuikaQuantityFill(heldQuantity, run.target)}
                        className="suika-ball__body"
                    />
                    <BallLabel
                        quantity={heldQuantity}
                        radius={heldRadius}
                        display={profile.display}
                    />
                </g>
            )}

            {visibleEvents.map((event) => {
                const format = (quantity: SuikaQuantity) => (
                    formatQuantity(quantity, profile.display)
                );
                const label = [
                    format(event.left),
                    "+",
                    format(event.right),
                    "=",
                    format(event.result),
                ].join("");

                if (event.kind === "reject") {
                    // 目標量を超えたから合体しなかった、と読めるように和まで見せる。
                    return (
                        <text
                            key={event.id}
                            className="suika-cue suika-cue--reject"
                            x={clampCueX(event.x, label, 7)}
                            y={event.y - 3}
                            fontSize="7"
                        >
                            {label}
                        </text>
                    );
                }

                // 合体した玉自身の数字を隠さないよう、式は玉の上へ逃がす。
                const isPop = event.kind === "target-pop";
                const fontSize = isPop ? 11 : 8;
                return (
                    <text
                        key={event.id}
                        className={isPop ? "suika-cue suika-cue--pop" : "suika-cue"}
                        x={clampCueX(event.x, label, fontSize)}
                        y={event.y - getSuikaBallRadius(event.result, run.target) - 2}
                        fontSize={fontSize}
                    >
                        {label}
                    </text>
                );
            })}
        </svg>
    );
};
