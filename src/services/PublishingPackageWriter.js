
import {
    access,
    mkdir,
    writeFile,
} from "node:fs/promises";
import path from "node:path";

async function fileExists(filePath) {
    if (!filePath) {
        return false;
    }

    try {
        await access(filePath);
        return true;
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

        if (!safeWord || safeWord === "." || safeWord === "..") {
            throw new Error("Word cannot be used as a folder name.");
        }

        const directory = path.join(outputDirectory, safeWord);

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
            typeof metadataPath === "string" && metadataPath.trim()
                ? metadataPath.trim()
                : null;

        // Перевіряємо, чи існують відео та JSON.
        const [videoExists, metadataExists] = await Promise.all([
            fileExists(normalizedVideoPath),
            fileExists(normalizedMetadataPath),
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
                    path: toProjectRelativePath(normalizedVideoPath),
                    exists: videoExists,
                },
                metadata: {
                    path: toProjectRelativePath(normalizedMetadataPath),
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

        const manifestPath = path.join(directory, "manifest.json");

        await writeFile(
            manifestPath,
            JSON.stringify(manifest, null, 2) + "\n",
            "utf8"
        );

        return {
            directory,
            files: savedPaths,
            manifestPath,
        };
    }
}
