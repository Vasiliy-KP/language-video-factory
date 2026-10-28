import assert from "node:assert/strict";

import {
    PublicationReportService,
} from "./src/services/PublicationReportService.js";

async function runTests() {
    console.log("▶ Testing PublicationReportService...");

    const queue = {
        items: [
            {
                word: "Apple",
                status: "ready_for_review",
                platforms: ["tiktok", "instagram", "youtubeShorts"],
            },
            {
                word: "Bicycle",
                status: "ready_for_review",
                platforms: ["tiktok", "instagram", "youtubeShorts"],
            },
        ],
        excluded: [
            {
                word: "Pear",
                status: "needs_fixes",
            },
        ],
    };

    const statusReader = async ({ word, platforms }) => {
        const result = {};

        for (const platform of platforms) {
            const isPublished =
                word === "Apple" && platform === "instagram";

            result[platform] = isPublished
                ? {
                    status: "published",
                    publishedAt: "2026-10-27T16:30:00.000Z",
                    url: "https://example.com/apple",
                }
                : {
                    status: "pending",
                    publishedAt: null,
                    url: null,
                };
        }

        return {
            word,
            platforms: result,
        };
    };

    const report = await PublicationReportService.build({
        queueBuilder: async () => queue,
        statusReader,
    });

    assert.deepEqual(report.summary, {
        words: 2,
        totalPlatforms: 6,
        published: 1,
        pending: 5,
        progressPercent: 17,
        excludedPackages: 1,
    });

    console.log("✅ Overall publication progress is calculated");

    const apple = report.items.find(
        (item) => item.word === "Apple"
    );

    assert.deepEqual(apple.summary, {
        total: 3,
        published: 1,
        pending: 2,
        progressPercent: 33,
    });

    assert.equal(
        apple.platforms.find(
            (item) => item.platform === "instagram"
        ).status,
        "published"
    );

    assert.equal(
        apple.platforms.find(
            (item) => item.platform === "instagram"
        ).url,
        "https://example.com/apple"
    );

    console.log("✅ Per-word status, date and URL are included");

    const bicycle = report.items.find(
        (item) => item.word === "Bicycle"
    );

    assert.deepEqual(bicycle.summary, {
        total: 3,
        published: 0,
        pending: 3,
        progressPercent: 0,
    });

    console.log("✅ Pending platforms are counted correctly");

    assert.equal(report.excluded.length, 1);
    assert.equal(report.excluded[0].word, "Pear");

    console.log("✅ Excluded packages are preserved");

    const emptyReport = await PublicationReportService.build({
        queueBuilder: async () => ({
            items: [],
            excluded: [],
        }),
        statusReader,
    });

    assert.equal(emptyReport.summary.totalPlatforms, 0);
    assert.equal(emptyReport.summary.published, 0);
    assert.equal(emptyReport.summary.pending, 0);
    assert.equal(emptyReport.summary.progressPercent, 0);

    console.log("✅ Empty queue is handled correctly");

    assert.ok(!Number.isNaN(Date.parse(report.generatedAt)));

    console.log("✅ Report timestamp is valid");
    console.log("\n✅ All publication report tests passed");
}

runTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});