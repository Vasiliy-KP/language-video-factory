
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
    mkdir,
    readFile,
    stat,
    writeFile,
} from "node:fs/promises";
import path from "node:path";

const SCHEMA_VERSION = 1;

const DEFAULT_HISTORY_FILE =
    "output/publishing/youtube-upload-history.json";

const PRIVACY_STATUSES = [
    "private",
    "unlisted",
    "public",
];

function validateRequiredString(value, fieldName) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(
            `YouTube upload history requires a valid ${fieldName}.`
        );
    }

    return value.trim();
}

function validateFileHash(fileHash) {
    if (
        typeof fileHash !== "string" ||
        !/^[a-f0-9]{64}$/i.test(fileHash)
    ) {
        throw new Error(
            "YouTube upload history requires a valid SHA-256 hash."
        );
    }

    return fileHash.toLowerCase();
}

function validateVideoUrl(url, videoId) {
    let parsedUrl;

    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error("YouTube video URL is invalid.");
    }

    const isWatchUrl =
        ["youtube.com", "www.youtube.com"].includes(
            parsedUrl.hostname
        ) &&
        parsedUrl.pathname === "/watch" &&
        parsedUrl.searchParams.get("v") === videoId;

    const isShortUrl =
        parsedUrl.hostname === "youtu.be" &&
        parsedUrl.pathname.slice(1) === videoId;

    if (
        parsedUrl.protocol !== "https:" ||
        (!isWatchUrl && !isShortUrl)
    ) {
        throw new Error(
            "YouTube video URL does not match the video ID."
        );
    }

    return parsedUrl.toString();
}

function validateHistoryItem(item, index) {
    const label = `history item ${index + 1}`;

    if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
    ) {
        throw new Error(
            `YouTube upload history contains an invalid ${label}.`
        );
    }

    validateRequiredString(item.word, `${label} word`);
    validateRequiredString(item.title, `${label} title`);
    validateRequiredString(item.videoId, `${label} video ID`);
    validateRequiredString(item.videoPath, `${label} video path`);
    validateRequiredString(item.uploadStatus, `${label} upload status`);

    validateFileHash(item.fileHash);

    if (!Number.isSafeInteger(item.fileSize) || item.fileSize <= 0) {
        throw new Error(
            `YouTube upload history contains an invalid ${label} file size.`
        );
    }

    if (!PRIVACY_STATUSES.includes(item.privacyStatus)) {
        throw new Error(
            `YouTube upload history contains an invalid ${label} privacy status.`
        );
    }

    validateVideoUrl(item.url, item.videoId);

    if (
        typeof item.uploadedAt !== "string" ||
        Number.isNaN(Date.parse(item.uploadedAt))
    ) {
        throw new Error(
            `YouTube upload history contains an invalid ${label} date.`
        );
    }
}

export class YouTubeUploadHistoryService {
    static resolveHistoryPath({
        projectRoot = process.cwd(),
        historyFile = DEFAULT_HISTORY_FILE,
    } = {}) {
        if (
            typeof projectRoot !== "string" ||
            !projectRoot.trim() ||
            typeof historyFile !== "string" ||
            !historyFile.trim()
        ) {
            throw new Error(
                "A valid project root and history file path are required."
            );
        }

        return path.resolve(projectRoot, historyFile);
    }

    static async load({
        projectRoot = process.cwd(),
        historyFile = DEFAULT_HISTORY_FILE,
    } = {}) {
        const filePath = this.resolveHistoryPath({
            projectRoot,
            historyFile,
        });

        let contents;

        try {
            contents = await readFile(filePath, "utf8");
        } catch (error) {
            if (error.code === "ENOENT") {
                return {
                    schemaVersion: SCHEMA_VERSION,
                    items: [],
                };
            }

            throw error;
        }

        let data;

        try {
            data = JSON.parse(contents);
        } catch {
            throw new Error(
                `YouTube upload history contains invalid JSON: ${filePath}`
            );
        }

        if (
            data?.schemaVersion !== SCHEMA_VERSION ||
            !Array.isArray(data.items)
        ) {
            throw new Error(
                `YouTube upload history has an unsupported structure: ${filePath}`
            );
        }

        data.items.forEach(validateHistoryItem);

        return data;
    }

