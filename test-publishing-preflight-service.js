import path from "node:path";
import assert from "node:assert/strict";

import {
    PublishingPreflightService,
} from "./src/services/PublishingPreflightService.js";

const platformNames = [
    "tiktok",
    "instagram",
    "youtubeShorts",
];

function createQueueItem(word) {
    return {
        word,
        status: "ready_for_review",
        packageDirectory: `output/publishing/${word}`,
        videoPath: `output/videos/${word.toLowerCase()}.mp4`,
        metadataPath: `output/publishing/${word}/metadata.json`,
        platforms: [...platformNames],
    };
}

function createTracking(word) {
    const platforms = Object.fromEntries(
        platformNames.map((platform) => [
            platform,
            {
                status:
                    word === "Apple" && platform === "instagram"
                        ? "published"
                        : "pending",
                publishedAt:
                    word === "Apple" && platform === "instagram"
                        ? "2026-11-20T12:00:00.000Z"
                        : null,
                url:
                    word === "Apple" && platform === "instagram"
                        ? "https://example.com/apple"
                        : null,
            },
        ])
    );

    return {
        word,
        platforms,
    };
}

async function runTests() {
    console.log("▶ Testing PublishingPreflightService...");

    const queue = {
        summary: {
            scanned: 4,
            eligible: 3,
            excluded: 1,
        },
        items: [
            createQueueItem("Apple"),
            createQueueItem("Bicycle"),
            createQueueItem("Orange"),
        ],
        excluded: [
            {
                word: "Pear",
                status: "needs_fixes",
                errors: [
                    {
                        code: "video_missing",
                        message: "Video file is missing.",
                    },
                ],
            },
        ],
    };

    let historyLoadCount = 0;
    let fingerprintCount = 0;
    let statusReadCount = 0;

    const historyService = {
        async load(options) {
            historyLoadCount += 1;

            assert.ok(options.projectRoot);
            assert.equal(
                options.historyFile,
                "output/publishing/youtube-upload-history.json"
            );

            return {
                schemaVersion: 1,
                items: [
                    {
                        word: "OldApple",
                        title: "Apple in 6 languages",
                        videoId: "previous-apple-video",
                        url: "https://www.youtube.com/watch?v=previous-apple-video",
                        uploadedAt: "2026-11-18T10:00:00.000Z",
                        privacyStatus: "private",
                        fileHash: "apple-sha256",
                    },
                ],
            };
        },

        async fingerprintFile({ videoPath }) {
            fingerprintCount += 1;

            if (videoPath.toLowerCase().includes("orange")) {
                throw new Error("Simulated fingerprint failure");
            }

            if (videoPath.includes("apple")) {
                return {
                    fileHash: "apple-sha256",
                    fileSize: 1000,
                };
            }

            return {
                fileHash: "bicycle-sha256",
                fileSize: 2000,
            };
        },
    };

    const report = await PublishingPreflightService.build({
        projectRoot: "C:/test-project",

        queueBuilder: async ({ projectRoot }) => {
            assert.equal(
                projectRoot,
                path.resolve("C:/test-project")
            );

            return queue;
        },

        statusReader: async ({ word, platforms }) => {
            statusReadCount += 1;

            assert.deepEqual(platforms, platformNames);

            if (word === "Bicycle") {
                throw new Error(
                    "Simulated publication status read failure"
                );
            }

            return createTracking(word);
        },

        historyService,
    });

    assert.equal(report.schemaVersion, 1);
    assert.equal(report.status, "needs_attention");

    console.log("✅ Overall preflight status is calculated");

    assert.deepEqual(report.summary.packages, {
        scanned: 4,
        eligible: 3,
        excluded: 1,
    });

    console.log("✅ Package totals are calculated");

    assert.deepEqual(report.summary.platforms, {
        total: 9,
        published: 1,
        pending: 5,
        unknown: 3,
        progressPercent: 11,
    });

    console.log("✅ Platform publication statuses are counted");

    assert.deepEqual(report.summary.youtube, {
        applicable: 3,
        checked: 2,
        clear: 1,
        duplicates: 1,
        checkFailed: 1,
        historyAvailable: true,
    });

    console.log("✅ YouTube duplicate checks are summarized");

    assert.equal(historyLoadCount, 1);
    assert.equal(fingerprintCount, 3);
    assert.equal(statusReadCount, 3);

    console.log("✅ Upload history is loaded only once");

    // Apple має попереднє завантаження,
    // але статус YouTube-публікації залишається pending.
    const apple = report.items.find(
        (item) => item.word === "Apple"
    );

    assert.equal(
        apple.platforms.find(
            (platform) => platform.platform === "youtubeShorts"
        ).status,
        "pending"
    );

    assert.equal(apple.youtube.status, "duplicate");
    assert.equal(apple.youtube.duplicate, true);

    assert.equal(
        apple.youtube.previousUpload.videoId,
        "previous-apple-video"
    );

    console.log("✅ Previous private upload is not treated as published");

    // Bicycle: помилка читання статусів не зупинила перевірку.
    const bicycle = report.items.find(
        (item) => item.word === "Bicycle"
    );

    assert.ok(
        bicycle.platforms.every(
            (platform) => platform.status === "unknown"
        )
    );

    assert.equal(bicycle.youtube.status, "clear");

    assert.ok(
        bicycle.errors.some(
            (error) =>
                error.code === "publication_status_unavailable"
        )
    );

    console.log("✅ Publication status failure is isolated");

    // Orange: помилка fingerprint не вважається успішною перевіркою.
    const orange = report.items.find(
        (item) => item.word === "Orange"
    );

    assert.equal(orange.youtube.status, "check_failed");
    assert.equal(orange.youtube.duplicate, null);

    assert.ok(
        orange.errors.some(
            (error) =>
                error.code === "youtube_duplicate_check_failed"
        )
    );

    console.log("✅ Fingerprint failure is reported safely");

    assert.equal(report.excluded.length, 1);
    assert.equal(report.excluded[0].word, "Pear");

    console.log("✅ Excluded packages are preserved");

    assert.ok(!Number.isNaN(Date.parse(report.generatedAt)));

    console.log("✅ Report timestamp is valid");

    // Перевірка недоступної історії YouTube.
    const historyFailureReport =
        await PublishingPreflightService.build({
            projectRoot: "C:/test-project",

            queueBuilder: async () => ({
                summary: {
                    scanned: 1,
                },
                items: [
                    createQueueItem("Apple"),
                ],
                excluded: [],
            }),

            statusReader: async ({ word }) =>
                createTracking(word),

            historyService: {
                async load() {
                    throw new Error(
                        "Simulated history file failure"
                    );
                },

                async fingerprintFile() {
                    throw new Error(
                        "Fingerprint must not run when history is unavailable"
                    );
                },
            },
        });

    assert.equal(
        historyFailureReport.summary.youtube.historyAvailable,
        false
    );

    assert.equal(
        historyFailureReport.items[0].youtube.status,
        "check_failed"
    );

    assert.equal(
        historyFailureReport.summary.youtube.checkFailed,
        1
    );

    assert.ok(
        historyFailureReport.issues.some(
            (issue) =>
                issue.code === "youtube_history_unavailable"
        )
    );

    console.log("✅ Unavailable YouTube history blocks duplicate verification");

    // Порожня черга не повинна вимагати читання історії.
    let emptyHistoryLoadCount = 0;

    const emptyReport =
        await PublishingPreflightService.build({
            projectRoot: "C:/test-project",

            queueBuilder: async () => ({
                summary: {
                    scanned: 0,
                },
                items: [],
                excluded: [],
            }),

            historyService: {
                async load() {
                    emptyHistoryLoadCount += 1;

                    return {
                        schemaVersion: 1,
                        items: [],
                    };
                },

                async fingerprintFile() {
                    throw new Error(
                        "Fingerprint must not run for an empty queue"
                    );
                },
            },
        });

    assert.equal(emptyReport.status, "empty");
    assert.equal(emptyReport.summary.packages.eligible, 0);
    assert.equal(emptyHistoryLoadCount, 0);

    console.log("✅ Empty queue is handled without unnecessary history access");

    console.log(
        "\n✅ All PublishingPreflightService tests passed."
    );
}

runTests().catch((error) => {
    console.error(
        "\n❌ PublishingPreflightService tests failed."
    );

    console.error(error);
    process.exitCode = 1;
});
