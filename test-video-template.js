import "dotenv/config";

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

import { VideoTemplateService } from "./src/services/video/VideoTemplateService.js";

const execFileAsync = promisify(execFile);

const templateService = new VideoTemplateService();
const template = templateService.getBicycleTemplate();

const imagePath = path.resolve(
    "output/images/bicycle.png"
);

const outputPath = path.resolve(
    "output/videos/test-bicycle-template.mp4"
);

const fontPath = templateService
    .getFont()
    .replaceAll("\\", "/")
    .replaceAll(":", "\\:");

const filters = [
    `scale=${template.image.width}:${template.image.height}:force_original_aspect_ratio=decrease`,
    `pad=${template.image.width}:${template.image.height}:(ow-iw)/2:(oh-ih)/2`,
    `format=yuv420p`,
    `drawtext=fontfile='${fontPath}':text='${template.title}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=130`,
].join(",");

const args = [
    "-loop",
    "1",

    "-i",
    imagePath,

    "-vf",
    filters,

    "-t",
    "5",

    "-r",
    "30",

    "-c:v",
    "libx264",

    "-pix_fmt",
    "yuv420p",

    "-y",
    outputPath,
];

console.log("▶ Creating video template...");

await execFileAsync("ffmpeg", args);

console.log(
    `✅ Template video created: ${outputPath}`
);