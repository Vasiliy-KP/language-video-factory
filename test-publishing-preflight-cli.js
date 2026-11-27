
import assert from "node:assert/strict";

import {
    getPreflightExitCode,
    parsePreflightArguments,
    runPublishingPreflightCommand,
} from "./src/commands/publishing-preflight.js";

async function runTests() {
    console.log("▶ Testing Publishing Preflight CLI...");

    // 1. Перевірка аргументів.
    assert.deepEqual(parsePreflightArguments([]), {});

    assert.throws(
        () => parsePreflightArguments(["--unknown"]),
        /does not accept arguments/
    );

    console.log("✅ CLI arguments are validated");

    // 2. Створюємо тестовий звіт.
    const report = {
        schemaVersion: 1,
        generatedAt: "2026-11-27T12:00:00.000Z",
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

        items: [
            {
                word: "Apple",
                status: "ready_for_review",
                packageDirectory: "output/publishing/Apple",
                videoPath: "output/videos/apple.mp4",
                metadataPath: "output/publishing/Apple/metadata.json",

                platforms: [
                    {
                        platform: "tiktok",
                        status: "pending",
                        publishedAt: null,
                        url: null,
                    },
                    {
                        platform: "instagram",
                        status: "published",
                        publishedAt: "2026-11-20T12:00:00.000Z",
                        url: "https://example.com/apple",
                    },
                    {
                        platform: "youtubeShorts",
                        status: "pending",
                        publishedAt: null,
                        url: null,
                    },
                ],

                youtube: {
                    status: "duplicate",
                    duplicate: true,
                    previousUpload: {
                        word: "OldApple",
                        title: "Apple in 6 languages",
                        videoId: "previous-video-001",
                        url: "https://www.youtube.com/watch?v=previous-video-001",
                        uploadedAt: "2026-11-18T10:00:00.000Z",
                        privacyStatus: "private",
                    },
                    error: null,
                },

                errors: [],
            },
        ],

        excluded: [
            {
                word: "Pear",
                status: "needs_fixes",
                packageDirectory: "output/publishing/Pear",

                errors: [
                    {
                        code: "video_missing",
                        message: "Video file is missing.",
                    },
                ],

                contentErrors: [
                    {
                        code: "missing_translation",
                        message: 'Translation "es" is missing.',
                    },
                ],

                platformErrors: [
                    {
                        platform: "instagram",
                        code: "platform_file_mismatch",
                        message: "Instagram content does not match metadata.",
                    },
                ],
            },
        ],

        issues: [
            {
                severity: "error",
                code: "youtube_duplicate_detected",
                word: "Apple",
                message: "This video was uploaded before.",
            },
        ],
    };

    const output = [];

    const logger = {
        log(...values) {
            output.push(values.join(" "));
        },
    };

    let buildCount = 0;

    const preflightService = {
        async build() {
            buildCount += 1;
            return report;
        },
    };

    // 3. Виконуємо команду.
    const result = await runPublishingPreflightCommand({
        args: [],
        preflightService,
        logger,
    });

    assert.equal(result, report);
    assert.equal(buildCount, 1);

    console.log("✅ Preflight service is called");

    // 4. Перевіряємо основні розділи звіту.
    const text = output.join("\n");

    for (const expected of [
        "Publishing preflight",
        "NEEDS ATTENTION",
        "Package summary",
        "Scanned: 2",
        "Eligible: 1",
        "Excluded: 1",
        "Publication progress",
        "Published: 1",
        "Pending: 2",
        "YouTube duplicate check",
        "Duplicates: 1",
        "Eligible packages",
        "TikTok: pending",
        "Instagram: published",
        "Previous word: OldApple",
        "Video ID: previous-video-001",
        "Excluded packages",
        "missing_translation",
        "platform_file_mismatch",
        "Preflight issues",
        "No videos were uploaded",
    ]) {
        assert.ok(
            text.includes(expected),
            `Expected CLI output to contain: ${expected}`
        );
    }

    console.log("✅ All report sections are displayed");

    // 5. Перевіряємо exit code.
    assert.equal(getPreflightExitCode(report), 1);

    assert.equal(
        getPreflightExitCode({
            status: "ready_for_review",
        }),
        0
    );

    assert.equal(
        getPreflightExitCode({
            status: "empty",
        }),
        1
    );

    console.log("✅ CLI exit codes are correct");

    // 6. Невідомий аргумент не повинен запускати сервіс.
    const beforeInvalidArgument = buildCount;

    await assert.rejects(
        runPublishingPreflightCommand({
            args: ["--unknown"],
            preflightService,
            logger,
        }),
        /does not accept arguments/
    );

    assert.equal(buildCount, beforeInvalidArgument);

    console.log("✅ Invalid arguments do not run preflight");

    console.log("\n✅ All Publishing Preflight CLI tests passed.");
}

runTests().catch((error) => {
    console.error("\n❌ Publishing Preflight CLI tests failed.");
    console.error(error);
    process.exitCode = 1;
});
