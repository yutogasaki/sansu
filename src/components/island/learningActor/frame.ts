/** Copy immediately after WebGL renders: later reads may see a cleared buffer.
 * Weak ownership lets the fullscreen celebration reuse the same pose/outfit
 * without a second renderer, generated costume, or stored character image. */
export const learningActorFrames = new WeakMap<Element, HTMLCanvasElement>();
