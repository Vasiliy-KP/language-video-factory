import { logger } from "../utils/logger.js";

const REQUIRED_TEXT_FIELDS = [
    "category",
    "uk",
    "en",
    "pl",
    "fr",
    "de",
    "es",
    "imagePrompt",
    "level",
];

const ALLOWED_LEVELS = new Set([
    "A1",
    "A2",
    "B1",
    "B2",
    "C1",
    "C2",
]);

const DUPLICATE_WORD_FIELDS = [
    "category",
    "uk",
    "en",
    "pl",
    "fr",
    "de",
    "es",
    "level",
];

function createError(row, field, code, message) {
    return {
        row,
        field,
        code,
        message,
    };
}

function getRowNumber(word, index = 0) {
    return Number.isInteger(word?.rowNumber)
        ? word.rowNumber
        : index + 2;
}

function normalizeText(value) {
    return value
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function getNormalizedId(value) {
    if (
        typeof value !== "number" &&
        typeof value !== "string"
    ) {
        return null;
    }

    const numericId = Number(value);

    if (
        !Number.isSafeInteger(numericId) ||
        numericId <= 0
    ) {
        return null;
    }

    return String(numericId);
}

function validateWordFields(word, row) {
    const errors = [];

    if (!word || typeof word !== "object") {
        errors.push(
            createError(
                row,
                null,
                "invalid_word",
                "Word record must be an object."
            )
        );

        return errors;
    }

    if (getNormalizedId(word.id) === null) {
        errors.push(
            createError(
                row,
                "id",
                "invalid_id",
                "ID must be a positive integer."
            )
        );
    }

    for (const field of REQUIRED_TEXT_FIELDS) {
        const value = word[field];

        if (typeof value !== "string") {
            errors.push(
                createError(
                    row,
                    field,
                    "invalid_type",
                    `Field "${field}" must be a text value.`
                )
            );

            continue;
        }

        if (!value.trim()) {
            errors.push(
                createError(
                    row,
                    field,
                    "required_field",
                    `Field "${field}" is not filled in.`
                )
            );
        }
    }

    if (
        typeof word.level === "string" &&
        word.level.trim() &&
        !ALLOWED_LEVELS.has(word.level.trim().toUpperCase())
    ) {
        errors.push(
            createError(
                row,
                "level",
                "invalid_level",
                `Unsupported level "${word.level}". Allowed levels: ${[...ALLOWED_LEVELS].join(", ")}.`
            )
        );
    }

    return errors;
}

function createDuplicateWordKey(word) {
    const values = DUPLICATE_WORD_FIELDS.map(
        field => word[field]
    );

    if (
        values.some(
            value =>
                typeof value !== "string" ||
                !value.trim()
        )
    ) {
        return null;
    }

    return values
        .map(normalizeText)
        .join("|");
}

export class WordValidator {
    // Залишаємо старий метод для сумісності
    // з наявними частинами застосунку.
    static validate(word) {
        const row = word?.rowNumber ?? null;

        const errors = validateWordFields(word, row);

        if (errors.length > 0) {
            logger.error(`Помилка у слові ID=${word?.id}`);

            for (const error of errors) {
                logger.error(error.message);
            }

            return false;
        }

        return true;
    }

    // Перевірка всього словника.
    static validateAll(words) {
        if (!Array.isArray(words)) {
            throw new TypeError(
                "Words must be an array."
            );
        }

        const errors = [];
        const validWords = [];

        const seenIds = new Map();
        const seenWords = new Map();

        for (let index = 0; index < words.length; index++) {
            const word = words[index];
            const row = getRowNumber(word, index);

            const wordErrors = validateWordFields(
                word,
                row
            );

            // Перевірка унікальності ID.
            const normalizedId = getNormalizedId(word?.id);

            if (normalizedId !== null) {
                if (seenIds.has(normalizedId)) {
                    const firstRow = seenIds.get(normalizedId);

                    wordErrors.push(
                        createError(
                            row,
                            "id",
                            "duplicate_id",
                            `ID "${word.id}" is already used in Excel row ${firstRow}.`
                        )
                    );
                } else {
                    seenIds.set(normalizedId, row);
                }
            }

            // Перевірка повторного словникового запису.
            const duplicateKey = createDuplicateWordKey(word ?? {});

            if (duplicateKey !== null) {
                if (seenWords.has(duplicateKey)) {
                    const firstRow = seenWords.get(duplicateKey);

                    wordErrors.push(
                        createError(
                            row,
                            null,
                            "duplicate_word",
                            `This vocabulary entry duplicates the entry in Excel row ${firstRow}.`
                        )
                    );
                } else {
                    seenWords.set(duplicateKey, row);
                }
            }

            if (wordErrors.length > 0) {
                errors.push(...wordErrors);
            } else {
                validWords.push(word);
            }
        }

        if (words.length === 0) {
            errors.push(
                createError(
                    null,
                    null,
                    "no_words",
                    "The Excel worksheet contains no word records."
                )
            );
        }

        return {
            valid: errors.length === 0,
            validWords,
            errors,
            summary: {
                total: words.length,
                valid: validWords.length,
                invalid: words.length - validWords.length,
                errorCount: errors.length,
            },
        };
    }
}