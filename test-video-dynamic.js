import "dotenv/config";

import { VideoRenderService } from "./src/services/video/VideoRenderService.js";
import { TimelineService } from "./src/services/video/TimelineService.js";
import { OutputPathService } from "./src/services/OutputPathService.js";
import { languages } from "./src/config/languages.js";

const renderer = new VideoRenderService();
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

console.log("▶ Creating timeline...");

const timeline = await timelineService.createForWord(
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
    `\nTotal duration: ${duration.toFixed(3)} s`
);

const outputPath =
    "output/videos/test-bicycle-dynamic.mp4";

console.log(
    "\n▶ Rendering dynamic language layer..."
);

await renderer.renderDynamic(
    word,
    "output/images/bicycle.png",
    timeline,
    outputPath,
    duration
);

console.log(
    `✅ Dynamic video created: ${outputPath}`
);