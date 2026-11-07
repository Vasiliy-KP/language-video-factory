
import "dotenv/config";

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import process from "node:process";

import {
    PublishingQueueService,
} from "../services/PublishingQueueService.js";

import {
    YouTubeUploadService,
} from "../services/YouTubeUploadService.js";

async function main() {
    const args = process.argv.slice(2);

    const wordArgument = args.find(
        (arg) => arg.startsWith("--word=")
    );

    const unknownArguments = args.filter(
        (arg) => !arg.startsWith("--word=")
    );

    if (unknownArguments.length > 0) {
        throw new Error(
            `Unknown arguments: ${unknownArguments.join(", ")}`
        );
    }

    if (!wordArgument) {
        throw new Error(
            "Word is required. Example: npm run youtube:upload -- --word=Apple"
        );
    }

    const word = wordArgument.slice("--word=".length).trim();

    if (!word) {
        throw new Error("Word cannot be empty.");
    }

    console.log("\n## YouTube video upload");
    console.log(`Searching for: ${word}`);

    const queue = await PublishingQueueService.build();

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

    const metadata = JSON.parse(
        await readFile(item.metadataPath, "utf8")
    );

    const platformMetadata =
        metadata.platforms?.youtubeShorts;

    if (!platformMetadata) {
        throw new Error(
            "YouTube Shorts metadata is missing."
        );
    }

    console.log("\n## Upload preview");
    console.log(`Word: ${item.word}`);
    console.log(`Video: ${item.videoPath}`);
    console.log(`Title: ${platformMetadata.title}`);
    console.log("\nDescription:");
    console.log(platformMetadata.description);
    console.log(
        `\nHashtags: ${(platformMetadata.hashtags ?? []).join(" ")}`
    );

    console.log("\n## Upload settings");
    console.log("Platform: YouTube Shorts");
    console.log("Privacy: PRIVATE");
    console.log("Notify subscribers: NO");

    console.log(
        "\nThe video will be uploaded privately and will not be publicly available."
    );

    const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    let confirmation;

    try {
        confirmation = await readline.question(
            '\nType UPLOAD to confirm, or press Enter to cancel: '
        );
    } finally {
        readline.close();
    }

    if (confirmation.trim() !== "UPLOAD") {
        console.log("\nUpload cancelled.");
        return;
    }

    console.log("\n▶ Uploading video to YouTube...");

    let lastProgress = -1;

    const result = await YouTubeUploadService.upload({
        videoPath: item.videoPath,
        metadata,
        privacyStatus: "private",
        notifySubscribers: false,
        onProgress: ({ percent }) => {
            if (percent !== lastProgress) {
                lastProgress = percent;
                console.log(`Upload progress: ${percent}%`);
            }
        },
    });

    console.log("\n✅ Video uploaded to YouTube.");
    console.log(`Video ID: ${result.id}`);
    console.log(`Video URL: ${result.url}`);
    console.log(`Privacy: ${result.privacyStatus}`);
    console.log(`Upload status: ${result.uploadStatus}`);

    console.log(
        "\n⚠️ The video is private. It has not been publicly published."
    );

    console.log(
        "Check video processing in YouTube Studio before proceeding."
    );

    console.log(
        "Publication status was not changed."
    );
}

main().catch((error) => {
    console.error(`\n❌ YouTube upload failed: ${error.message}`);
    process.exitCode = 1;
});
