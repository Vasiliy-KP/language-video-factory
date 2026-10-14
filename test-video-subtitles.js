import { VideoService } from "./src/services/video/VideoService.js";
import { SubtitleService } from "./src/services/video/SubtitleService.js";
import { AudioService } from "./src/services/audio/AudioService.js";
import { OutputPathService } from "./src/services/OutputPathService.js";
import { languages } from "./src/config/languages.js";
import { TimelineService } from "./src/services/video/TimelineService.js";

const videoService = new VideoService();
const subtitleService = new SubtitleService();
const audioService = new AudioService();

const word = {
    id: 1,
    category: "Transport",
    uk: "велосипед",
    en: "Bicycle",
    pl: "Rower",
    fr: "Vélo",
    de: "Fahrrad",
    es: "Bicicleta",
    imagePrompt: "modern bicycle isolated on white background",
    level: "A1",
};

const audioPaths = languages.map((language) =>
    OutputPathService.getAudioPath(
        word[language.field],
        language.suffix
    )
);

const mergedAudioPath = "output/temp/test-bicycle-merged.mp3";
const subtitlePath = "output/temp/test-bicycle.ass";
const outputPath = "output/videos/test-bicycle-subtitles.mp4";

const timelineService = new TimelineService();

const timeline = await timelineService.createForWord(
    word,
    languages,
    OutputPathService
);

await audioService.merge(
    audioPaths,
    mergedAudioPath
);

await subtitleService.create(
    timeline,
    subtitlePath
);

await videoService.create(
    word,
    OutputPathService.getImagePath("bicycle"),
    mergedAudioPath,
    timeline,
    outputPath
);

console.log(`✅ Video created: ${outputPath}`);