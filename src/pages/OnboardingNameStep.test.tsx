import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegacyOnboardingNameStep } from "./Onboarding";

const render = (name: string) => renderToStaticMarkup(
    <LegacyOnboardingNameStep name={name} onNameChange={() => undefined} onContinue={() => undefined} />
);

describe("LegacyOnboardingNameStep", () => {
    it("associates the visible nickname question and help text with the input", () => {
        const markup = render("");

        expect(markup).toMatch(/<label\b[^>]*for="legacy-onboarding-name"[^>]*>ニックネームをおしえてね<\/label>/);
        expect(markup).toMatch(/<input\b[^>]*id="legacy-onboarding-name"[^>]*>/);
        expect(markup).toContain('aria-describedby="legacy-onboarding-name-help"');
        expect(markup).toContain('<span id="legacy-onboarding-name-help">あとで かえられるよ</span>');
        expect(markup).toMatch(/autoComplete="nickname"/i);
    });

    it("keeps the continue action disabled until a nonblank nickname is entered", () => {
        const blankButton = render("   ").match(/<button\b[^>]*>次へ<\/button>/)?.[0];
        const namedButton = render("ぽっこ").match(/<button\b[^>]*>次へ<\/button>/)?.[0];

        expect(blankButton).toContain('disabled=""');
        expect(namedButton).not.toContain('disabled=""');
    });
});
