import path from "path";

export class FlagAssetService {
    constructor() {
        this.flags = {
            uk: "uk.png",
            en: "en.png",
            fr: "fr.png",
            de: "de.png",
        };
    }

    getFlagPath(language) {
        const fileName = this.flags[language];

        if (!fileName) {
            throw new Error(
                `Flag asset not found for language: ${language}`
            );
        }

        return path.resolve(
            "assets",
            "flags",
            fileName
        );
    }
}