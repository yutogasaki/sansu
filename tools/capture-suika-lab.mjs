/**
 * G0 whitebox「かずのスイカ」を実ブラウザの実フレームで走らせ、
 * 整数 / 小数 / 分数の3profileそれぞれの挙動ログと画面キャプチャを取る。
 *
 * 前提: `npm run dev` が動いていること（DEV routeのため production build では出ない）。
 *
 *   node tools/capture-suika-lab.mjs [--base http://localhost:5173] [--out <dir>]
 *
 * これは試験器が動く証拠であり、楽しさのPASSではない。
 */
import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const readFlag = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE_URL = readFlag("--base", "http://localhost:5173");
const OUT_DIR = readFlag(
    "--out",
    "docs/design/audits/2026-07-26-g0-number-suika/captures",
);
const SCENARIOS = [
    { name: "390-tens", profile: "tens", width: 390, height: 844 },
    { name: "390-decimal", profile: "decimal", width: 390, height: 844 },
    { name: "390-fraction", profile: "fraction", width: 390, height: 844 },
    { name: "768-fraction", profile: "fraction", width: 768, height: 1024 },
];

const parseQuantity = (text) => {
    const [n, d] = text.split("/").map(Number);
    return { n, d, value: n / d };
};

const readBoard = (page) => page.evaluate(() => {
    const stage = document.querySelector(".suika-stage");
    const held = document.querySelector(".suika-held");
    const balls = [...document.querySelectorAll(".suika-ball")].map((group) => {
        const [, x, y] = group.getAttribute("transform")
            .match(/translate\(([-\d.]+) ([-\d.]+)\)/);
        return {
            quantity: group.getAttribute("data-quantity"),
            x: Number(x),
            y: Number(y),
        };
    });
    return {
        balls,
        held: held?.getAttribute("data-quantity") ?? null,
        target: stage.getAttribute("data-target"),
        score: Number(
            document.querySelector("[data-testid=suika-score]").textContent,
        ),
        status: document
            .querySelector("[data-testid=number-suika-lab]")
            .getAttribute("data-run-status"),
        recipes: document.querySelector("[data-testid=suika-recipes]")
            ?.textContent ?? null,
    };
});

/** 目標量ちょうどを狙う簡易プレイヤー。人の上手さの上限ではなく下限側の目安。 */
const pickTargetX = (board) => {
    if (!board.held) return 50;
    const held = parseQuantity(board.held).value;
    const target = parseQuantity(board.target).value;
    const epsilon = 1e-9;

    const partner = board.balls.find(
        (ball) => Math.abs(parseQuantity(ball.quantity).value + held - target) < epsilon,
    ) ?? board.balls.find(
        (ball) => parseQuantity(ball.quantity).value + held < target - epsilon,
    );
    if (partner) return partner.x;

    const spots = [22, 50, 78, 36, 64];
    return spots[board.balls.length % spots.length];
};

const dropAt = async (page, worldX) => {
    const box = await page.locator(".suika-stage").boundingBox();
    const scale = Math.min(box.width / 100, box.height / 150);
    const offsetX = (box.width - 100 * scale) / 2;
    await page.mouse.move(box.x + offsetX + worldX * scale, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.up();
};

const run = async () => {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const browser = await chromium.launch();
    const report = { baseUrl: BASE_URL, scenarios: [] };

    for (const scenario of SCENARIOS) {
        const context = await browser.newContext({
            viewport: { width: scenario.width, height: scenario.height },
            deviceScaleFactor: 2,
        });
        const page = await context.newPage();
        const consoleErrors = [];
        page.on("console", (message) => {
            if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => consoleErrors.push(String(error)));

        await page.goto(
            `${BASE_URL}/#/__dev/suika?profile=${scenario.profile}`,
            { waitUntil: "load" },
        );
        await page.waitForSelector(".suika-stage");
        await page.waitForTimeout(400);
        await page.screenshot({
            path: path.join(OUT_DIR, `${scenario.name}-ready.png`),
        });

        // 実フレームで落ちるかを、静止していないことで確かめる。
        await dropAt(page, 50);
        const fallStart = await readBoard(page);
        await page.waitForTimeout(300);
        const fallMid = await readBoard(page);
        const falls = fallMid.balls.length > 0
            && (fallStart.balls.length === 0
                || fallMid.balls[0].y > fallStart.balls[0].y);

        const log = [];
        let capturedMerge = false;
        let capturedPop = false;

        for (let index = 0; index < 60; index += 1) {
            const board = await readBoard(page);
            if (board.status === "over") break;
            const before = board.score;
            await dropAt(page, pickTargetX(board));
            await page.waitForTimeout(1150);
            const after = await readBoard(page);
            log.push({
                drop: index + 1,
                held: board.held,
                score: after.score,
                balls: after.balls.length,
            });

            const gained = after.score - before;
            if (!capturedPop && gained >= 100) {
                await page.screenshot({
                    path: path.join(OUT_DIR, `${scenario.name}-target-pop.png`),
                });
                capturedPop = true;
            } else if (!capturedMerge && gained > 0) {
                await page.screenshot({
                    path: path.join(OUT_DIR, `${scenario.name}-merge.png`),
                });
                capturedMerge = true;
            }
        }

        const ended = await readBoard(page);
        const charmSelect = await page.locator("[data-testid=suika-charm-select]")
            .count();
        if (charmSelect > 0) {
            await page.screenshot({
                path: path.join(OUT_DIR, `${scenario.name}-charm-select.png`),
            });
            await page.locator(".suika-charm").first().click();
            await page.waitForTimeout(200);
            await page.locator("[data-testid=suika-replay]").click();
            await page.waitForTimeout(400);
        }

        const afterReplay = await readBoard(page);
        report.scenarios.push({
            scenario: scenario.name,
            profile: scenario.profile,
            target: ended.target,
            falls,
            drops: log.length,
            finalScore: ended.score,
            endedStatus: ended.status,
            recipes: ended.recipes,
            capturedMerge,
            capturedPop,
            charmSelectShown: charmSelect > 0,
            replayStatus: afterReplay.status,
            consoleErrors,
            log,
        });

        await context.close();
    }

    await browser.close();
    await fs.writeFile(
        path.join(OUT_DIR, "runtime-report.json"),
        `${JSON.stringify(report, null, 4)}\n`,
        "utf8",
    );
    console.log(JSON.stringify(report.scenarios.map((entry) => ({
        scenario: entry.scenario,
        target: entry.target,
        falls: entry.falls,
        drops: entry.drops,
        finalScore: entry.finalScore,
        endedStatus: entry.endedStatus,
        recipes: entry.recipes,
        capturedPop: entry.capturedPop,
        charmSelectShown: entry.charmSelectShown,
        consoleErrors: entry.consoleErrors.length,
    })), null, 4));
};

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
