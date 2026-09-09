/** Keep the saved text intact while giving Japanese prose useful wrap points.
 * Fractions continue through MathProblemPrompt; this is plain prose only. */
export function IslandProsePrompt({ text }: { text: string }) {
    const chunks = text.match(/\d+(?:\.\d+)?[ \t]*(?:km\/h|m\/秒|mL|km|cm|mm|kg|m|g|L|じかん|時間|分|秒|円|こ|個|人|本|枚|%|％)[。！？]?|[^\s。！？]+[。！？]?|[。！？]|\s+/gu) ?? [];
    return <span className="island-prompt-content island-prose-prompt">
        {chunks.map((chunk, index) => /^\s+$/u.test(chunk) ? chunk
            : <span className="island-prose-chunk" key={index}>{chunk}</span>)}
    </span>;
}
