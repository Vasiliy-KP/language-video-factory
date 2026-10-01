import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

import { FileSystem } from "../../utils/FileSystem.js";

const execFileAsync = promisify(execFile);

export class QuizAudioService {
    constructor() {
        this.sampleRate = 24000;
        this.channelLayout = "mono";
        this.bitrate = "48k";
    }

    async create(timeline, outputPath) {
        if (!timeline || timeline.length === 0) {
            throw new Error(
                "Cannot create quiz audio without timeline."
            );
        }

        const absoluteOutputPath =
            path.resolve(outputPath);

        await FileSystem.ensureDirectory(
            absoluteOutputPath
        );

        const args = [];

        /*
         * Add audio inputs:
         *
         * prompt
         * silence
         * answer
         */

        for (const segment of timeline) {
            args.push(
                "-i",
                path.resolve(
                    segment.prompt.audioPath
                )
            );

            args.push(
                "-f",
                "lavfi",
                "-t",
                String(segment.pauseDuration),
                "-i",
                `anullsrc=channel_layout=${this.channelLayout}:sample_rate=${this.sampleRate}`
            );

            args.push(
                "-i",
                path.resolve(
                    segment.answer.audioPath
                )
            );
        }

        /*
         * Normalize every audio input,
         * then concatenate them in order.
         */

        const filters = [];
        const labels = [];

        const totalInputs =
            timeline.length * 3;

        for (let i = 0; i < totalInputs; i++) {
            const label = `a${i}`;

            filters.push(
                `[${i}:a]` +
                `aresample=${this.sampleRate},` +
                `aformat=` +
                `sample_rates=${this.sampleRate}:` +
                `channel_layouts=${this.channelLayout}` +
                `[${label}]`
            );

            labels.push(`[${label}]`);
        }

        filters.push(
            labels.join("") +
            `concat=n=${totalInputs}:v=0:a=1[outa]`
        );

        args.push(
            "-filter_complex",
            filters.join(";"),

            "-map",
            "[outa]",

            "-c:a",
            "libmp3lame",

            "-b:a",
            this.bitrate,

            "-ar",
            String(this.sampleRate),

            "-ac",
            "1",

            "-y",
            absoluteOutputPath
        );

        await execFileAsync(
            "ffmpeg",
            args
        );

        return outputPath;
    }
}