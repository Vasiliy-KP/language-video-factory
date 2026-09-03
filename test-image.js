import "dotenv/config";
import { OpenAIImageService } from "./src/services/image/OpenAIImageService.js";
import { FileSystem } from "./src/utils/FileSystem.js";

const imageService = new OpenAIImageService();

const outputPath = "output/images/bicycle.png";

await FileSystem.ensureDirectory(outputPath);

await imageService.generate(
    "modern bicycle isolated on white background, clean educational illustration",
    outputPath
);

console.log("Image test completed");