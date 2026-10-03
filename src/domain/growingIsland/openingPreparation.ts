/** Read-only preparation has a deadline; a late result can never reach the save phase. */
export async function prepareIslandOpening<T>(prepare: (signal: AbortSignal) => Promise<T>, timeoutMs = 120_000): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error('しまの よみこみが とまったよ。もういちど ひらいてね。');
            controller.abort(error); reject(error);
        }, timeoutMs);
    });
    try { return await Promise.race([prepare(controller.signal), deadline]); }
    finally { clearTimeout(timer!); }
}
