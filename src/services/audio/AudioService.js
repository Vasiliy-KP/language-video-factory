import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export class AudioService {
    async merge(audioPaths, outputPath) {
        const concatFile = `${outputPath}.txt`;

        const absoluteAudioPaths = audioPaths.map(filePath =>
            path.resolve(filePath)
        );

        const concatContent = absoluteAudioPaths
            .map(filePath => {
                const normalizedPath =
                    filePath.replaceAll("\\", "/");

                return `file '${normalizedPath}'`;
            })
            .join("\n");

        await fs.mkdir(path.dirname(outputPath), {
            recursive: true,
        });

        await fs.writeFile(
            concatFile,
            concatContent,
            "utf8"
        );

        try {
            await execFileAsync("ffmpeg", [
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                concatFile,
                "-c",
                "copy",
                "-y",
                outputPath,
            ]);
        } finally {
            await fs.unlink(concatFile).catch(() => { });
        }

        return outputPath;
    }
}