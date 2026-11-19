import {
    copyFile,
    mkdir,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";

import path from "node:path";

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

        await mkdir(directory, { recursive: true });

        const formatCaption = (platform) => {
            if (
                typeof platform.caption !== "string" ||
                !Array.isArray(platform.hashtags)
            ) {
                throw new Error(
                    "Invalid caption or hashtags."
                );
            }

            return [
                platform.caption.trim(),
                platform.hashtags.join(" "),
            ].filter(Boolean).join("\n\n");
        };

        const youtubeContent = [
            "TITLE",
            youtubeShorts.title,
            "",
            "DESCRIPTION",
            youtubeShorts.description,
            "",
            "HASHTAGS",
            youtubeShorts.hashtags.join(" "),
        ].join("\n");

        const files = {
            "tiktok.txt": formatCaption(tiktok),
            "instagram.txt": formatCaption(instagram),
            "youtube-shorts.txt": youtubeContent,
        };

        const savedPaths = {};

        for (const [fileName, content] of Object.entries(files)) {
            const filePath = path.join(directory, fileName);

            await writeFile(filePath, content, "utf8");

            savedPaths[fileName] = filePath;
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