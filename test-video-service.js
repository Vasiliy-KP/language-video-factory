import "dotenv/config";

import { VideoService } from "./src/services/video/VideoService.js";
import { TimelineService } from "./src/services/video/TimelineService.js";
import { OutputPathService } from "./src/services/OutputPathService.js";
import { languages } from "./src/config/languages.js";

const videoService = new VideoService();
const timelineService = new TimelineService();

const word = {
    id: 1,
    category: "Transport",
    uk: "велосипед",
    en: "Bicycle",
    fr: "Vélo",
    de: "Fahrrad",
    level: "A1",
};

const imagePath =
    OutputPathService.getImagePath(
        word.en.toLowerCase()
    );

const audioPaths = languages.map(
    (language) =>
        OutputPathService.getAudioPath(
            word[language.field],
            language.suffix
        )
);

const mergedAudioPath =
    "output/temp/test-video-service.mp3";

const outputPath =
    "output/videos/test-video-service.mp4";

console.log("▶ Creating merged audio...");

const { AudioService } =
    await import(
        "./src/services/audio/AudioService.js"
    );

const audioService = new AudioService();

await audioService.merge(
    audioPaths,
    mergedAudioPath
);

console.log("✅ Audio merged");

console.log("▶ Creating timeline...");

const timeline =
    await timelineService.createForWord(
        word,
        languages,
        OutputPathService
    );

const duration =
    timelineService.getDuration(timeline);

console.log("\nTimeline:");

for (const segment of timeline) {
    console.log(
        `${segment.language} | ` +
        `${segment.text} | ` +
        `${segment.start.toFixed(3)} → ` +
        `${segment.end.toFixed(3)}`
    );
}

console.log(
    `\nDuration: ${duration.toFixed(3)} s`
);

console.log(
    "\n▶ Creating final video..."
);

await videoService.create(
    word,
    imagePath,
    mergedAudioPath,
    timeline,
    outputPath
);

console.log(
    `✅ Video created: ${outputPath}`
);