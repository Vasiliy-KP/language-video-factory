
import {
    PublicationTrackingService,
} from "../services/PublicationTrackingService.js";

const ALLOWED_OPTIONS = [
    "word",
    "platform",
    "status",
    "url",
    "published-at",
];

function parseArguments(args) {
    const options = {};

    for (const arg of args) {
        if (!arg.startsWith("--")) {
            throw new Error(`Invalid argument: ${arg}`);
        }

        const separatorIndex = arg.indexOf("=");

        if (separatorIndex < 3) {
            throw new Error(
                `Use --name=value syntax: ${arg}`
            );
        }

        const name = arg.slice(2, separatorIndex);
        const value = arg.slice(separatorIndex + 1).trim();

        if (!ALLOWED_OPTIONS.includes(name)) {
            throw new Error(`Unknown option: --${name}`);
        }

        if (Object.hasOwn(options, name)) {
            throw new Error(`Duplicate option: --${name}`);
        }

        if (!value) {
            throw new Error(`Option --${name} cannot be empty.`);
        }

        options[name] = value;
    }

    for (const name of ["word", "platform", "status"]) {
        if (!options[name]) {
            throw new Error(`Missing required option: --${name}`);
        }
    }

    if (!["published", "pending"].includes(options.status)) {
        throw new Error(
            'Option --status must be "published" or "pending".'
        );
    }

    if (options.status === "published" && !options.url) {
        throw new Error(
            'Option --url is required when status is "published".'
        );
    }

    if (options["published-at"] && options.status !== "published") {
        throw new Error(
            "Option --published-at can only be used with published status."
        );
    }

    return options;
}

async function main() {
    const options = parseArguments(process.argv.slice(2));

    const result = await PublicationTrackingService.update({
        word: options.word,
        platform: options.platform,
        status: options.status,
        url: options.url,
        publishedAt: options["published-at"],
    });

    const platformStatus =
        result.platforms[options.platform];

    console.log("\n✅ Publication status updated");
    console.log(`Word: ${result.word}`);
    console.log(`Platform: ${options.platform}`);
    console.log(`Status: ${platformStatus.status}`);

    if (platformStatus.status === "published") {
        console.log(`Published at: ${platformStatus.publishedAt}`);
        console.log(`URL: ${platformStatus.url}`);
    }
}

main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
});
