import "dotenv/config";

import { VideoRenderService } from "./src/services/video/VideoRenderService.js";

const renderer = new VideoRenderService();

const word = {
    id: 1,
    category: "Transport",
    uk: "велосипед",
    en: "Bicycle",
    fr: "Vélo",
    de: "Fahrrad",
    level: "A1",
};

const imagePath = "output/images/bicycle.png";

const outputPath =
    "output/videos/test-bicycle-design.mp4";

console.log("▶ Rendering Bicycle design...");

await renderer.render(
    word,
    imagePath,
    outputPath
);

console.log(
    `✅ Design video created: ${outputPath}`
);