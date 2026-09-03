import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export class AudioMetadataService {
    async getDuration(audioPath) {
        const { stdout } = await execFileAsync("ffprobe", [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            audioPath,
        ]);

        const duration = Number.parseFloat(
            stdout.trim()
        );

        if (!Number.isFinite(duration)) {
            throw new Error(
                `Could not determine audio duration: ${audioPath}`
            );
        }

        return duration;
    }
}