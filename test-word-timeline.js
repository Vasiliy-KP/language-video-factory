import { TimelineService } from "./src/services/video/TimelineService.js";
import { OutputPathService } from "./src/services/OutputPathService.js";
import { languages } from "./src/config/languages.js";

const timelineService =
    new TimelineService();

const word = {
    uk: "велосипед",
    en: "Bicycle",
    fr: "Vélo",
    de: "Fahrrad",
};

const timeline =
    await timelineService.createForWord(
        word,
        languages,
        OutputPathService
    );

console.table(timeline);

console.log(
    `Total duration: ${timelineService
        .getDuration(timeline)
        .toFixed(3)
    } s`
);