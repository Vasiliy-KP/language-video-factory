
import path from "node:path";
import {
    PublishingQueueService,
} from "./PublishingQueueService.js";

import {
    PublicationTrackingService,
} from "./PublicationTrackingService.js";

import {
    YouTubeUploadHistoryService,
} from "./YouTubeUploadHistoryService.js";

const DEFAULT_STATUS_FILE =
    "output/publishing/publication-status.json";

const DEFAULT_HISTORY_FILE =
    "output/publishing/youtube-upload-history.json";

function getErrorMessage(error) {
    return error instanceof Error
        ? error.message
        : String(error);
}

function createIssue(code, message, word = null) {
    return {
        severity: "error",
        code,
        word,
        message,
    };
}

export class PublishingPreflightService {
    static async build({
        projectRoot = process.cwd(),
        statusFile = DEFAULT_STATUS_FILE,
        historyFile = DEFAULT_HISTORY_FILE,
        queueBuilder = (options) =>
            PublishingQueueService.build(options),
        statusReader = (options) =>
            PublicationTrackingService.getForWord(options),
        historyService = YouTubeUploadHistoryService,
    } = {}) {
        const root = path.resolve(projectRoot);

        const queue = await queueBuilder({
            projectRoot: root,
        });

        const queueItems = Array.isArray(queue.items)
            ? queue.items
            : [];

        const excluded = Array.isArray(queue.excluded)
            ? queue.excluded
            : [];

        const issues = [];

        const platformSummary = {
            total: 0,
            published: 0,
            pending: 0,
            unknown: 0,
        };

        const youtubeSummary = {
            applicable: 0,
            checked: 0,
            clear: 0,
            duplicates: 0,
            checkFailed: 0,
            historyAvailable: null,
        };

        const hasYouTubePackages = queueItems.some(
            (item) =>
                Array.isArray(item.platforms) &&
                item.platforms.includes("youtubeShorts")
        );

        let historyItems = [];
        let historyError = null;

        // Історію завантажень читаємо один раз,
        // а не повторно для кожного publishing package.
        if (hasYouTubePackages) {
            try {
                const history = await historyService.load({
                    projectRoot: root,
                    historyFile,
                });

                historyItems = history.items;
                youtubeSummary.historyAvailable = true;
            } catch (error) {
                historyError = getErrorMessage(error);
                youtubeSummary.historyAvailable = false;

                issues.push(
                    createIssue(
                        "youtube_history_unavailable",
                        `Could not read YouTube upload history: ${historyError}`
                    )
                );
            }
        }

        const items = [];

        for (const queueItem of queueItems) {
            const platforms = Array.isArray(queueItem.platforms)
                ? queueItem.platforms
                : [];

            const itemErrors = [];

            // 1. Перевіряємо фактичні статуси публікацій.
            let tracking = null;

            try {
                tracking = await statusReader({
                    word: queueItem.word,
                    platforms,
                    projectRoot: root,
                    statusFile,
                });
            } catch (error) {
                const issue = createIssue(
                    "publication_status_unavailable",
                    `Could not read publication statuses: ${getErrorMessage(error)}`,
                    queueItem.word
                );

                issues.push(issue);
                itemErrors.push(issue);
            }

            const platformResults = platforms.map((platform) => {
                platformSummary.total += 1;

                const savedStatus =
                    tracking?.platforms?.[platform]?.status;

                let status;

                if (savedStatus === "published") {
                    status = "published";
                    platformSummary.published += 1;
                } else if (savedStatus === "pending") {
                    status = "pending";
                    platformSummary.pending += 1;
                } else {
                    status = "unknown";
                    platformSummary.unknown += 1;

                    // Коли весь файл статусів не читається,
                    // відповідна помилка вже додана вище.
                    if (!tracking) {
                        return {
                            platform,
                            status,
                            publishedAt: null,
                            url: null,
                        };
                    }

                    const issue = createIssue(
                        "publication_status_missing",
                        `Publication status for ${platform} is unavailable.`,
                        queueItem.word
                    );

                    issues.push(issue);
                    itemErrors.push(issue);
                }

                const savedPlatform =
                    tracking?.platforms?.[platform];

                return {
                    platform,
                    status,
                    publishedAt:
                        status === "published"
                            ? savedPlatform.publishedAt
                            : null,
                    url:
                        status === "published"
                            ? savedPlatform.url
                            : null,
                };
            });

            // 2. Перевіряємо YouTube-дублікати за SHA-256.
            let youtube = {
                status: "not_applicable",
                duplicate: false,
                previousUpload: null,
                error: null,
            };

            if (platforms.includes("youtubeShorts")) {
                youtubeSummary.applicable += 1;

                if (historyError) {
                    youtube = {
                        status: "check_failed",
                        duplicate: null,
                        previousUpload: null,
                        error: historyError,
                    };

                    youtubeSummary.checkFailed += 1;

                    itemErrors.push(
                        createIssue(
                            "youtube_duplicate_check_failed",
                            "Duplicate check skipped because upload history is unavailable.",
                            queueItem.word
                        )
                    );
                } else {
                    try {
                        const fingerprint =
                            await historyService.fingerprintFile({
                                videoPath: queueItem.videoPath,
                                projectRoot: root,
                            });

                        // Шукаємо останній запис із таким самим SHA-256.
                        const duplicate = [...historyItems]
                            .reverse()
                            .find(
                                (record) =>
                                    record.fileHash === fingerprint.fileHash
                            );

                        youtubeSummary.checked += 1;

                        if (duplicate) {
                            youtubeSummary.duplicates += 1;

                            youtube = {
                                status: "duplicate",
                                duplicate: true,
                                previousUpload: {
                                    word: duplicate.word,
                                    title: duplicate.title,
                                    videoId: duplicate.videoId,
                                    url: duplicate.url,
                                    uploadedAt: duplicate.uploadedAt,
                                    privacyStatus: duplicate.privacyStatus,
                                },
                                error: null,
                            };
                        } else {
                            youtubeSummary.clear += 1;

                            youtube = {
                                status: "clear",
                                duplicate: false,
                                previousUpload: null,
                                error: null,
                            };
                        }
                    } catch (error) {
                        const message = getErrorMessage(error);

                        youtube = {
                            status: "check_failed",
                            duplicate: null,
                            previousUpload: null,
                            error: message,
                        };

                        youtubeSummary.checkFailed += 1;

                        const issue = createIssue(
                            "youtube_duplicate_check_failed",
                            `Could not verify YouTube duplicate status: ${message}`,
                            queueItem.word
                        );

                        issues.push(issue);
                        itemErrors.push(issue);
                    }
                }
            }

            items.push({
                word: queueItem.word,
                status: queueItem.status,
                packageDirectory: queueItem.packageDirectory,
                videoPath: queueItem.videoPath,
                metadataPath: queueItem.metadataPath,
                platforms: platformResults,
                youtube,
                errors: itemErrors,
            });
        }

        const scanned =
            queue.summary?.scanned ??
            queueItems.length + excluded.length;

        const hasAttention =
            excluded.length > 0 ||
            issues.length > 0 ||
            youtubeSummary.duplicates > 0;

        let status;

        if (scanned === 0) {
            status = "empty";
        } else if (hasAttention) {
            status = "needs_attention";
        } else {
            status = "ready_for_review";
        }

        return {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            status,
            summary: {
                packages: {
                    scanned,
                    eligible: queueItems.length,
                    excluded: excluded.length,
                },
                platforms: {
                    ...platformSummary,
                    progressPercent:
                        platformSummary.total === 0
                            ? 0
                            : Math.round(
                                (platformSummary.published /
                                    platformSummary.total) * 100
                            ),
                },
                youtube: youtubeSummary,
            },
            items,
            excluded,
            issues,
        };
    }
}
