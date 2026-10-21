
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class PublishingPackageWriter {
    static async save(
        metadata,
        outputDirectory = "output/publishing"
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

        return {
            directory,
            files: savedPaths,
        };
    }
}
