import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArithmeticGateAnswerField } from "./ArithmeticGateAnswerField";

const renderField = (errorText?: string) => renderToStaticMarkup(
    <form>
        <ArithmeticGateAnswerField
            prompt="3 + 7 = ?"
            answer=""
            onAnswerChange={() => undefined}
            placeholder="答え"
            inputType="tel"
            inputMode="numeric"
            inputPattern="[0-9]*"
            errorText={errorText}
        />
    </form>,
);

describe("arithmetic gate answer field semantics", () => {
    it("labels the input and associates the visible arithmetic prompt", () => {
        const markup = renderField();
        const inputId = markup.match(/<input[^>]*id="([^"]+)"/)?.[1];
        const describedBy = markup.match(/<input[^>]*aria-describedby="([^"]+)"/)?.[1];

        expect(inputId).toBeDefined();
        expect(markup).toContain(`<label for="${inputId}" class="sr-only">答え</label>`);
        expect(describedBy).toBeDefined();
        expect(markup).toContain(`<div id="${describedBy}"`);
        expect(markup).toContain("3 + 7 = ?");
        expect(markup).toContain("focus-visible:ring-2");
        expect(markup).not.toContain("aria-invalid=");
    });

    it("announces a neutral retry message and marks the answer invalid", () => {
        const markup = renderField("もういちど ためしてね");
        const describedBy = markup.match(/<input[^>]*aria-describedby="([^"]+)"/)?.[1];
        const ids = describedBy?.split(" ") ?? [];

        expect(markup).toContain('aria-invalid="true"');
        expect(markup).toContain('role="status" aria-live="polite"');
        expect(markup).toContain("focus-visible:ring-2");
        expect(markup).toContain("もういちど ためしてね");
        expect(ids).toHaveLength(2);
        expect(ids.every(id => markup.includes(`id="${id}"`))).toBe(true);
    });
});
