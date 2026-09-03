import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export class VideoService {
    async create(
        imagePath,
        audioPath,
        outputPath
    ) {
        const args = [
            "-loop",
            "1",
            "-i",
            imagePath,
            "-i",
            audioPath,

            "-c:v",
            "libx264",
            "-tune",
            "stillimage",

            "-c:a",
            "aac",
            "-b:a",
            "192k",

            "-pix_fmt",
            "yuv420p",

            "-shortest",

            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=decrease," +
            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2",

            "-y",
            outputPath
        ];

        await execFileAsync(
            "ffmpeg",
            args
        );

        return outputPath;
    }
}