import path from "path";
import { languages } from "../../config/languages.js";

export class FlagAssetService {
    getFlagPath(languageCode) {
        const language = languages.find(
            (item) => item.code === languageCode
        );

        if (!language) {
            throw new Error(
                `Language configuration not found: ${languageCode}`
            );
        }

        return path.resolve(
            "assets",
            "flags",
            language.flag
        );
    }
}