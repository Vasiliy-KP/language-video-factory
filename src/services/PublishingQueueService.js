import {
    mkdir,
    readdir,
    writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
    PublishingReadinessService,
} from "./PublishingReadinessService.js";

export class PublishingQueueService {
    static async build({
        projectRoot = process.cwd(),
        publishingDirectory = "output/publishing",
        queueFile = "output/publishing/queue.json",
        readinessCheck = PublishingReadinessService.check,
    } = {}) {
        const root = path.resolve(projectRoot);
        const publishingRoot = path.resolve(
            root,
            publishingDirectory
        );
        const queuePath = path.resolve(root, queueFile);

        const normalizePath = (filePath) =>
            filePath
                .split(path.sep)
                .join("/");

        await mkdir(publishingRoot, {
            recursive: true,
        });

        const entries = await readdir(
            publishingRoot,
            { withFileTypes: true }
        );

        const packageDirectories = entries.filter(
            (entry) => entry.isDirectory()
        );

        const items = [];
        const excluded = [];

        for (const entry of packageDirectories) {
            const packagePath = path.join(
                publishingRoot,
                entry.name
            );

            const relativePackagePath = normalizePath(
                path.relative(root, packagePath)
            );

            try {
                // Перевіряємо пакет заново, щоб не покладатися
                // на застарілий readiness.json.
                const report = await readinessCheck(
                    packagePath,
                    { projectRoot: root }
                );

                const platformEntries = Object.entries(
                    report.platforms ?? {}
                );

                const allPlatformsReady =
                    platformEntries.length > 0 &&
                    platformEntries.every(
                        ([, platform]) =>
                            platform.status === "ready_for_review"
                    );

                const isEligible =
                    report.status === "ready_for_review" &&
                    (report.errors ?? []).length === 0 &&
                    allPlatformsReady &&
                    report.checks?.video?.exists === true &&
                    report.checks?.metadata?.validJson === true;

                if (!isEligible) {
                    const platformErrors = platformEntries
                        .flatMap(([platform, result]) =>
                            (result.errors ?? []).map((error) => ({
                                platform,
                                code: error.code,
                                message: error.message,
                            }))
                        );

                    excluded.push({
                        word: report.word ?? entry.name,
                        packageDirectory: relativePackagePath,
                        status: report.status ?? "unknown",
                        errors: report.errors ?? [],
                        platformErrors,
                    });

                    continue;
                }

                items.push({
                    word: report.word,
                    status: "ready_for_review",
                    packageDirectory: relativePackagePath,
                    readinessPath: normalizePath(
                        path.relative(
                            root,
                            path.join(packagePath, "readiness.json")
                        )
                    ),
                    videoPath: report.checks.video.path,
                    metadataPath: report.checks.metadata.path,
                    platforms: platformEntries.map(
                        ([platform]) => platform
                    ),
                });
            } catch (error) {
                // Збій одного пакета не повинен зупиняти
                // перевірку інших.
                excluded.push({
                    word: entry.name,
                    packageDirectory: relativePackagePath,
                    status: "check_failed",
                    errors: [
                        {
                            message: error.message,
                        },
                    ],
                    platformErrors: [],
                });
            }
        }

        const queue = {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            status: items.length > 0
                ? "ready_for_review"
                : "empty",
            summary: {
                scanned: packageDirectories.length,
                eligible: items.length,
                excluded: excluded.length,
            },
            items,
            excluded,
        };

        await mkdir(path.dirname(queuePath), {
            recursive: true,
        });

        await writeFile(
            queuePath,
            `${JSON.stringify(queue, null, 2)}\n`,
            "utf8"
        );

        console.log(
            `Publishing queue saved: ${path.relative(root, queuePath)}`
        );

        console.log(
            `Scanned: ${queue.summary.scanned} | ` +
            `Eligible: ${queue.summary.eligible} | ` +
            `Excluded: ${queue.summary.excluded}`
        );

        return queue;
    }
}