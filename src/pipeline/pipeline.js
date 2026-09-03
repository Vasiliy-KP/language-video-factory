import { ProgressReporter } from "../services/ProgressReporter.js";
import { EdgeTTSService } from "../services/speech/EdgeTTSService.js";
import { AudioService } from "../services/audio/AudioService.js";
import { CloudflareImageService } from "../services/image/CloudflareImageService.js";
import { VideoService } from "../services/video/VideoService.js";
import { OutputPathService } from "../services/OutputPathService.js";
import { TimelineService } from "../services/video/TimelineService.js";
import { SubtitleService } from "../services/video/SubtitleService.js";
import { FileSystem } from "../utils/FileSystem.js";
import { languages } from "../config/languages.js";

export class Pipeline {
    constructor() {
        this.tts = new EdgeTTSService();
        this.audio = new AudioService();
        this.image = new CloudflareImageService();
        this.video = new VideoService();

        this.timeline = new TimelineService();
        this.subtitle = new SubtitleService();

        this.concurrency = 4;

        this.maxRetries = 3;
        this.retryDelay = 2000;
    }

    async run(words) {
        console.log("Pipeline started");

        // =========================
        // IMAGE TASKS
        // =========================

        const imageTasks = words.map(word => ({
            word,
            outputPath: OutputPathService.getImagePath(
                word.en.toLowerCase()
            )
        }));

        const imageProgress = new ProgressReporter(
            "Images",
            imageTasks.length
        );

        console.log("\n## Images");

        for (
            let i = 0;
            i < imageTasks.length;
            i += this.concurrency
        ) {
            const batch = imageTasks.slice(
                i,
                i + this.concurrency
            );

            const results = await Promise.all(
                batch.map(task =>
                    this.processImageTask(task)
                )
            );

            for (const result of results) {
                imageProgress.complete(result);
            }
        }

        imageProgress.showSummary();

        // =========================
        // AUDIO TASKS
        // =========================

        const audioTasks = [];

        for (const word of words) {
            console.log(`Processing word: ${word.en}`);

            for (const language of languages) {
                const text = word[language.field];

                const outputPath =
                    OutputPathService.getAudioPath(
                        text,
                        language.suffix
                    );

                audioTasks.push({
                    word,
                    language,
                    text,
                    outputPath
                });
            }
        }

        const audioProgress = new ProgressReporter(
            "Audio",
            audioTasks.length
        );

        console.log("\n## Audio");

        for (
            let i = 0;
            i < audioTasks.length;
            i += this.concurrency
        ) {
            const batch = audioTasks.slice(
                i,
                i + this.concurrency
            );

            const results = await Promise.all(
                batch.map(task =>
                    this.processTask(task)
                )
            );

            for (const result of results) {
                audioProgress.complete(result);
            }
        }

        audioProgress.showSummary();

        // =========================
        // VIDEO TASKS
        // =========================

        const videoTasks = words.map(word => ({
            word,

            imagePath: OutputPathService.getImagePath(
                word.en.toLowerCase()
            ),

            audioPaths: languages.map(language =>
                OutputPathService.getAudioPath(
                    word[language.field],
                    language.suffix
                )
            ),

            outputPath: OutputPathService.getVideoPath(
                word.en
            )
        }));

        const videoProgress = new ProgressReporter(
            "Videos",
            videoTasks.length
        );

        console.log("\n## Videos");

        for (
            let i = 0;
            i < videoTasks.length;
            i += this.concurrency
        ) {
            const batch = videoTasks.slice(
                i,
                i + this.concurrency
            );

            const results = await Promise.all(
                batch.map(task =>
                    this.processVideoTask(task)
                )
            );

            for (const result of results) {
                videoProgress.complete(result);
            }
        }

        videoProgress.showSummary();

        console.log("\n## Pipeline completed");
    }

    // =========================
    // IMAGE
    // =========================

