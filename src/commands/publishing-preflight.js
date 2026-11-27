
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
    PublishingPreflightService,
} from "../services/PublishingPreflightService.js";

const PLATFORM_LABELS = {
    tiktok: "TikTok",
    instagram: "Instagram",
    youtubeShorts: "YouTube Shorts",
};

const STATUS_LABELS = {
    ready_for_review: "READY FOR REVIEW",
    needs_attention: "NEEDS ATTENTION",
    empty: "EMPTY",
};

const PLATFORM_STATUS_ICONS = {
    published: "✅",
    pending: "⏳",
    unknown: "⚠️",
};

export function parsePreflightArguments(args) {
    if (!Array.isArray(args)) {
        throw new Error("Command arguments must be an array.");
    }

    if (args.length > 0) {
        throw new Error(
            `This command does not accept arguments: ${args.join(", ")}`
        );
    }

    return {};
}

export function getPreflightExitCode(report) {
    return report?.status === "ready_for_review" ? 0 : 1;
}

export function printPreflightReport(report, logger = console) {
    const { summary } = report;

    logger.log("\n## Publishing preflight");
    logger.log(
        `Status: ${STATUS_LABELS[report.status] ?? report.status}`
    );
    logger.log(`Generated at: ${report.generatedAt}`);

    logger.log("\n## Package summary");
    logger.log(`Scanned: ${summary.packages.scanned}`);
    logger.log(`Eligible: ${summary.packages.eligible}`);
    logger.log(`Excluded: ${summary.packages.excluded}`);

    logger.log("\n## Publication progress");
    logger.log(`Total platform publications: ${summary.platforms.total}`);
    logger.log(`Published: ${summary.platforms.published}`);
    logger.log(`Pending: ${summary.platforms.pending}`);
    logger.log(`Unknown: ${summary.platforms.unknown}`);
    logger.log(`Progress: ${summary.platforms.progressPercent}%`);

    logger.log("\n## YouTube duplicate check");

    const historyStatus =
        summary.youtube.historyAvailable === true
            ? "available"
            : summary.youtube.historyAvailable === false
                ? "unavailable"
                : "not required";

    logger.log(`Upload history: ${historyStatus}`);
    logger.log(`Applicable packages: ${summary.youtube.applicable}`);
    logger.log(`Checked: ${summary.youtube.checked}`);
    logger.log(`No duplicate: ${summary.youtube.clear}`);
    logger.log(`Duplicates: ${summary.youtube.duplicates}`);
    logger.log(`Check failed: ${summary.youtube.checkFailed}`);

    if (report.items.length > 0) {
        logger.log("\n## Eligible packages");

        for (const item of report.items) {
            logger.log(`\n### ${item.word} — ${item.status}`);
            logger.log(`Video: ${item.videoPath}`);
            logger.log(`Metadata: ${item.metadataPath}`);

            logger.log("Platforms:");

            for (const platform of item.platforms) {
                const label =
                    PLATFORM_LABELS[platform.platform] ??
                    platform.platform;

                const icon =
                    PLATFORM_STATUS_ICONS[platform.status] ?? "⚠️";

                logger.log(
                    `  ${icon} ${label}: ${platform.status}`
                );

                if (platform.status === "published") {
                    logger.log(`     Published at: ${platform.publishedAt}`);
                    logger.log(`     URL: ${platform.url}`);
                }
            }

            logger.log(
                `YouTube duplicate check: ${item.youtube.status}`
            );

            if (item.youtube.previousUpload) {
                const previous = item.youtube.previousUpload;

                logger.log(`  Previous word: ${previous.word}`);
                logger.log(`  Previous title: ${previous.title}`);
                logger.log(`  Video ID: ${previous.videoId}`);
                logger.log(`  Privacy: ${previous.privacyStatus}`);
                logger.log(`  Uploaded: ${previous.uploadedAt}`);
                logger.log(`  URL: ${previous.url}`);
            }

            if (item.youtube.error) {
                logger.log(`  ⚠️ ${item.youtube.error}`);
            }

            for (const error of item.errors ?? []) {
                logger.log(`  ❌ ${error.code}: ${error.message}`);
            }
        }
    } else {
        logger.log("\nNo eligible packages.");
    }

    if (report.excluded.length > 0) {
        logger.log("\n## Excluded packages");

        for (const item of report.excluded) {
            logger.log(`\n⚠️ ${item.word} — ${item.status}`);
            logger.log(`Directory: ${item.packageDirectory}`);

            for (const error of item.errors ?? []) {
                logger.log(
                    `  ❌ ${error.code ?? "error"}: ${error.message ?? "Unknown error"}`
                );
            }

            for (const error of item.contentErrors ?? []) {
                logger.log(
                    `  ❌ Content: ${error.code ?? "error"}: ${error.message ?? "Unknown error"}`
                );
            }

            for (const error of item.platformErrors ?? []) {
                logger.log(
                    `  ❌ ${error.platform}: ${error.code ?? "error"}: ${error.message ?? "Unknown error"}`
                );
            }
        }
    }

    if (report.issues.length > 0) {
        logger.log("\n## Preflight issues");

        for (const issue of report.issues) {
            const word = issue.word ? ` [${issue.word}]` : "";

            logger.log(
                `  ❌ ${issue.code}${word}: ${issue.message}`
            );
        }
    }

    logger.log("\n## Result");

    if (report.status === "ready_for_review") {
        logger.log(
            "✅ Preflight passed. Packages are ready for manual review."
        );
    } else if (report.status === "empty") {
        logger.log("⚠️ No publishing packages were found.");
    } else {
        logger.log(
            "⚠️ Preflight requires attention. Review the errors above."
        );
    }

    logger.log(
        "ℹ️ No videos were uploaded and no publication statuses were changed."
    );
}

export async function runPublishingPreflightCommand({
    args = process.argv.slice(2),
    preflightService = PublishingPreflightService,
    logger = console,
} = {}) {
    parsePreflightArguments(args);

    const report = await preflightService.build();

    printPreflightReport(report, logger);

    return report;
}

const currentFile = fileURLToPath(import.meta.url);

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === currentFile
) {
    runPublishingPreflightCommand()
        .then((report) => {
            process.exitCode = getPreflightExitCode(report);
        })
        .catch((error) => {
            console.error(
                `\n❌ Publishing preflight failed: ${error.message}`
            );

            process.exitCode = 1;
        });
}
