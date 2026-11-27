
import assert from "node:assert/strict";

import {
    mkdtemp,
    readFile,
    rm,
    stat,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
    PublishingDashboardService,
} from "./src/services/PublishingDashboardService.js";

const maliciousText =
    '</script><script>alert("dashboard-xss")</script>';

function createReport() {
    return {
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
                word: maliciousText,
                status: "ready_for_review",
                packageDirectory: "output/publishing/Apple",
                videoPath: "output/videos/apple.mp4",
                metadataPath: "output/metadata/Apple.json",

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
                        word: "Apple",
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
                contentErrors: [],
                platformErrors: [],
            },
        ],

        issues: [
            {
                severity: "error",
                code: "youtube_duplicate_detected",
                word: "Apple",
                message: "An identical video was uploaded before.",
            },
        ],
    };
}

async function runTests() {
    const projectRoot = await mkdtemp(
        path.join(os.tmpdir(), "publishing-dashboard-test-")
    );

    try {
        console.log("▶ Testing PublishingDashboardService...");

        const report = createReport();
        let buildCount = 0;

        // 1. Генерація HTML з актуального preflight-звіту.
        const result = await PublishingDashboardService.generate({
            projectRoot,

            preflightBuilder: async ({ projectRoot: receivedRoot }) => {
                buildCount += 1;

                assert.equal(
                    receivedRoot,
                    path.resolve(projectRoot)
                );

                return report;
            },
        });

        assert.equal(buildCount, 1);

        console.log("✅ Preflight report is generated once");

        // 2. Перевірка шляху та існування HTML-файлу.
        assert.equal(
            result.relativePath.split(path.sep).join("/"),
            "output/publishing/dashboard.html"
        );

        const fileInfo = await stat(result.outputPath);

        assert.ok(fileInfo.isFile());
        assert.ok(fileInfo.size > 0);
        assert.equal(result.sizeBytes, fileInfo.size);

        console.log("✅ Dashboard HTML file is created");

        // 3. Перевірка локального file URL.
        assert.ok(
            result.fileUrl.startsWith("file:")
        );

        console.log("✅ Local file URL is returned");

        const html = await readFile(
            result.outputPath,
            "utf8"
        );

        // 4. Перевірка автономності документа.
        assert.ok(html.includes("<!DOCTYPE html>"));
        assert.ok(html.includes('<html lang="en">'));
        assert.ok(html.includes("<style>"));
        assert.ok(html.includes("<script>"));

        assert.ok(
            !html.includes("https://cdn.")
        );

        console.log("✅ Dashboard is a standalone HTML document");

        // 5. Перевірка основних елементів інтерфейсу.
        for (const expected of [
            "Publishing Dashboard",
            "Publication progress",
            "YouTube duplicate check",
            "Publishing packages",
            "Previous YouTube upload",
            "Preflight issues",
            "LOCAL REPORT",
            "OFFLINE READY",
        ]) {
            assert.ok(
                html.includes(expected),
                `Missing dashboard content: ${expected}`
            );
        }

        console.log("✅ Dashboard sections are present");

        // 6. Перевірка безпечного вбудовування JSON.
        const dataMatch = html.match(
            /<script id="dashboard-data" type="application\/json">([\s\S]*?)<\/script>/
        );

        assert.ok(dataMatch, "Embedded report JSON was not found");

        const embeddedReport = JSON.parse(dataMatch[1]);

        assert.equal(
            embeddedReport.items[0].word,
            maliciousText
        );

        assert.ok(
            html.includes(
                "\\u003c/script\\u003e\\u003cscript\\u003e"
            )
        );

        assert.ok(
            !html.includes(maliciousText)
        );

        assert.ok(
            !html.includes('alert("dashboard-xss")')
        );

        console.log("✅ Embedded report is protected against script injection");

        // 7. Перевірка переданого готового звіту.
        const customPath = "custom/dashboard-preview.html";

        const customResult =
            await PublishingDashboardService.generate({
                projectRoot,
                outputFile: customPath,
                preflightReport: report,

                preflightBuilder: async () => {
                    throw new Error(
                        "Builder must not run when report is provided"
                    );
                },
            });

        assert.equal(
            customResult.relativePath.split(path.sep).join("/"),
            customPath
        );

        console.log("✅ Custom output path and prebuilt report are supported");

        // 8. Невалідний preflight-звіт має бути відхилений.
        await assert.rejects(
            PublishingDashboardService.generate({
                projectRoot,
                outputFile: "invalid/dashboard.html",
                preflightReport: {
                    status: "invalid",
                },
            }),
            /invalid report/
        );

        console.log("✅ Invalid preflight report is rejected");

        console.log(
            "\n✅ All PublishingDashboardService tests passed."
        );
    } finally {
        await rm(projectRoot, {
            recursive: true,
            force: true,
        });

        console.log("🧹 Temporary dashboard files removed");
    }
}

runTests().catch((error) => {
    console.error("\n❌ PublishingDashboardService tests failed.");
    console.error(error);
    process.exitCode = 1;
});
