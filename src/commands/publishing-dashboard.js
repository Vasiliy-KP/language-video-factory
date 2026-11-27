
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
    PublishingDashboardService,
} from "../services/PublishingDashboardService.js";

export function parseDashboardArguments(args) {
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

export async function runPublishingDashboardCommand({
    args = process.argv.slice(2),
    dashboardService = PublishingDashboardService,
    logger = console,
} = {}) {
    parseDashboardArguments(args);

    logger.log("\n## Publishing Dashboard");
    logger.log("Generating the latest publishing report...");

    const result = await dashboardService.generate();

    const report = result.report;

    logger.log("\n✅ Publishing Dashboard generated.");
    logger.log(`File: ${result.relativePath}`);
    logger.log(`Size: ${result.sizeBytes} bytes`);
    logger.log(`Status: ${report.status}`);
    logger.log(`Packages scanned: ${report.summary.packages.scanned}`);
    logger.log(`Ready for review: ${report.summary.packages.eligible}`);
    logger.log(`Excluded: ${report.summary.packages.excluded}`);
    logger.log(
        `Platform publications: ${report.summary.platforms.published} / ` +
        `${report.summary.platforms.total} published`
    );
    logger.log(
        `YouTube duplicates: ${report.summary.youtube.duplicates}`
    );

    logger.log("\nOpen the dashboard in your browser:");
    logger.log(result.outputPath);

    logger.log(
        "\nℹ️ The dashboard was generated locally. No videos were uploaded and no publication statuses were changed."
    );

    return result;
}

const currentFile = fileURLToPath(import.meta.url);

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === currentFile
) {
    runPublishingDashboardCommand().catch((error) => {
        console.error(
            `\n❌ Publishing Dashboard generation failed: ${error.message}`
        );

        process.exitCode = 1;
    });
}
