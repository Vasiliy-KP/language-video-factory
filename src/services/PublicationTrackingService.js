
import {
    mkdir,
    readFile,
    writeFile,
} from "node:fs/promises";
import path from "node:path";

const SCHEMA_VERSION = 1;

const SUPPORTED_PLATFORMS = [
    "tiktok",
    "instagram",
    "youtubeShorts",
];

const SUPPORTED_STATUSES = [
    "pending",
    "published",
];

function createPendingStatus() {
    return {
        status: "pending",
        publishedAt: null,
        url: null,
    };
}

function validateWord(word) {
    if (typeof word !== "string" || !word.trim()) {
        throw new Error(
            "Publication tracking requires a non-empty word."
        );
    }

    return word.trim();
}

function validatePlatform(platform) {
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
        throw new Error(
            `Unsupported publication platform: ${platform}`
        );
    }
}

function validateUrl(url) {
    if (typeof url !== "string" || !url.trim()) {
        throw new Error(
            "A URL is required when marking a video as published."
        );
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error("Published video URL is invalid.");
    }

    if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
    ) {
        throw new Error(
            "Published video URL must use HTTP or HTTPS."
        );
    }

    return parsedUrl.toString();
}

export class PublicationTrackingService {
    static async load({
        projectRoot = process.cwd(),
        statusFile = "output/publishing/publication-status.json",
    } = {}) {
        const filePath = path.resolve(projectRoot, statusFile);

        let contents;

        try {
            contents = await readFile(filePath, "utf8");
        } catch (error) {
            if (error.code === "ENOENT") {
                return {
                    schemaVersion: SCHEMA_VERSION,
                    items: {},
                };
            }

            throw error;
        }

        let data;

        try {
            data = JSON.parse(contents);
        } catch {
            throw new Error(
                `Publication status file contains invalid JSON: ${filePath}`
            );
        }

        if (
            data?.schemaVersion !== SCHEMA_VERSION ||
            data.items === null ||
            typeof data.items !== "object" ||
            Array.isArray(data.items)
        ) {
            throw new Error(
                `Publication status file has an unsupported structure: ${filePath}`
            );
        }

        return data;
    }

    static async getForWord({
        word,
        platforms = SUPPORTED_PLATFORMS,
        projectRoot = process.cwd(),
        statusFile = "output/publishing/publication-status.json",
    } = {}) {
        const normalizedWord = validateWord(word);

        const data = await this.load({
            projectRoot,
            statusFile,
        });

        const savedWord = data.items[normalizedWord] ?? {};
        const result = {};

        for (const platform of platforms) {
            validatePlatform(platform);

            const savedStatus = savedWord[platform];

            if (
                savedStatus?.status === "published" &&
                typeof savedStatus.publishedAt === "string" &&
                typeof savedStatus.url === "string"
            ) {
                result[platform] = {
                    status: "published",
                    publishedAt: savedStatus.publishedAt,
                    url: savedStatus.url,
                };
            } else {
                result[platform] = createPendingStatus();
            }
        }

        return {
            word: normalizedWord,
            platforms: result,
        };
    }

    static async update({
        word,
        platform,
        status,
        publishedAt,
        url,
        projectRoot = process.cwd(),
        statusFile = "output/publishing/publication-status.json",
    } = {}) {
        const normalizedWord = validateWord(word);

        validatePlatform(platform);

        if (!SUPPORTED_STATUSES.includes(status)) {
            throw new Error(
                `Unsupported publication status: ${status}`
            );
        }

        let platformStatus;

        if (status === "published") {
            const date = publishedAt ?? new Date().toISOString();

            if (
                typeof date !== "string" ||
                Number.isNaN(Date.parse(date))
            ) {
                throw new Error(
                    "Published date must be a valid date string."
                );
            }

            platformStatus = {
                status: "published",
                publishedAt: new Date(date).toISOString(),
                url: validateUrl(url),
            };
        } else {
            platformStatus = createPendingStatus();
        }

        const data = await this.load({
            projectRoot,
            statusFile,
        });

        if (
            data.items[normalizedWord] === null ||
            typeof data.items[normalizedWord] !== "object" ||
            Array.isArray(data.items[normalizedWord])
        ) {
            data.items[normalizedWord] = {};
        }

        data.items[normalizedWord][platform] = platformStatus;

        const filePath = path.resolve(projectRoot, statusFile);

        await mkdir(path.dirname(filePath), {
            recursive: true,
        });

        await writeFile(
            filePath,
            `${JSON.stringify(data, null, 2)}\n`,
            "utf8"
        );

        return this.getForWord({
            word: normalizedWord,
            platforms: [platform],
            projectRoot,
            statusFile,
        });
    }
}
