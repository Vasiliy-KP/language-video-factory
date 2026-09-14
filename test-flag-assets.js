import { FlagAssetService } from "./src/services/video/FlagAssetService.js";
import fs from "fs/promises";

const flagService = new FlagAssetService();

const languages = [
    "uk",
    "en",
    "fr",
    "de",
];

for (const language of languages) {
    const flagPath = flagService.getFlagPath(language);

    try {
        await fs.access(flagPath);

        console.log(
            `✅ ${language.toUpperCase()}: ${flagPath}`
        );
    } catch {
        console.error(
            `❌ ${language.toUpperCase()}: missing ${flagPath}`
        );
    }
}