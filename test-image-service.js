import "dotenv/config";

import { CloudflareImageService } from "./src/services/image/CloudflareImageService.js";

const imageService = new CloudflareImageService();

const prompt =
    "modern bicycle isolated on white background, clean educational illustration";

const outputPath = "output/images/test-bicycle.png";

await imageService.generate(
    prompt,
    outputPath
);

console.log("Image generated successfully!");
console.log(`Saved to: ${outputPath}`);