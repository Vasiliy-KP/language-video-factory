import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

import { FileSystem } from "../../utils/FileSystem.js";
import { VideoRenderService } from "./VideoRenderService.js";

const execFileAsync = promisify(execFile);

export class VideoService {
    constructor() {
        this.renderer = new VideoRenderService();
    }

    async create(
        word,
        imagePath,
        audioPath,
        timeline,
        outputPath,
        designName = "default",
        contentName = "default"
    ) {
        const absoluteAudioPath = path.resolve(audioPath);
        const absoluteOutputPath = path.resolve(outputPath);

        const duration = this.getTimelineDuration(timeline);

        const wordSlug = word.en.toLowerCase();

        const visualPath = path.resolve(
            "output",
            "temp",
            `${wordSlug}-visual.mp4`
        );

        await FileSystem.ensureDirectory(
            absoluteOutputPath
        );

        /*
         * 1. Render visual layer
         */

        await this.renderer.renderDynamic(
            word,
            imagePath,
            timeline,
            visualPath,
            duration,
            designName,
            contentName
        );

        try {
            /*
             * 2. Combine video + audio
             */

            await execFileAsync("ffmpeg", [
                "-i",
                visualPath,

                "-i",
                absoluteAudioPath,

                "-map",
                "0:v:0",

                "-map",
                "1:a:0",

                "-c:v",
                "copy",

                "-c:a",
                "aac",

                "-shortest",

                "-movflags",
                "+faststart",

                "-y",
                absoluteOutputPath,
            ]);
        } finally {
            /*
             * 3. Remove temporary visual video
             */

            await this.removeTempFile(visualPath);
        }

        return outputPath;
    }

    getTimelineDuration(timeline) {
        if (!timeline || timeline.length === 0) {
            throw new Error(
                "Cannot create video without timeline."
            );
        }

        const duration =
            timeline[timeline.length - 1].end;

        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {
            throw new Error(
                "Invalid timeline duration."
            );
        }

        return duration;
    }

    async removeTempFile(filePath) {
        await fs.unlink(filePath).catch(() => {
            // Temporary file cleanup failure
            // should not break a successfully created video
        });
    }
}