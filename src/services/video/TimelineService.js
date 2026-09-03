import { AudioMetadataService } from "../audio/AudioMetadataService.js";

export class TimelineService {
    constructor() {
        this.audioMetadata =
            new AudioMetadataService();
    }

    async createForWord(
        word,
        languages,
        outputPathService
    ) {
        const segments = [];

        for (const language of languages) {
            const text = word[language.field];

            const audioPath =
                outputPathService.getAudioPath(
                    text,
                    language.suffix
                );

            const duration =
                await this.audioMetadata.getDuration(
                    audioPath
                );

            segments.push({
                language: language.code,
                text,
                audioPath,
                duration,
            });
        }

        return this.create(segments);
    }

    create(segments) {
        let currentTime = 0;

        return segments.map(segment => {
            const start = currentTime;

            const end =
                start + segment.duration;

            currentTime = end;

            return {
                ...segment,
                start,
                end,
            };
        });
    }

    getDuration(timeline) {
        if (timeline.length === 0) {
            return 0;
        }

        return timeline[timeline.length - 1].end;
    }
}