    async processImageTask({
        word,
        outputPath
    }) {
        if (await FileSystem.exists(outputPath)) {
            console.log(
                `⏭ Image: ${word.en} — already exists`
            );

            return "skipped";
        }

        for (
            let attempt = 1;
            attempt <= this.maxRetries;
            attempt++
        ) {
            try {
                console.log(
                    `▶ Image: ${word.en} — generating ` +
                    `(attempt ${attempt}/${this.maxRetries})`
                );

                await this.image.generate(
                    word.imagePrompt,
                    outputPath
                );

                console.log(
                    `✅ Image: ${word.en} — generated`
                );

                return "generated";

            } catch (error) {
                console.error(
                    `⚠️ Image: ${word.en} — ` +
                    `attempt ${attempt} failed`
                );

                console.error(error.message);

                if (attempt < this.maxRetries) {
                    await this.waitBeforeRetry(attempt);
                }
            }
        }

        console.error(
            `❌ Image: ${word.en} — ` +
            `failed after ${this.maxRetries} attempts`
        );

        return "failed";
    }

    // =========================
    // AUDIO
    // =========================

    async processTask({
        language,
        text,
        outputPath
    }) {
        if (await FileSystem.exists(outputPath)) {
            console.log(
                `⏭ ${language.code}: ${text} — already exists`
            );

            return "skipped";
        }

        for (
            let attempt = 1;
            attempt <= this.maxRetries;
            attempt++
        ) {
            try {
                console.log(
                    `▶ ${language.code}: ${text} — generating ` +
                    `(attempt ${attempt}/${this.maxRetries})`
                );

                await this.tts.generate(
                    text,
                    language.code,
                    outputPath
                );

                console.log(
                    `✅ ${language.code}: ${text} — generated`
                );

                return "generated";

            } catch (error) {
                console.error(
                    `⚠️ ${language.code}: ${text} — ` +
                    `attempt ${attempt} failed`
                );

                console.error(error.message);

                if (attempt < this.maxRetries) {
                    await this.waitBeforeRetry(attempt);
                }
            }
        }

        console.error(
            `❌ ${language.code}: ${text} — ` +
            `failed after ${this.maxRetries} attempts`
        );

        return "failed";
    }

    // =========================
    // VIDEO
    // =========================

    async processVideoTask({ word, imagePath, audioPaths, outputPath }) {
        if (await FileSystem.exists(outputPath)) {
            console.log(`⏭ Video: ${word.en} — already exists`);
            return "skipped";
        }

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(
                    `▶ Video: ${word.en} — generating (attempt ${attempt}/${this.maxRetries})`
                );

                const wordSlug = word.en.toLowerCase();

                const mergedAudioPath =
                    `output/temp/${wordSlug}.mp3`;

                const subtitlePath =
                    `output/temp/${wordSlug}.ass`;

                await FileSystem.ensureDirectory(mergedAudioPath);
                await FileSystem.ensureDirectory(subtitlePath);

                // 1. Об'єднуємо аудіо всіх мов
                await this.audio.merge(
                    audioPaths,
                    mergedAudioPath
                );

                // 2. Створюємо timeline на основі реальної
                //    тривалості кожного аудіофайлу
                const timeline = await this.timeline.createForWord(
                    word,
                    languages,
                    OutputPathService
                );

                // 3. Створюємо ASS-субтитри
                await this.subtitle.create(
                    timeline,
                    subtitlePath
                );

                // 4. Створюємо фінальне відео
                await this.video.create(
                    imagePath,
                    mergedAudioPath,
                    outputPath,
                    subtitlePath
                );

                console.log(
                    `✅ Video: ${word.en} — generated`
                );

                console.log(
                    `   Duration: ${this.timeline.getDuration(timeline).toFixed(3)} s`
                );

                return "generated";
            } catch (error) {
                console.error(
                    `⚠️ Video: ${word.en} — attempt ${attempt} failed`
                );

                console.error(error.message);

                if (attempt < this.maxRetries) {
                    await this.waitBeforeRetry(attempt);
                }
            }
        }

        console.error(
            `❌ Video: ${word.en} — failed after ${this.maxRetries} attempts`
        );

        return "failed";
    }

    // =========================
    // RETRY
    // =========================

    async waitBeforeRetry(attempt) {
        const delay =
            this.retryDelay * attempt;

        console.log(
            `🔄 Retrying in ${delay / 1000}s...`
        );

        await new Promise(resolve =>
            setTimeout(resolve, delay)
        );
    }
}