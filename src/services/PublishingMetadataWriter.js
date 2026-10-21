
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class PublishingMetadataWriter {
    static async save(metadata, outputDirectory = "output/metadata") {
        if (!metadata || typeof metadata !== "object") {
            throw new TypeError("Metadata must be an object.");
        }

        if (
            typeof metadata.word !== "string" ||
            !metadata.word.trim()
        ) {
            throw new TypeError(
                'Metadata field "word" must be a non-empty string.'
            );
        }

        const safeFilename = metadata.word
            .normalize("NFKC")
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
            .replace(/[. ]+$/g, "")
            .trim();

        if (!safeFilename) {
            throw new Error("Cannot create a filename from the word.");
        }

        const directory = path.resolve(outputDirectory);
        await mkdir(directory, { recursive: true });

        const filePath = path.join(
            directory,
            `${safeFilename}.json`
        );

        await writeFile(
            filePath,
            `${JSON.stringify(metadata, null, 2)}\n`,
            "utf8"
        );

        return filePath;
    }
}
