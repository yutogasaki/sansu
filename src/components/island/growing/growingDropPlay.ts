/** A brief, repeatable physical response to placing a friend on an existing object. */
export type DropPlayKind = 'bench' | 'swing';
export const DROP_PLAY_MS = 4200;

export function sampleDropPlay(kind: DropPlayKind, elapsed: number, reduced: boolean) {
    const time = Math.max(0, Math.min(DROP_PLAY_MS, elapsed));
    const entering = Math.min(1, time / 360);
    const leaving = Math.min(1, (DROP_PLAY_MS - time) / 650);
    const hold = Math.max(0, entering * leaving);
    if (kind === 'bench') {
        const rock = reduced ? 0 : Math.sin(time / 300);
        const kick = reduced ? 0 : Math.sin(time / 220) * .42;
        return {
            bodyPitch: (-.38 - rock * .14) * hold,
            rootPitch: (-.24 - rock * .12) * hold,
            roll: reduced ? 0 : Math.sin(time / 460) * .18 * hold,
            leftFoot: (.5 + kick) * hold,
            rightFoot: (.5 - kick) * hold,
            lift: (reduced ? 0 : .13 * (1 - entering)) * leaving,
            travel: 0,
        };
    }
    const pump = reduced ? 0 : Math.sin((time - 360) / 260) * hold;
    const angle = pump * .38;
    return {
        bodyPitch: (reduced ? -.12 : -.08 - pump * .12) * hold,
        rootPitch: angle,
        roll: 0,
        leftFoot: (reduced ? .25 : .35 + pump * .42) * hold,
        rightFoot: (reduced ? .25 : .35 - pump * .42) * hold,
        lift: reduced ? 0 : 1.15 * (1 - Math.cos(angle)),
        travel: -1.15 * Math.sin(angle),
    };
}
