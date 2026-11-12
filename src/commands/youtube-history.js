
import process from "node:process";

import {
    YouTubeUploadHistoryService,
} from "../services/YouTubeUploadHistoryService.js";

function parseArguments(args) {
    const limitArguments = args.filter(
        (arg) => arg.startsWith("--limit=")
    );

    const unknownArguments = args.filter(
        (arg) => !arg.startsWith("--limit=")
    );

    if (unknownArguments.length > 0) {
        throw new Error(
            `Unknown arguments: ${unknownArguments.join(", ")}`
        );
    }

    if (limitArguments.length > 1) {
        throw new Error("--limit cannot be specified more than once.");
    }

    if (limitArguments.length === 0) {
        return {};
    }

    const rawLimit = limitArguments[0].slice("--limit=".length);

    if (!/^[1-9]\d*$/.test(rawLimit)) {
        throw new Error(
            "History limit must be a positive integer."
        );
    }

    const limit = Number(rawLimit);

    if (!Number.isSafeInteger(limit)) {
        throw new Error(
            "History limit exceeds the supported integer range."
        );
    }

    return { limit };
}

async function main() {
    const { limit } = parseArguments(
        process.argv.slice(2)
    );

    const items = await YouTubeUploadHistoryService.list({
        limit,
    });

    console.log("\n## YouTube upload history");

    if (items.length === 0) {
        console.log("\nNo YouTube uploads found.");
        return;
    }

    items.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.word}`);
        console.log(`   Title: ${item.title}`);
        console.log(`   Video ID: ${item.videoId}`);
        console.log(`   URL: ${item.url}`);
        console.log(
            `   Privacy: ${item.privacyStatus.toUpperCase()}`
        );
        console.log(`   Status: ${item.uploadStatus}`);
        console.log(`   Uploaded: ${item.uploadedAt}`);
    });

    console.log(`\nTotal uploads shown: ${items.length}`);

    if (limit !== undefined) {
        console.log(`History limit: ${limit}`);
    }
}

main().catch((error) => {
    console.error(
        `\n❌ YouTube history command failed: ${error.message}`
    );

    process.exitCode = 1;
});
