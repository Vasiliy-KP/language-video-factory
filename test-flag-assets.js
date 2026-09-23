import { FlagAssetService } from "./src/services/video/FlagAssetService.js";
import { languages } from "./src/config/languages.js";
import fs from "fs/promises";

const flagService = new FlagAssetService();

for (const language of languages) {
    const flagPath = flagService.getFlagPath(
        language.code
    );

    try {
        await fs.access(flagPath);

        console.log(
            `✅ ${language.code.toUpperCase()}: ${flagPath}`
        );
    } catch {
        console.error(
            `❌ ${language.code.toUpperCase()}: missing ${flagPath}`
        );
    }
}