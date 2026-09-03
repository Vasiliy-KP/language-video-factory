import { SubtitleService } from "./src/services/video/SubtitleService.js";

const subtitleService =
    new SubtitleService();

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

const outputPath =
    "output/temp/test-bicycle.ass";

await subtitleService.create(
    timeline,
    outputPath
);

console.log(
    `Subtitles created: ${outputPath}`
);