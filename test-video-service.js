import { VideoService } from "./src/services/video/VideoService.js";

const videoService = new VideoService();

const imagePath =
    "output/images/bicycle.png";

const audioPath =
    "output/videos/bicycle_audio.mp3";

const outputPath =
    "output/videos/bicycle_service_test.mp4";

await videoService.create(
    imagePath,
    audioPath,
    outputPath
);

console.log("Video generated successfully!");
console.log(`Saved to: ${outputPath}`);