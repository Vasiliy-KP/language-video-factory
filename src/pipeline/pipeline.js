import { ProgressReporter } from "../services/ProgressReporter.js";
import { EdgeTTSService } from "../services/speech/EdgeTTSService.js";
import { OutputPathService } from "../services/OutputPathService.js";
import { FileSystem } from "../utils/FileSystem.js";
import { languages } from "../config/languages.js";

export class Pipeline {
    constructor() {
        this.tts = new EdgeTTSService();

        this.concurrency = 4;

        this.maxRetries = 3;
        this.retryDelay = 2000;
    }

    async run(words) {
        console.log("Pipeline started");

        const tasks = [];

        // Створюємо список усіх завдань
        for (const word of words) {
            console.log(`Processing word: ${word.en}`);

            for (const language of languages) {
                const text = word[language.field];

                const outputPath = OutputPathService.getAudioPath(
                    text,
                    language.suffix
                );

                tasks.push({
                    word,
                    language,
                    text,
                    outputPath
                });
            }
        }

        const total = tasks.length;

        const progress = new ProgressReporter(total);

        // Запускаємо завдання групами
        for (let i = 0; i < tasks.length; i += this.concurrency) {
            const batch = tasks.slice(
                i,
                i + this.concurrency
            );

            const results = await Promise.all(
                batch.map(task => this.processTask(task))
            );

            for (const result of results) {
                progress.complete(result);
            }
        }

        progress.showSummary();
    }

    async processTask(
        { language, text, outputPath },
        onComplete
    ) {
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
        }

        console.error(
            `❌ ${language.code}: ${text} — ` +
            `failed after ${this.maxRetries} attempts`
        );

        return "failed";
    }
}