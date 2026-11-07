
import "dotenv/config";

import {
    YouTubeVideoStatusService,
} from "../services/YouTubeVideoStatusService.js";

function parseArguments(args) {
    const options = {};

    for (const arg of args) {
        if (!arg.startsWith("--video-id=")) {
            throw new Error(
                `Unknown argument: ${arg}. Expected --video-id=VIDEO_ID`
            );
        }

        if (Object.hasOwn(options, "videoId")) {
            throw new Error(
                "Option --video-id can only be provided once."
            );
        }

        options.videoId = arg
            .slice("--video-id=".length)
            .trim();
    }

    if (!options.videoId) {
        throw new Error(
            "Video ID is required. Example: npm run youtube:status -- --video-id=Yf0n9TZmZe4"
        );
    }

    return options;
}

function formatDuration(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        return "Unknown";
    }

    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
        return `${seconds} sec`;
    }

    return `${minutes} min ${seconds} sec`;
}

function printStatus(status) {
    console.log("\n## YouTube video status");

    console.log(`Video ID: ${status.videoId}`);
    console.log(`Title: ${status.title ?? "Unavailable"}`);
    console.log(`URL: ${status.url}`);

    console.log("\n## Upload");
    console.log(`Upload status: ${status.uploadStatus}`);

    console.log("\n## Processing");

    switch (status.processingStatus) {
        case "processing":
            console.log("Status: ⏳ Processing");
            break;

        case "succeeded":
            console.log("Status: ✅ Processing completed");
            break;

        case "failed":
            console.log("Status: ❌ Processing failed");
            break;

        case "terminated":
            console.log("Status: ⚠️ Processing information unavailable");
            break;

        default:
            console.log("Status: Unknown");
    }

    if (status.processingProgress) {
        const progress = status.processingProgress;

        console.log(`Progress: ${progress.percent}%`);
        console.log(
            `Parts: ${progress.partsProcessed}/${progress.partsTotal}`
        );

        if (progress.timeLeftMs !== null) {
            console.log(
                `Estimated time left: ${formatDuration(progress.timeLeftMs)}`
            );
        }
    }

    if (status.processingFailureReason) {
        console.log(
            `Processing failure: ${status.processingFailureReason}`
        );
    }

    if (status.failureReason) {
        console.log(`Upload failure: ${status.failureReason}`);
    }

    if (status.rejectionReason) {
        console.log(`Rejection reason: ${status.rejectionReason}`);
    }

    console.log("\n## Privacy");
    console.log(`Privacy status: ${status.privacyStatus}`);

    if (status.isProcessingComplete) {
        console.log("\n✅ Video processing completed successfully.");
    } else if (status.processingStatus === "failed") {
        console.log("\n❌ YouTube could not process this video.");
    } else if (status.processingStatus === "processing") {
        console.log("\n⏳ YouTube is still processing this video.");
    } else {
        console.log("\n⚠️ Processing completion is not confirmed.");
    }

    console.log(
        "\nNo video settings or publication statuses were changed."
    );
}

async function main() {
    const options = parseArguments(process.argv.slice(2));

    console.log("\nChecking YouTube video...");
    console.log(`Video ID: ${options.videoId}`);

    const status = await YouTubeVideoStatusService.getStatus({
        videoId: options.videoId,
    });

    printStatus(status);
}

main().catch((error) => {
    console.error(`\n❌ YouTube status check failed: ${error.message}`);
    process.exitCode = 1;
});
