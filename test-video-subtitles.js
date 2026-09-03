import { VideoService } from "./src/services/video/VideoService.js";
import { SubtitleService } from "./src/services/video/SubtitleService.js";
import { AudioService } from "./src/services/audio/AudioService.js";
import { OutputPathService } from "./src/services/OutputPathService.js";
import { languages } from "./src/config/languages.js";

const videoService = new VideoService();
const subtitleService = new SubtitleService();
const audioService = new AudioService();

const word = {
    en: "Bicycle",
    uk: "велосипед",
    fr: "Vélo",
    de: "Fahrrad",
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

const timeline = [
    {
        language: "uk",
        text: "велосипед",
        start: 0,
        end: 1.824,
    },
    {
        language: "en",
        text: "Bicycle",
        start: 1.824,
        end: 2.952,
    },
    {
        language: "fr",
        text: "Vélo",
        start: 2.952,
        end: 4.728,
    },
    {
        language: "de",
        text: "Fahrrad",
        start: 4.728,
        end: 6.504,
    },
];

await audioService.merge(
    audioPaths,
    mergedAudioPath
);

await subtitleService.create(
    timeline,
    subtitlePath
);

await videoService.create(
    OutputPathService.getImagePath("bicycle"),
    mergedAudioPath,
    outputPath,
    subtitlePath
);

console.log(`✅ Video created: ${outputPath}`);