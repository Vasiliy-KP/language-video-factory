import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

import { QuizTimelineService } from "./QuizTimelineService.js";
import { QuizAudioService } from "../audio/QuizAudioService.js";
import { VideoRenderService } from "./VideoRenderService.js";
import { FileSystem } from "../../utils/FileSystem.js";

const execFileAsync = promisify(execFile);

export class QuizVideoService {
    constructor(languages, outputPathService, pauseDuration = 0.8) {
        this.languages = languages;
        this.outputPathService = outputPathService;

        this.timelineService = new QuizTimelineService(
            pauseDuration
        );

        this.audioService = new QuizAudioService();

        this.renderer = new VideoRenderService();
    }

    async create(
        word,
        imagePath,
        outputPath,
        designName = "minimal",
        contentName = "quiz"
    ) {
        const timeline =
            await this.timelineService.createForWord(
                word,
                this.languages,
                this.outputPathService
            );

        const duration =
            this.timelineService.getDuration(timeline);

        const wordSlug = this.createSlug(
            word.en || word.uk
        );

        const audioPath = path.resolve(
            "output",
            "temp",
            `${wordSlug}-quiz.mp3`
        );

        const visualPath = path.resolve(
            "output",
            "temp",
            `${wordSlug}-quiz-visual.mp4`
        );

        await FileSystem.ensureDirectory(outputPath);

        try {
            console.log("▶ Creating quiz audio...");

            await this.audioService.create(
                timeline,
                audioPath
            );

            console.log("✅ Quiz audio created");

            console.log("▶ Creating quiz visual...");

            await this.renderer.renderQuiz(
                word,
                imagePath,
                timeline,
                visualPath,
                duration,
                designName,
                contentName
            );

            console.log("✅ Quiz visual created");

            console.log("▶ Muxing quiz video and audio...");

            await this.mux(
                visualPath,
                audioPath,
                outputPath
            );

            console.log("✅ Quiz video created");

            await FileSystem.remove(audioPath);
            await FileSystem.remove(visualPath);

            console.log("🧹 Temporary quiz files removed");

            return {
                timeline,
                duration,
                outputPath,
            };
        } catch (error) {
            console.error(
                "❌ Quiz video creation failed."
            );

            console.error(
                "ℹ️ Temporary files were kept for debugging."
            );

            throw error;
        }
    }

    async mux(videoPath, audioPath, outputPath) {
        const absoluteVideoPath =
            path.resolve(videoPath);

        const absoluteAudioPath =
            path.resolve(audioPath);

        const absoluteOutputPath =
            path.resolve(outputPath);

        await execFileAsync("ffmpeg", [
            "-i",
            absoluteVideoPath,

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

            "-b:a",
            "128k",

            "-shortest",

            "-movflags",
            "+faststart",

            "-y",
            absoluteOutputPath,
        ]);
    }

    createSlug(text) {
        return String(text)
            .trim()
            .toLowerCase()
            .replace(/[<>:"/\\|?*]+/g, "-")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    }
}