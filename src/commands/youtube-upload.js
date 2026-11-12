
import "dotenv/config";

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    PublishingQueueService,
} from "../services/PublishingQueueService.js";

import {
    YouTubeUploadService,
} from "../services/YouTubeUploadService.js";

import {
    YouTubeUploadHistoryService,
} from "../services/YouTubeUploadHistoryService.js";

export function parseUploadArguments(args) {
    const wordArguments = args.filter(
        (arg) => arg.startsWith("--word=")
    );

    const forceArguments = args.filter(
        (arg) => arg === "--force"
    );

    const unknownArguments = args.filter(
        (arg) =>
            !arg.startsWith("--word=") &&
            arg !== "--force"
    );

    if (unknownArguments.length > 0) {
        throw new Error(
            `Unknown arguments: ${unknownArguments.join(", ")}`
        );
    }

    if (wordArguments.length !== 1) {
        throw new Error(
            "Exactly one word is required. " +
            "Example: npm run youtube:upload -- --word=Apple"
        );
    }

    if (forceArguments.length > 1) {
        throw new Error(
            "--force cannot be specified more than once."
        );
    }

    const word = wordArguments[0]
        .slice("--word=".length)
        .trim();

    if (!word) {
        throw new Error("Word cannot be empty.");
    }

    return {
        word,
        force: forceArguments.length === 1,
    };
}

async function askForUploadConfirmation() {
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        return await readline.question(
            '\nType UPLOAD to confirm, or press Enter to cancel: '
        );
    } finally {
        readline.close();
    }
}

export async function runYouTubeUploadCommand({
    args = process.argv.slice(2),
    queueService = PublishingQueueService,
    uploadService = YouTubeUploadService,
    historyService = YouTubeUploadHistoryService,
    readMetadata = async (metadataPath) => JSON.parse(
        await readFile(metadataPath, "utf8")
    ),
    confirmUpload = askForUploadConfirmation,
    logger = console,
} = {}) {
    const { word, force } = parseUploadArguments(args);

    logger.log("\n## YouTube video upload");
    logger.log(`Searching for: ${word}`);

    const queue = await queueService.build();

    const item = queue.items.find(
        (entry) =>
            entry.word.toLowerCase() === word.toLowerCase()
    );

    if (!item) {
        throw new Error(
            `No eligible publishing package found for "${word}".`
        );
    }

    if (!item.platforms.includes("youtubeShorts")) {
        throw new Error(
            `YouTube Shorts is not ready for "${word}".`
        );
    }

    const metadata = await readMetadata(item.metadataPath);

    const platformMetadata =
        metadata.platforms?.youtubeShorts;

    if (!platformMetadata) {
        throw new Error(
            "YouTube Shorts metadata is missing."
        );
    }

    // Calculate SHA-256 before attempting an upload.
    const fingerprint = await historyService.fingerprintFile({
        videoPath: item.videoPath,
    });

    // Check upload history before showing the confirmation prompt.
    const duplicate = await historyService.findDuplicate({
        fileHash: fingerprint.fileHash,
    });

    if (duplicate) {
        logger.log("\n## Duplicate detection");
        logger.log(
            "⚠️ An identical video was uploaded before."
        );
        logger.log(`Previous word: ${duplicate.word}`);
        logger.log(`Previous Video ID: ${duplicate.videoId}`);
        logger.log(`Previous upload date: ${duplicate.uploadedAt}`);

        if (!force) {
            throw new Error(
                "Duplicate upload blocked. " +
                "Use --force to intentionally upload this video again."
            );
        }

        logger.log(
            "\n⚠️ --force is enabled. Duplicate protection is bypassed."
        );
    }

    logger.log("\n## Upload preview");
    logger.log(`Word: ${item.word}`);
    logger.log(`Video: ${item.videoPath}`);
    logger.log(`Title: ${platformMetadata.title}`);
    logger.log("\nDescription:");
    logger.log(platformMetadata.description);
    logger.log(
        `\nHashtags: ${(platformMetadata.hashtags ?? []).join(" ")}`
    );

    logger.log("\n## Upload settings");
    logger.log("Platform: YouTube Shorts");
    logger.log("Privacy: PRIVATE");
    logger.log("Notify subscribers: NO");

    logger.log(
        "\nThe video will be uploaded privately and will not be publicly available."
    );

    const confirmation = await confirmUpload();

    if (
        typeof confirmation !== "string" ||
        confirmation.trim() !== "UPLOAD"
    ) {
        logger.log("\nUpload cancelled.");

        return {
            cancelled: true,
        };
    }

    logger.log("\n▶ Uploading video to YouTube...");

    let lastProgress = -1;

    const result = await uploadService.upload({
        videoPath: item.videoPath,
        metadata,
        privacyStatus: "private",
        notifySubscribers: false,
        onProgress: ({ percent }) => {
            if (percent !== lastProgress) {
                lastProgress = percent;
                logger.log(`Upload progress: ${percent}%`);
            }
        },
    });

    logger.log("\n✅ Video uploaded to YouTube.");
    logger.log(`Video ID: ${result.id}`);
    logger.log(`Video URL: ${result.url}`);
    logger.log(`Privacy: ${result.privacyStatus}`);
    logger.log(`Upload status: ${result.uploadStatus}`);

    // Record history only after YouTube confirms successful upload.
    try {
        const historyRecord = await historyService.recordUpload({
            word: item.word,
            title: result.title ?? platformMetadata.title,
            videoId: result.id,
            url: result.url,
            videoPath: item.videoPath,
            fileHash: fingerprint.fileHash,
            privacyStatus: result.privacyStatus ?? "private",
            uploadStatus: result.uploadStatus ?? "uploaded",
        });

        logger.log("\n✅ YouTube upload history updated.");
        logger.log(`History word: ${historyRecord.word}`);
        logger.log(`SHA-256: ${historyRecord.fileHash}`);
    } catch (error) {
        throw new Error(
            `Video was uploaded successfully (ID: ${result.id}), ` +
            `but upload history could not be saved: ${error.message}`,
            { cause: error }
        );
    }

    logger.log(
        "\n⚠️ The video is private. It has not been publicly published."
    );

    logger.log(
        "Check video processing in YouTube Studio before proceeding."
    );

    logger.log(
        "Publication status was not changed."
    );

    return {
        cancelled: false,
        result,
    };
}

const currentFile = fileURLToPath(import.meta.url);

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === currentFile
) {
    runYouTubeUploadCommand().catch((error) => {
        console.error(
            `\n❌ YouTube upload command failed: ${error.message}`
        );

        process.exitCode = 1;
    });
}
