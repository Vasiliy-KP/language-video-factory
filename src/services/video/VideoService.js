import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

export class VideoService {
    async create(imagePath, audioPath, outputPath, subtitlePath = null) {
        const absoluteImagePath = path.resolve(imagePath);
        const absoluteAudioPath = path.resolve(audioPath);
        const absoluteOutputPath = path.resolve(outputPath);

        const args = [
            "-loop",
            "1",
            "-i",
            absoluteImagePath,
            "-i",
            absoluteAudioPath,
        ];

        if (subtitlePath) {
            const relativeSubtitlePath = path
                .relative(process.cwd(), path.resolve(subtitlePath))
                .replaceAll("\\", "/");

            args.push(
                "-vf",
                `subtitles=filename='${this.escapeFilterPath(relativeSubtitlePath)}'`
            );
        } else {
            args.push(
                "-vf",
                "format=yuv420p"
            );
        }

        args.push(
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            "-y",
            absoluteOutputPath
        );

        await execFileAsync("ffmpeg", args);

        return outputPath;
    }

    escapeFilterPath(filePath) {
        return filePath
            .replaceAll("'", "\\'");
    }
}