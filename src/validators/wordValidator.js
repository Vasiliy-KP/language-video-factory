import { logger } from "../utils/logger.js";

export class WordValidator {
    static validate(word) {
        const requiredFields = [
            "id",
            "category",
            "uk",
            "en",
            "fr",
            "de",
            "imagePrompt",
            "level",
        ];

        const errors = [];

        for (const field of requiredFields) {
            const value = word[field];

            if (value === null || value === undefined || value === "") {
                errors.push(`Поле "${field}" не заповнене`);
            }
        }

        if (errors.length > 0) {
            logger.error(`Помилка у слові ID=${word.id}`);
            errors.forEach(error => logger.error(error));
            return false;
        }

        return true;
    }
}