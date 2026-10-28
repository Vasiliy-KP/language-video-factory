import {
    PublishingQueueService,
} from "./PublishingQueueService.js";

import {
    PublicationTrackingService,
} from "./PublicationTrackingService.js";

export class PublicationReportService {
    static async build({
        queueBuilder = () => PublishingQueueService.build(),
        statusReader = (options) =>
            PublicationTrackingService.getForWord(options),
    } = {}) {
        const queue = await queueBuilder();

        const items = [];

        let totalPlatforms = 0;
        let published = 0;
        let pending = 0;

        for (const queueItem of queue.items ?? []) {
            const tracking = await statusReader({
                word: queueItem.word,
                platforms: queueItem.platforms,
            });

            const platforms = queueItem.platforms.map((platform) => {
                const savedStatus = tracking.platforms?.[platform];
                const status =
                    savedStatus?.status === "published"
                        ? "published"
                        : "pending";

                return {
                    platform,
                    status,
                    publishedAt:
                        status === "published"
                            ? savedStatus.publishedAt
                            : null,
                    url:
                        status === "published"
                            ? savedStatus.url
                            : null,
                };
            });

            const itemPublished = platforms.filter(
                (platform) => platform.status === "published"
            ).length;

            const itemPending = platforms.length - itemPublished;
            const itemTotal = platforms.length;

            totalPlatforms += itemTotal;
            published += itemPublished;
            pending += itemPending;

            items.push({
                word: queueItem.word,
                platforms,
                summary: {
                    total: itemTotal,
                    published: itemPublished,
                    pending: itemPending,
                    progressPercent:
                        itemTotal === 0
                            ? 0
                            : Math.round(
                                (itemPublished / itemTotal) * 100
                            ),
                },
            });
        }

        return {
            generatedAt: new Date().toISOString(),
            summary: {
                words: items.length,
                totalPlatforms,
                published,
                pending,
                progressPercent:
                    totalPlatforms === 0
                        ? 0
                        : Math.round(
                            (published / totalPlatforms) * 100
                        ),
                excludedPackages: (queue.excluded ?? []).length,
            },
            items,
            excluded: queue.excluded ?? [],
        };
    }
}