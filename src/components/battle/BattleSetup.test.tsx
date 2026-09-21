import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BattleSetup } from "./BattleSetup";

const renderSetup = () => renderToStaticMarkup(
    <BattleSetup onBack={() => undefined} onStart={() => undefined} />
);

describe("BattleSetup accessibility", () => {
    it("names both players' fields and groups their icon and grade choices", () => {
        const html = renderSetup();

        expect(html).toContain('aria-label="プレイヤー 1のなまえ"');
        expect(html).toContain('aria-label="プレイヤー 2のなまえ"');
        expect(html).toContain('role="group" aria-label="プレイヤー 1のアイコン"');
        expect(html).toContain('role="group" aria-label="プレイヤー 2のアイコン"');
        expect(html).toContain('role="group" aria-label="プレイヤー 1のがくねん"');
        expect(html).toContain('role="group" aria-label="プレイヤー 2のがくねん"');
        expect(html).toContain('aria-label="プレイヤー 1の もんだいの きょうか"');
        expect(html).toContain('aria-label="プレイヤー 2の もんだいの きょうか"');
    });

    it("announces the chosen avatar, exposes grades visually and semantically, and keeps 44px option targets", () => {
        const html = renderSetup();
        const optionButtons = [...html.matchAll(/<button\b([^>]*)>/g)]
            .map((match) => match[1] ?? "")
            .filter((attributes) => attributes.includes("min-h-11") && attributes.includes("focus-visible:ring-2"));

        expect(html).toContain('aria-label="プレイヤー 1のアイコンをねこにする" aria-pressed="true"');
        expect(html).toContain('aria-label="プレイヤー 2のアイコンをいぬにする" aria-pressed="true"');
        expect(optionButtons).toHaveLength(34);
        expect(optionButtons.every((attributes) => /aria-pressed="(true|false)"/.test(attributes))).toBe(true);
        expect(html).toContain("outline-2 outline-offset-1");
    });

    it("uses a compact two-player layout in iPad landscape", () => {
        const html = renderSetup();

        expect(html).toContain("ipadland:grid-cols-2");
        expect(html).toContain("ipadland:py-2");
        expect(html).toContain("ipadland:mt-2");
        expect(html).toContain("overscroll-contain");
    });

    it("keeps the mobile mode choices on one line without a redundant side badge", () => {
        const html = renderSetup();

        expect(html).toContain("mobile:hidden");
        expect(html).toContain("mobile:whitespace-nowrap mobile:text-xs");
    });
});
