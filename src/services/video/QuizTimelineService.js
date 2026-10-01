import { TimelineService } from "./TimelineService.js";

export class QuizTimelineService extends TimelineService {
    constructor(pauseDuration = 0.8) {
        super();

        this.pauseDuration = pauseDuration;
    }

    async createForWord(
        word,
        languages,
        outputPathService
    ) {
        const primaryLanguage = languages.find(
            (language) => language.primary
        );

        if (!primaryLanguage) {
            throw new Error(
                "Primary language is not configured."
            );
        }

        const targetLanguages = languages.filter(
            (language) => !language.primary
        );

        const promptText =
            word[primaryLanguage.field];

        const promptAudioPath =
            outputPathService.getAudioPath(
                promptText,
                primaryLanguage.suffix
            );

        const promptDuration =
            await this.audioMetadata.getDuration(
                promptAudioPath
            );

        const segments = [];

        let currentTime = 0;

        for (const language of targetLanguages) {
            const answerText =
                word[language.field];

            const answerAudioPath =
                outputPathService.getAudioPath(
                    answerText,
                    language.suffix
                );

            const answerDuration =
                await this.audioMetadata.getDuration(
                    answerAudioPath
                );

            const start = currentTime;

            const promptEnd =
                start + promptDuration;

            const answerStart =
                promptEnd + this.pauseDuration;

            const end =
                answerStart + answerDuration;

            segments.push({
                type: "quiz",

                language: language.code,

                start,
                promptEnd,
                answerStart,
                end,

                pauseDuration: this.pauseDuration,

                prompt: {
                    language: primaryLanguage.code,
                    text: promptText,
                    audioPath: promptAudioPath,
                    duration: promptDuration,
                },

                answer: {
                    language: language.code,
                    text: answerText,
                    audioPath: answerAudioPath,
                    duration: answerDuration,
                },
            });

            currentTime = end;
        }

        return segments;
    }
}