    static async fingerprintFile({
        videoPath,
        projectRoot = process.cwd(),
    } = {}) {
        if (
            typeof videoPath !== "string" ||
            !videoPath.trim()
        ) {
            throw new Error("Video file path is required.");
        }

        const resolvedVideoPath = path.resolve(
            projectRoot,
            videoPath
        );

        let fileInfo;

        try {
            fileInfo = await stat(resolvedVideoPath);
        } catch (error) {
            if (error.code === "ENOENT") {
                throw new Error(
                    `Video file not found: ${resolvedVideoPath}`
                );
            }

            throw error;
        }

        if (!fileInfo.isFile()) {
            throw new Error("Video path must point to a file.");
        }

        if (fileInfo.size <= 0) {
            throw new Error("Video file is empty.");
        }

        const hash = createHash("sha256");
        const stream = createReadStream(resolvedVideoPath);

        for await (const chunk of stream) {
            hash.update(chunk);
        }

        return {
            fileHash: hash.digest("hex"),
            fileSize: fileInfo.size,
            videoPath: resolvedVideoPath,
        };
    }

    static async findDuplicate({
        videoPath,
        fileHash,
        projectRoot = process.cwd(),
        historyFile = DEFAULT_HISTORY_FILE,
    } = {}) {
        let normalizedHash = fileHash;

        if (normalizedHash === undefined) {
            const fingerprint = await this.fingerprintFile({
                videoPath,
                projectRoot,
            });

            normalizedHash = fingerprint.fileHash;
        } else {
            normalizedHash = validateFileHash(normalizedHash);
        }

        const data = await this.load({
            projectRoot,
            historyFile,
        });

        return (
            [...data.items]
                .reverse()
                .find((item) => item.fileHash === normalizedHash) ?? null
        );
    }

    static async recordUpload({
        word,
        title,
        videoId,
        url,
        videoPath,
        fileHash,
        privacyStatus = "private",
        uploadStatus = "uploaded",
        uploadedAt = new Date().toISOString(),
        projectRoot = process.cwd(),
        historyFile = DEFAULT_HISTORY_FILE,
    } = {}) {
        const normalizedWord = validateRequiredString(
            word,
            "word"
        );

        const normalizedTitle = validateRequiredString(
            title,
            "title"
        );

        const normalizedVideoId = validateRequiredString(
            videoId,
            "video ID"
        );

        const normalizedUploadStatus = validateRequiredString(
            uploadStatus,
            "upload status"
        );

        if (!PRIVACY_STATUSES.includes(privacyStatus)) {
            throw new Error(
                `Invalid YouTube privacy status: ${privacyStatus}`
            );
        }

        if (
            typeof uploadedAt !== "string" ||
            Number.isNaN(Date.parse(uploadedAt))
        ) {
            throw new Error("Upload date must be a valid date string.");
        }

        const normalizedUrl = validateVideoUrl(
            url,
            normalizedVideoId
        );

        const fingerprint = await this.fingerprintFile({
            videoPath,
            projectRoot,
        });

        if (
            fileHash !== undefined &&
            validateFileHash(fileHash) !== fingerprint.fileHash
        ) {
            throw new Error(
                "Video file changed since its fingerprint was calculated."
            );
        }

        const data = await this.load({
            projectRoot,
            historyFile,
        });

        if (
            data.items.some(
                (item) => item.videoId === normalizedVideoId
            )
        ) {
            throw new Error(
                `YouTube video ${normalizedVideoId} already exists in upload history.`
            );
        }

        const resolvedProjectRoot = path.resolve(projectRoot);
        const relativeVideoPath = path.relative(
            resolvedProjectRoot,
            fingerprint.videoPath
        );

        const isOutsideProject =
            relativeVideoPath === ".." ||
            relativeVideoPath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeVideoPath);

        const record = {
            word: normalizedWord,
            title: normalizedTitle,
            videoId: normalizedVideoId,
            url: normalizedUrl,
            videoPath: isOutsideProject
                ? fingerprint.videoPath
                : relativeVideoPath,
            fileHash: fingerprint.fileHash,
            fileSize: fingerprint.fileSize,
            uploadedAt: new Date(uploadedAt).toISOString(),
            privacyStatus,
            uploadStatus: normalizedUploadStatus,
        };

        data.items.push(record);

        const filePath = this.resolveHistoryPath({
            projectRoot,
            historyFile,
        });

        await mkdir(path.dirname(filePath), {
            recursive: true,
        });

        await writeFile(
            filePath,
            `${JSON.stringify(data, null, 2)}\n`,
            {
                encoding: "utf8",
                mode: 0o600,
            }
        );

        return record;
    }

    static async list({
        projectRoot = process.cwd(),
        historyFile = DEFAULT_HISTORY_FILE,
        limit,
    } = {}) {
        if (
            limit !== undefined &&
            (!Number.isInteger(limit) || limit < 1)
        ) {
            throw new Error(
                "History limit must be a positive integer."
            );
        }

        const data = await this.load({
            projectRoot,
            historyFile,
        });

        const items = [...data.items].sort(
            (first, second) =>
                Date.parse(second.uploadedAt) -
                Date.parse(first.uploadedAt)
        );

        return limit === undefined
            ? items
            : items.slice(0, limit);
    }
}
