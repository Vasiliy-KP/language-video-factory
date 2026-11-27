
import assert from "node:assert/strict";

import {
    parseDashboardArguments,
    runPublishingDashboardCommand,
} from "./src/commands/publishing-dashboard.js";

async function runTests() {
    console.log("▶ Testing Publishing Dashboard CLI...");

    // 1. Перевіряємо аргументи.
    assert.deepEqual(
        parseDashboardArguments([]),
        {}
    );

    assert.throws(
        () => parseDashboardArguments(["--unknown"]),
        /does not accept arguments/
    );

    console.log("✅ CLI arguments are validated");

    // 2. Створюємо тестовий результат генератора.
    const report = {
        status: "needs_attention",
        summary: {
            packages: {
                scanned: 2,
                eligible: 1,
                excluded: 1,
            },
            platforms: {
                total: 3,
                published: 1,
                pending: 2,
                unknown: 0,
                progressPercent: 33,
            },
            youtube: {
                applicable: 1,
                checked: 1,
                clear: 0,
                duplicates: 1,
                checkFailed: 0,
                historyAvailable: true,
            },
        },
    };

    const result = {
        outputPath: "C:/test-project/output/publishing/dashboard.html",
        relativePath: "output/publishing/dashboard.html",
        fileUrl: "file:///C:/test-project/output/publishing/dashboard.html",
        sizeBytes: 12500,
        report,
    };

    const output = [];

    const logger = {
        log(...values) {
            output.push(values.join(" "));
        },
    };

    let generateCount = 0;

    const dashboardService = {
        async generate() {
            generateCount += 1;
            return result;
        },
    };

    // 3. Запускаємо CLI з mock генератором.
    const commandResult =
        await runPublishingDashboardCommand({
            args: [],
            dashboardService,
            logger,
        });

    assert.equal(commandResult, result);
    assert.equal(generateCount, 1);

    console.log("✅ Dashboard service is called once");

    // 4. Перевіряємо вивід команди.
    const text = output.join("\n");

    for (const expected of [
        "Publishing Dashboard",
        "Generating the latest publishing report",
        "Publishing Dashboard generated",
        "output/publishing/dashboard.html",
        "12500 bytes",
        "needs_attention",
        "Packages scanned: 2",
        "Ready for review: 1",
        "Excluded: 1",
        "1 / 3 published",
        "YouTube duplicates: 1",
        "Open the dashboard in your browser",
        "No videos were uploaded",
    ]) {
        assert.ok(
            text.includes(expected),
            `Expected CLI output to contain: ${expected}`
        );
    }

    console.log("✅ Dashboard generation summary is displayed");

    // 5. NEEDS ATTENTION не повинен блокувати генерацію HTML.
    assert.equal(
        commandResult.report.status,
        "needs_attention"
    );

    assert.ok(
        text.includes("Publishing Dashboard generated")
    );

    console.log("✅ Dashboard is generated even when attention is required");

    // 6. Непідтримувані аргументи не запускають генератор.
    const previousGenerateCount = generateCount;

    await assert.rejects(
        runPublishingDashboardCommand({
            args: ["--unknown"],
            dashboardService,
            logger,
        }),
        /does not accept arguments/
    );

    assert.equal(generateCount, previousGenerateCount);

    console.log("✅ Invalid arguments do not run dashboard generation");

    // 7. Помилка генератора передається виклику.
    await assert.rejects(
        runPublishingDashboardCommand({
            args: [],
            dashboardService: {
                async generate() {
                    throw new Error("Simulated HTML write failure");
                },
            },
            logger,
        }),
        /Simulated HTML write failure/
    );

    console.log("✅ Dashboard generation errors are propagated");

    console.log("\n✅ All Publishing Dashboard CLI tests passed.");
}

runTests().catch((error) => {
    console.error("\n❌ Publishing Dashboard CLI tests failed.");
    console.error(error);
    process.exitCode = 1;
});
