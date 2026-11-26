import {
    copyFile,
    mkdir,
    readFile,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";

import path from "node:path";

import {
    isDeepStrictEqual,
} from "node:util";

import {
    PublishingContentValidationService,
} from "./PublishingContentValidationService.js";

async function fileExists(filePath) {
    if (!filePath) {
        return false;
    }

    try {
        const fileStats = await stat(filePath);
        return fileStats.isFile();
    } catch (error) {
        if (
            error.code === "ENOENT" ||
            error.code === "ENOTDIR"
        ) {
            return false;
        }

        throw error;
    }
}

function toProjectRelativePath(filePath) {
    if (!filePath) {
        return null;
    }

    return path.relative(
        process.cwd(),
        path.resolve(filePath)
    );
}

async function copyAsset(sourcePath, destinationPath) {
    const destination = path.resolve(destinationPath);

    const source = sourcePath
        ? path.resolve(sourcePath)
        : null;

    // Не копіюємо файл у самого себе.
    if (source === destination) {
        return fileExists(destination);
    }

    // Видаляємо стару копію, якщо джерело відсутнє.
    // Це захищає від використання застарілих матеріалів.
    if (!source || !(await fileExists(source))) {
        await rm(destination, { force: true });
        return false;
    }

    await copyFile(source, destination);

    return true;
}

export class PublishingPackageWriter {
    static async save(
        metadata,
        outputDirectory = "output/publishing",
        {
            videoPath = null,
            metadataPath = null,
        } = {}
    ) {
        if (!metadata || typeof metadata !== "object") {
            throw new Error("Metadata must be an object.");
        }

        if (
            typeof metadata.word !== "string" ||
            !metadata.word.trim()
        ) {
            throw new Error(
                "Metadata must contain a non-empty word."
            );
        }

        const { tiktok, instagram, youtubeShorts } =
            metadata.platforms ?? {};

        if (!tiktok || !instagram || !youtubeShorts) {
            throw new Error(
                "Metadata must contain all three platforms."
            );
        }

        const safeWord = metadata.word
            .normalize("NFKC")
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
            .replace(/[. ]+$/g, "")
            .trim();

        if (
            !safeWord ||
            safeWord === "." ||
            safeWord === ".."
        ) {
            throw new Error(
                "Word cannot be used as a folder name."
            );
        }

        const directory = path.join(
            outputDirectory,
            safeWord
        );

        const formatHashtags = (platform) => {
            if (!Array.isArray(platform?.hashtags)) {
                return "";
            }

            return platform.hashtags
                .filter((hashtag) => typeof hashtag === "string")
                .join(" ");
        };

        const formatCaption = (platform) => {
            const caption =
                typeof platform?.caption === "string"
                    ? platform.caption.trim()
                    : "";

            return [
                caption,
                formatHashtags(platform),
            ]
                .filter(Boolean)
                .join("\n\n");
        };

        const youtubeContent = [
            "TITLE",
            typeof youtubeShorts.title === "string"
                ? youtubeShorts.title
                : "",
            "",
            "DESCRIPTION",
            typeof youtubeShorts.description === "string"
                ? youtubeShorts.description
                : "",
            "",
            "HASHTAGS",
            formatHashtags(youtubeShorts),
        ].join("\n");

        const files = {
            "tiktok.txt": formatCaption(tiktok),
            "instagram.txt": formatCaption(instagram),
            "youtube-shorts.txt": youtubeContent,
        };

        const platformContents = {
            tiktok: files["tiktok.txt"],
            instagram: files["instagram.txt"],
            youtubeShorts: files["youtube-shorts.txt"],
        };

        const validation =
            PublishingContentValidationService.validate({
                metadata,
                platformContents,
            });

        if (!validation.valid) {
            const validationErrors = [
                ...validation.errors,
                ...Object.entries(validation.platforms).flatMap(
                    ([platform, result]) =>
                        result.errors.map((error) => ({
                            platform,
                            ...error,
                        }))
                ),
            ];

            const details = validationErrors.map((error) => {
                const platform = error.platform
                    ? `${error.platform}: `
                    : "";

                return `${platform}${error.code}: ${error.message}`;
            });

            throw new Error(
                "Publishing content validation failed:\n" +
                details.join("\n")
            );
        }

        const normalizedVideoPath =
            typeof videoPath === "string" && videoPath.trim()
                ? videoPath.trim()
                : null;

        const normalizedMetadataPath =
            typeof metadataPath === "string" &&
                metadataPath.trim()
                ? metadataPath.trim()
                : null;

        if (
            normalizedMetadataPath &&
            await fileExists(normalizedMetadataPath)
        ) {
            let sourceMetadata;

            try {
                sourceMetadata = JSON.parse(
                    await readFile(normalizedMetadataPath, "utf8")
                );
            } catch {
                throw new Error(
                    `Metadata source file is not valid JSON: ${normalizedMetadataPath}`
                );
            }

            if (!isDeepStrictEqual(sourceMetadata, metadata)) {
                throw new Error(
                    "Metadata object does not match the metadata source file."
                );
            }
        }

        // Створюємо директорію тільки після успішної валідації контенту.
        await mkdir(directory, { recursive: true });

        const savedPaths = {};

        for (const [fileName, content] of Object.entries(files)) {
            const filePath = path.join(directory, fileName);

            await writeFile(filePath, content, "utf8");

            savedPaths[fileName] = filePath;
        }

        // Шляхи до копій усередині пакета.
        const packagedVideoPath = path.join(
            directory,
            "video.mp4"
        );

        const packagedMetadataPath = path.join(
            directory,
            "metadata.json"
        );

        // Копіюємо відео та метадані.
        const [videoExists, metadataExists] = await Promise.all([
            copyAsset(
                normalizedVideoPath,
                packagedVideoPath
            ),
            copyAsset(
                normalizedMetadataPath,
                packagedMetadataPath
            ),
        ]);

        const manifest = {
            schemaVersion: 1,
            word: metadata.word,
            category: metadata.category ?? null,
            level: metadata.level ?? null,

            status:
                videoExists && metadataExists
                    ? "ready_for_review"
                    : "metadata_ready",

            assets: {
                video: {
                    path: normalizedVideoPath
                        ? toProjectRelativePath(packagedVideoPath)
                        : null,

                    sourcePath: toProjectRelativePath(
                        normalizedVideoPath
                    ),

                    exists: videoExists,
                },

                metadata: {
                    path: normalizedMetadataPath
                        ? toProjectRelativePath(packagedMetadataPath)
                        : null,

                    sourcePath: toProjectRelativePath(
                        normalizedMetadataPath
                    ),

                    exists: metadataExists,
                },
            },

            platforms: {
                tiktok: {
                    file: "tiktok.txt",
                    ready: true,
                },

                instagram: {
                    file: "instagram.txt",
                    ready: true,
                },

                youtubeShorts: {
                    file: "youtube-shorts.txt",
                    ready: true,
                },
            },
        };

        const manifestPath = path.join(
            directory,
            "manifest.json"
        );

        await writeFile(
            manifestPath,
            `${JSON.stringify(manifest, null, 2)}\n`,
            "utf8"
        );

        return {
            directory,
            files: savedPaths,
            assets: {
                video: videoExists
                    ? packagedVideoPath
                    : null,

                metadata: metadataExists
                    ? packagedMetadataPath
                    : null,
            },
            manifestPath,
        };
    }
}