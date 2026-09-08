/** Serialized into the browser. Passive diagnostics only: original sources,
 * gains, start/resume times and destination edges are never replaced/delayed.
 * AudioWorklet records a silent parallel branch on the render clock. Module
 * setup is asynchronous; unmeasured onset is reported, never fabricated. This is QA,
 * not a recommended product audio implementation or a throughput benchmark. */
export function installProbeInDocument() {
    if (window.__expressionAudioProbe) return;
    const native = { connect: AudioNode.prototype.connect, disconnect: AudioNode.prototype.disconnect,
        start: AudioBufferSourceNode.prototype.start, stop: AudioBufferSourceNode.prototype.stop, close: AudioContext.prototype.close };
    const ids = new WeakMap(), contexts = new WeakMap(), sources = new WeakMap(), taps = new Map(), edges = new Map(), listeners = new Map(), endedListeners = new Map(), modules = new WeakMap();
    // The qualified caller performs 153 real answers before this audio phase.
    // Retain their native provenance too: 256 sources could be exhausted by
    // ordinary learning cues alone. Limits remain explicit, finite and fatal
    // to QA eligibility (never fatal to the application's native operation).
    const limits = { sources: 2048, outputs: 1024, events: 20000, portMessages: 200000, pcmBytes: 128 * 1024 * 1024 };
    const data = { version: 'expression-audio-probe-worklet-v5', limits, contexts: [], sources: [], pcm: [], outputs: [], events: [], errors: [], windows: [] };
    let nextNode = 0, activeWindow = null, bytes = 0, receivedPortMessages = 0, disposed = false;
    const now = () => performance.now();
    const id = node => { if (!ids.has(node)) ids.set(node, `node-${++nextNode}`); return ids.get(node); };
    // All instrumentation is subordinate to the native operation. Diagnostics
    // may become invalid, but can never throw through native APIs/listeners.
    const error = cause => { const message = String(cause); if (data.errors.length < 64 && !data.errors.includes(message)) data.errors.push(message); };
    const attempt = operation => { try { return operation(); } catch (cause) { error(cause); return undefined; } };
    const loadModule = owner => {
        if (modules.has(owner)) return modules.get(owner);
        const state = { ready: false, failed: null, callbacks: [] }; modules.set(owner, state);
        const url = URL.createObjectURL(new Blob([`class GainCapture extends AudioWorkletProcessor {
            constructor() { super(); this.samples = new Float32Array(1024); this.length = 0; this.firstFrame = null; this.nextFrame = null; this.sequence = 0; }
            process(inputs, outputs) {
                for (const channels of outputs) for (const channel of channels) channel.fill(0);
                const input = inputs[0]?.[0], count = input?.length ?? outputs[0]?.[0]?.length ?? 128;
                if (this.nextFrame !== null && currentFrame !== this.nextFrame) {
                    this.port.postMessage({ type: 'gap', expectedFrame: this.nextFrame, actualFrame: currentFrame });
                    this.length = 0; this.firstFrame = null;
                }
                this.nextFrame = currentFrame + count;
                for (let index = 0; index < count; index++) {
                    if (!this.length) this.firstFrame = currentFrame + index;
                    this.samples[this.length++] = input ? input[index] : 0;
                    if (this.length === this.samples.length) {
                        this.port.postMessage({ type: 'block', frame: this.firstFrame, sequence: this.sequence++, sampleRate, samples: this.samples }, [this.samples.buffer]);
                        this.samples = new Float32Array(1024); this.length = 0; this.firstFrame = null;
                    }
                }
                return true;
            }
        }
        registerProcessor('sansu-gain-capture-v1', GainCapture);`], { type: 'text/javascript' }));
        try {
            owner.audioWorklet.addModule(url).then(() => {
                URL.revokeObjectURL(url); state.ready = true;
                for (const callback of state.callbacks.splice(0)) attempt(callback);
            }, cause => { URL.revokeObjectURL(url); state.failed = String(cause); state.callbacks.length = 0;
                if (owner.state !== 'closed' && !disposed) error(cause); });
        } catch (cause) { URL.revokeObjectURL(url); state.failed = String(cause); throw cause; }
        return state;
    };
    const event = (type, extra = {}) => {
        if (data.events.length >= limits.events) { error('Audio probe event bound exceeded'); return; }
        data.events.push({ type, at: now(), ...extra });
    };
    const context = value => {
        if (!contexts.has(value)) {
            const item = { id: `context-${data.contexts.length + 1}`, sampleRate: value.sampleRate, state: value.state, createdAt: now(), closeCalledAt: null, closedAt: null };
            contexts.set(value, item); data.contexts.push(item);
            const listener = () => attempt(() => {
                item.state = value.state;
                if (value.state === 'closed') { item.closedAt ??= now(); retireContext(value); }
                event('statechange', { contextId: item.id, state: item.state });
            });
            listeners.set(value, listener); value.addEventListener('statechange', listener);
        }
        return contexts.get(value);
    };
    const encoded = samples => {
        const view = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
        bytes += view.byteLength; if (bytes > limits.pcmBytes) throw new Error('Audio probe PCM bound exceeded');
        let binary = ''; for (let i = 0; i < view.length; i += 8192) binary += String.fromCharCode(...view.subarray(i, i + 8192)); return btoa(binary);
    };
    const pcm = buffer => {
        const values = buffer.getChannelData(0), bits = new Uint32Array(values.buffer, values.byteOffset, values.length);
        let hash = 2166136261; for (const value of bits) hash = Math.imul(hash ^ value, 16777619) >>> 0;
        const key = `${buffer.sampleRate}:${buffer.length}:${hash}`;
        // Fast lookup is never proof of equality: compare every raw bit too.
        const old = data.pcm.find(entry => entry.key === key && entry.bits.every((value, index) => value === bits[index]));
        if (old) return old.id;
        const shellShape = [2, 14].includes(buffer.duration)
            && values.subarray(Math.ceil(1.3 * buffer.sampleRate)).every(value => value === 0)
            && [0, .36, .72].every((time, index) => {
                const begin = Math.floor((time + .025) * buffer.sampleRate), end = Math.floor((time + .15) * buffer.sampleRate), hz = [540, 675, 810][index];
                let real = 0, imaginary = 0;
                for (let i = begin; i < end; i++) { const phase = 2 * Math.PI * hz * (i - begin) / buffer.sampleRate;
                    real += values[i] * Math.cos(phase); imaginary += values[i] * Math.sin(phase); }
                return Math.hypot(real, imaginary) / (end - begin) > .001;
            });
        const entry = { id: `pcm-${data.pcm.length + 1}`, key, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels,
            length: buffer.length, shellShape, bits: new Uint32Array(bits), base64: encoded(values) };
        data.pcm.push(entry); return entry.id;
    };
    const outletIds = nodeId => {
        const found = new Set(), visited = new Set();
        const walk = key => {
            if (visited.has(key)) return; visited.add(key);
            if (taps.has(key)) found.add(taps.get(key).output.id);
            for (const edge of edges.get(key) ?? []) walk(edge.to);
        };
        walk(nodeId); return [...found];
    };
    const updateRoutes = owner => {
        const ownerId = context(owner).id;
        for (const source of data.sources.filter(source => source.contextId === ownerId)) {
            const outlets = outletIds(source.id);
            for (const route of source.routes) if (route.endAudioTime === null && !outlets.includes(route.outletId)) route.endAudioTime = owner.currentTime;
            for (const outletId of outlets) {
                if (!source.outlets.includes(outletId)) source.outlets.push(outletId);
                if (!source.routes.some(route => route.outletId === outletId && route.endAudioTime === null))
                    source.routes.push({ outletId, startAudioTime: owner.currentTime, endAudioTime: null });
            }
        }
    };
    const release = tap => {
        if (tap.released) return; tap.released = true; tap.output.releasedAt = now();
        taps.delete(tap.output.nodeId);
        if (tap.processor) { tap.processor.port.onmessage = null; tap.processor.port.close(); }
        // A gain's real destination might already have been disconnected. Each
        // cleanup still runs independently, without replacing the app's result.
        if (tap.processor) try { native.disconnect.call(tap.node, tap.processor); } catch { /* Already detached by the native owner. */ }
        if (tap.processor) try { native.disconnect.call(tap.processor); } catch { /* Already detached. */ }
        if (tap.silent) try { native.disconnect.call(tap.silent); } catch { /* Already detached. */ }
    };
    const retireContext = owner => {
        for (const tap of [...taps.values()]) if (tap.node.context === owner) release(tap);
        for (const [key, list] of edges) if (list[0]?.contextId === contexts.get(owner)?.id) edges.delete(key);
        updateRoutes(owner);
        const listener = listeners.get(owner); if (listener) { owner.removeEventListener('statechange', listener); listeners.delete(owner); }
        for (const [source, handler] of endedListeners) if (source.context === owner) { source.removeEventListener('ended', handler); endedListeners.delete(source); }
    };
    const matchesDisconnect = (edge, args) => {
        if (!args.length) return true;
        if (typeof args[0] === 'number') return edge.output === args[0];
        return edge.to === id(args[0]) && (args.length < 2 || edge.output === args[1]) && (args.length < 3 || edge.input === args[2]);
    };
    AudioNode.prototype.connect = function (destination, ...args) {
        const result = native.connect.call(this, destination, ...args);
        attempt(() => {
            const from = id(this), to = id(destination), owner = context(this.context), outputIndex = args[0] ?? 0, inputIndex = args[1] ?? 0;
            const list = edges.get(from) ?? [];
            if (!list.some(edge => edge.to === to && edge.output === outputIndex && edge.input === inputIndex))
                list.push({ to, output: outputIndex, input: inputIndex, contextId: owner.id });
            edges.set(from, list); event('connect', { nodeId: from, destinationId: to, output: outputIndex, input: inputIndex, contextId: owner.id });
            if (destination === this.context.destination && !taps.has(from)) {
                if (data.outputs.length >= limits.outputs) throw new Error('Audio probe outlet bound exceeded');
                const output = { id: `outlet-${data.outputs.length + 1}`, nodeId: from, contextId: owner.id, blocks: [], createdAt: now(), releasedAt: null,
                    measurement: 'AudioWorklet currentFrame', readyAt: null, readyAudioTime: null, portMessageCount: 0, firstValidBlock: null, discontinuities: [] };
                data.outputs.push(output);
                const tap = { node: this, processor: null, silent: null, output, released: false }; taps.set(from, tap);
                const attach = () => {
                    if (tap.released || disposed || this.context.state === 'closed') return;
                    try {
                        const processor = new AudioWorkletNode(this.context, 'sansu-gain-capture-v1', { numberOfInputs: 1, numberOfOutputs: 1,
                            outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
                        const silent = this.context.createGain(); silent.gain.value = 0;
                        tap.processor = processor; tap.silent = silent;
                        processor.port.onmessage = message => attempt(() => {
                            // This ordinal belongs to one native MessagePort and is retained
                            // even outside a PCM window. Wall-clock/window labels cannot
                            // prove that a delayed gap preceded the first valid block.
                            if (receivedPortMessages >= limits.portMessages) throw new Error('Audio probe port-message bound exceeded');
                            receivedPortMessages++; const messageOrder = ++output.portMessageCount;
                            const block = message.data;
                            if (!block || typeof block !== 'object') throw new Error('Malformed render message');
                            if (block.type === 'gap') {
                                if (!Number.isSafeInteger(block.expectedFrame) || block.expectedFrame < 0
                                    || !Number.isSafeInteger(block.actualFrame) || block.actualFrame < 0) throw new Error('Malformed render discontinuity');
                                if (output.discontinuities.length >= limits.events) throw new Error('Render discontinuity evidence limit reached');
                                const discontinuity = { at: now(), contextId: owner.id, outletId: output.id, window: activeWindow, messageOrder,
                                    expectedFrame: block.expectedFrame, actualFrame: block.actualFrame };
                                output.discontinuities.push(discontinuity); event('render-gap', discontinuity); return;
                            }
                            if (block.type !== 'block') throw new Error(`Unknown render message type: ${String(block.type)}`);
                            if (!Number.isSafeInteger(block.frame) || block.frame < 0 || !Number.isSafeInteger(block.sequence) || block.sequence < 0
                                || block.sampleRate !== this.context.sampleRate
                                || !(block.samples instanceof Float32Array) || block.samples.length !== 1024) throw new Error('Malformed render block');
                            // Measurement scoping limits retained PCM, never
                            // structural validation or global probe failures.
                            output.firstValidBlock ??= { messageOrder, at: now(), window: activeWindow,
                                renderFrame: block.frame, sequence: block.sequence, frameCount: block.samples.length, sampleRate: block.sampleRate };
                            if (!activeWindow) return;
                            const begin = block.frame / block.sampleRate, end = (block.frame + block.samples.length) / block.sampleRate;
                            const sourceIds = data.sources.filter(source => source.contextId === owner.id
                                && source.scheduledStartAudioTime < end && (source.endAudioTime ?? Infinity) > begin
                                && source.routes.some(route => route.outletId === output.id && route.startAudioTime < end && (route.endAudioTime ?? Infinity) > begin))
                                .map(source => source.id);
                            output.blocks.push({ window: activeWindow, at: now(), playbackTime: begin, renderFrame: block.frame,
                                sequence: block.sequence, messageOrder, sourceIds, pcm: encoded(block.samples) });
                        });
                        native.connect.call(this, processor, outputIndex, 0); native.connect.call(processor, silent); native.connect.call(silent, destination);
                        output.readyAt = now(); output.readyAudioTime = this.context.currentTime;
                    } catch (cause) { release(tap); throw cause; }
                };
                const module = loadModule(this.context);
                if (module.failed) throw new Error(module.failed);
                if (module.ready) attach(); else module.callbacks.push(attach);
            }
            updateRoutes(this.context);
        });
        return result;
    };
    AudioNode.prototype.disconnect = function (...args) {
        const result = native.disconnect.apply(this, args);
        attempt(() => {
            const key = id(this), remaining = (edges.get(key) ?? []).filter(edge => !matchesDisconnect(edge, args));
            if (remaining.length) edges.set(key, remaining); else edges.delete(key);
            const entry = sources.get(this); if (entry && !remaining.length) entry.disconnectAt ??= now();
            event('disconnect', { nodeId: key, contextId: context(this.context).id, all: !args.length,
                destinationId: args.length && typeof args[0] !== 'number' ? id(args[0]) : null, output: typeof args[0] === 'number' ? args[0] : args[1] ?? null, input: args[2] ?? null });
            const tap = taps.get(key);
            if (tap && !remaining.some(edge => edge.to === id(this.context.destination))) release(tap);
            updateRoutes(this.context);
        });
        return result;
    };
    AudioBufferSourceNode.prototype.start = function (...args) {
        const result = native.start.apply(this, args);
        attempt(() => {
            const owner = context(this.context), scheduled = Math.max(this.context.currentTime, args[0] ?? 0);
            const entry = { id: id(this), contextId: owner.id, sampleRate: this.buffer?.sampleRate,
                channels: this.buffer?.numberOfChannels, duration: this.buffer?.duration, loop: this.loop, startedAt: now(), audioTime: this.context.currentTime,
                scheduledStartAudioTime: scheduled, endAudioTime: this.loop ? null : scheduled + Math.min(args[2] ?? Infinity, Math.max(0, (this.buffer?.duration ?? Infinity) - (args[1] ?? 0))),
                startArgs: args, gestureActive: navigator.userActivation?.isActive ?? false, outlets: [], routes: [],
                stopAt: null, disconnectAt: null, endedAt: null, pcmId: null };
            if (data.sources.length >= limits.sources) throw new Error('Audio probe source bound exceeded');
            sources.set(this, entry); data.sources.push(entry); updateRoutes(this.context);
            // Track *all* sources before copying/classifying bounded raw PCM.
            if (this.buffer?.numberOfChannels === 1 && [2, 6, 14].some(n => Math.abs(this.buffer.duration - n) < 1 / this.buffer.sampleRate)) entry.pcmId = pcm(this.buffer);
            entry.ambienceCandidate = Boolean(entry.pcmId && (entry.loop && entry.duration === 6 || data.pcm.find(value => value.id === entry.pcmId)?.shellShape));
            event('start', { sourceId: entry.id, contextId: owner.id });
            const ended = () => attempt(() => {
                entry.endedAt ??= now(); entry.endAudioTime = Math.min(entry.endAudioTime ?? Infinity, this.context.currentTime);
                event('ended', { sourceId: entry.id, contextId: owner.id });
                this.removeEventListener('ended', ended); endedListeners.delete(this);
            });
            endedListeners.set(this, ended); this.addEventListener('ended', ended, { once: true });
        });
        return result;
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
        const result = native.stop.apply(this, args);
        attempt(() => {
            const entry = sources.get(this), at = Math.max(this.context.currentTime, args[0] ?? 0);
            if (entry) { entry.stopAt = now() + (at - this.context.currentTime) * 1000; entry.endAudioTime = at; }
            event('stop', { sourceId: id(this), contextId: context(this.context).id, args });
        });
        return result;
    };
    AudioContext.prototype.close = function (...args) {
        // Native call comes first, so even broken diagnostics cannot prevent
        // close or change its promise identity / synchronous native exception.
        const result = native.close.apply(this, args);
        attempt(() => {
            const owner = context(this); owner.closeCalledAt ??= now(); event('close', { contextId: owner.id });
            void result.then(() => attempt(() => {
                owner.state = this.state; owner.closedAt ??= now(); retireContext(this);
            }), cause => error(cause));
        });
        return result;
    };
    const visibility = () => attempt(() => event('visibility', { hidden: document.hidden, state: document.visibilityState, focused: document.hasFocus() }));
    const gesture = value => attempt(() => event('gesture', { trusted: value.isTrusted, kind: value.type, active: navigator.userActivation?.isActive ?? false }));
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pointerdown', gesture, true); window.addEventListener('keydown', gesture, true);
    window.__expressionAudioProbe = {
        version: data.version,
        begin(label) { if (disposed) throw new Error('Audio probe disposed'); if (activeWindow) throw new Error('Audio capture already active'); if (data.windows.some(value => value.label === label)) throw new Error('Duplicate capture label');
            activeWindow = label; const marker = { label, at: now(), sourceCount: data.sources.length }; data.windows.push(marker); return marker; },
        end() { const label = activeWindow; activeWindow = null; return label; },
        snapshot(raw = false) { return { ...data, receivedPortMessages, limits: { ...limits }, errors: [...data.errors], events: data.events.map(value => ({ ...value })), windows: data.windows.map(value => ({ ...value })),
            live: { taps: taps.size, edges: [...edges.values()].reduce((n, list) => n + list.length, 0), contexts: listeners.size, sourceListeners: endedListeners.size, disposed },
            contexts: data.contexts.map(value => ({ ...value })), sources: data.sources.map(value => ({ ...value, outlets: [...value.outlets], routes: value.routes.map(route => ({ ...route })) })),
            pcm: data.pcm.map(({ bits: _bits, base64, ...entry }) => ({ ...entry, ...(raw ? { base64 } : {}) })),
            outputs: data.outputs.map(output => ({ ...output, firstValidBlock: output.firstValidBlock ? { ...output.firstValidBlock } : null, discontinuities: output.discontinuities.map(gap => ({...gap})),
                blocks: output.blocks.map(({ pcm, ...block }) => ({ ...block, sourceIds: [...block.sourceIds], ...(raw ? { pcm } : {}) })) })) }; },
        dispose() { activeWindow = null; disposed = true;
            for (const tap of [...taps.values()]) attempt(() => release(tap)); edges.clear();
            for (const [owner, listener] of listeners) attempt(() => owner.removeEventListener('statechange', listener)); listeners.clear();
            for (const [source, listener] of endedListeners) attempt(() => source.removeEventListener('ended', listener)); endedListeners.clear();
            AudioNode.prototype.connect = native.connect; AudioNode.prototype.disconnect = native.disconnect;
            AudioBufferSourceNode.prototype.start = native.start; AudioBufferSourceNode.prototype.stop = native.stop; AudioContext.prototype.close = native.close;
            document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pointerdown', gesture, true); window.removeEventListener('keydown', gesture, true); },
    };
}

/** Call before the qualified page's first navigation. Does not open a page. */
export async function installExpressionAudioProbe(context) { await context.addInitScript(installProbeInDocument); }
