import type { makeLearningActorRig } from './rig';
import type { sampleBurstGesture, sampleInputGesture } from './motion';

/** Share the actual runtime pose with frame/ground regression tests. */
export function poseLearningActor(actor: ReturnType<typeof makeLearningActorRig>, gesture: ReturnType<typeof sampleInputGesture>, reaction: ReturnType<typeof sampleBurstGesture>, side: number, sway: number, big: boolean) {
    const squash = Math.min(reaction.squash, 1 - gesture.reach * .065);
    actor.hero.position.y = reaction.height;
    actor.hero.rotation.y = .035 + side * gesture.reach * .15 + reaction.turn;
    // Bend from above the planted feet: the original head, torso and connected
    // shoulder move together to meet the digit instead of merely waving at it.
    actor.heroBody.rotation.set(gesture.reach * .31, 0, -side * gesture.reach * .10 + reaction.tilt + sway);
    actor.heroBody.scale.set(1 + (1 - squash) * .30, squash, 1);
    actor.heroBody.position.y = 0;
    actor.arms.forEach((arm, index) => {
        const armSide = index === 0 ? -1 : 1;
        const reach = side === armSide ? gesture.reach * 1.10 : gesture.reach * .30;
        const cheer = reaction.arms * (!big && index === 1 ? .82 : 1);
        arm.pivot.rotation.z = armSide * (.12 + reach + cheer);
        arm.pivot.rotation.x = side === armSide ? -gesture.reach * .55 : -gesture.reach * .18;
    });
    actor.heroFeet.forEach((foot, index) => {
        const sign = index === 0 ? -1 : 1;
        foot.position.set(sign * (.12 + reaction.spread), .10 + (index === 0 ? reaction.kick : 0), .09);
        foot.rotation.set(index === 0 ? reaction.kick * -2 : 0, 0, sign * reaction.height * 1.2);
    });
    actor.expression.set(reaction.smile > .45);
}
