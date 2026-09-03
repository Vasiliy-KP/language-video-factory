import { TimelineService } from "./src/services/video/TimelineService.js";

const timelineService = new TimelineService();

const segments = [
    {
        language: "uk",
        text: "велосипед",
        duration: 1.824,
    },
    {
        language: "en",
        text: "Bicycle",
        duration: 1.128,
    },
    {
        language: "fr",
        text: "Vélo",
        duration: 1.776,
    },
    {
        language: "de",
        text: "Fahrrad",
        duration: 1.776,
    },
];

const timeline = timelineService.create(segments);

console.table(timeline);

console.log(
    `Total duration: ${timelineService
        .getDuration(timeline)
        .toFixed(3)} s`
);