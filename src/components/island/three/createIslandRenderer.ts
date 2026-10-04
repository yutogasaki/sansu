import { WebGLRenderer, type WebGLRendererParameters } from 'three';

const compactAppleDevice = () => typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

type Options = Omit<WebGLRendererParameters, 'canvas' | 'context'>;

/** Own the context before constructing Three so even a half-built renderer can be released. */
function allocate(options: Options, compact: boolean, recovery: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    let context: WebGL2RenderingContext | null = null, reason = '';
    const creationError = (event: Event) => { reason = (event as WebGLContextEvent).statusMessage || ''; };
    canvas.addEventListener('webglcontextcreationerror', creationError);
    const antialias = !compact, powerPreference = recovery ? 'default' : 'low-power';
    try {
        context = canvas.getContext('webgl2', {
            alpha: options.alpha ?? false, depth: options.depth ?? true, stencil: options.stencil ?? false,
            premultipliedAlpha: options.premultipliedAlpha ?? true,
            preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
            failIfMajorPerformanceCaveat: options.failIfMajorPerformanceCaveat ?? false,
            antialias, powerPreference,
        });
        if (!context) throw new Error(reason || 'WebGL2 context unavailable');
        const renderer = new WebGLRenderer({ ...options, canvas, context, antialias, powerPreference });
        if (context.isContextLost()) { renderer.dispose(); throw new Error('WebGL2 context lost during initialization'); }
        return { renderer, compact, recovery };
    } catch (error) {
        // Constructor failures previously left an allocated context alive across every retry.
        try { context?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* Already lost. */ }
        canvas.width = canvas.height = 1;
        canvas.remove();
        throw error;
    } finally { canvas.removeEventListener('webglcontextcreationerror', creationError); }
}

/** Apple starts compact; a failed allocation or an explicit retry uses a distinct recovery profile. */
export function createIslandRenderer(options: Options = {}, compact = false, recovery = false) {
    compact ||= compactAppleDevice() || recovery;
    if (recovery) return allocate(options, true, true);
    try { return allocate(options, compact, false); }
    catch (first) {
        try { return allocate(options, true, true); }
        catch (last) {
            throw new Error(`Initial: ${first instanceof Error ? first.message : String(first)}; Recovery: ${last instanceof Error ? last.message : String(last)}`);
        }
    }
}
