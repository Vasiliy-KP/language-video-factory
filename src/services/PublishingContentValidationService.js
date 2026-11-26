const REQUIRED_LANGUAGES = [
    "uk",
    "en",
    "pl",
    "fr",
    "de",
    "es",
];

const PLATFORM_CONFIG = {
    tiktok: {
        maxCaptionLength: 2200,
        countCharacters: (value) => Array.from(value).length,
    },

    instagram: {
        maxCaptionLength: 2200,
        maxHashtags: 5,
        countCharacters: (value) => Array.from(value).length,
    },

    youtubeShorts: {
        maxTitleLength: 100,
        maxDescriptionLength: 5000,
        maxHashtags: 60,
        countCharacters: (value) => Array.from(value).length,
    },
};

const HASHTAG_PATTERN = /^#[\p{L}\p{N}_]+$/u;

function createIssue(code, field, message) {
    return {
        code,
        field,
        message,
    };
}

function normalizeText(value) {
    return value
        .normalize("NFKC")
        .trim()
        .toLowerCase();
}

function normalizeFileContent(value) {
    return value
        .replace(/\r\n/g, "\n")
        .trimEnd();
}

function formatHashtags(platform) {
    if (!Array.isArray(platform?.hashtags)) {
        return "";
    }

    return platform.hashtags
        .filter((hashtag) => typeof hashtag === "string")
        .join(" ");
}

function formatCaption(platform) {
    const caption =
        typeof platform?.caption === "string"
            ? platform.caption.trim()
            : "";

    return [
        caption,
        formatHashtags(platform),
    ]
        .filter(Boolean)
        .join("\n\n");
}

function formatYouTubeContent(platform) {
    const title =
        typeof platform?.title === "string"
            ? platform.title
            : "";

    const description =
        typeof platform?.description === "string"
            ? platform.description
            : "";

    return [
        "TITLE",
        title,
        "",
        "DESCRIPTION",
        description,
        "",
        "HASHTAGS",
        formatHashtags(platform),
    ].join("\n");
}

function formatExpectedContent(platformName, platform) {
    if (platformName === "youtubeShorts") {
        return formatYouTubeContent(platform);
    }

    return formatCaption(platform);
}

function validateTranslations(metadata) {
    const errors = [];
    const translations = new Map();

    if (!Array.isArray(metadata.translations)) {
        errors.push(
            createIssue(
                "invalid_translations",
                "translations",
                "Translations must be an array."
            )
        );

        return {
            errors,
            translations,
        };
    }

    const seenCodes = new Set();

    for (const translation of metadata.translations) {
        if (!translation || typeof translation !== "object") {
            errors.push(
                createIssue(
                    "invalid_translation",
                    "translations",
                    "Every translation must be an object."
                )
            );

            continue;
        }

        const { code, label, flag, value } = translation;

        if (
            typeof code !== "string" ||
            !REQUIRED_LANGUAGES.includes(code)
        ) {
            errors.push(
                createIssue(
                    "unsupported_language",
                    "translations",
                    `Unsupported translation language: ${code ?? "unknown"}.`
                )
            );

            continue;
        }

        if (seenCodes.has(code)) {
            errors.push(
                createIssue(
                    "duplicate_language",
                    "translations",
                    `Duplicate translation language: ${code}.`
                )
            );

            continue;
        }

        seenCodes.add(code);

        if (
            typeof label !== "string" ||
            !label.trim() ||
            typeof flag !== "string" ||
            !flag.trim() ||
            typeof value !== "string" ||
            !value.trim()
        ) {
            errors.push(
                createIssue(
                    "incomplete_translation",
                    code,
                    `Translation "${code}" is incomplete.`
                )
            );

            continue;
        }

        translations.set(code, translation);
    }

    for (const code of REQUIRED_LANGUAGES) {
        if (!seenCodes.has(code)) {
            errors.push(
                createIssue(
                    "missing_translation",
                    code,
                    `Required translation "${code}" is missing.`
                )
            );
        }
    }

    if (typeof metadata.word === "string" &&
        metadata.word.trim() &&
        translations.has("en")) {
        if (
            normalizeText(metadata.word) !==
            normalizeText(translations.get("en").value)
        ) {
            errors.push(
                createIssue(
                    "word_translation_mismatch",
                    "word",
                    "Metadata word does not match the English translation."
                )
            );
        }
    }

    return {
        errors,
        translations,
    };
}

function validateHashtags(
    platformName,
    hashtags,
    errors,
    warnings
) {
    if (!Array.isArray(hashtags)) {
        errors.push(
            createIssue(
                "invalid_hashtags",
                "hashtags",
                "Hashtags must be an array."
            )
        );

        return;
    }

    if (hashtags.length === 0) {
        warnings.push(
            createIssue(
                "hashtags_missing",
                "hashtags",
                "No hashtags have been provided."
            )
        );
    }

    const seen = new Set();

    for (let index = 0; index < hashtags.length; index++) {
        const hashtag = hashtags[index];

        if (
            typeof hashtag !== "string" ||
            !HASHTAG_PATTERN.test(hashtag.normalize("NFKC"))
        ) {
            errors.push(
                createIssue(
                    "invalid_hashtag",
                    `hashtags[${index}]`,
                    `Invalid hashtag: ${String(hashtag)}.`
                )
            );

            continue;
        }

        const normalized = normalizeText(hashtag);

        if (seen.has(normalized)) {
            errors.push(
                createIssue(
                    "duplicate_hashtag",
                    `hashtags[${index}]`,
                    `Duplicate hashtag: ${hashtag}.`
                )
            );
        } else {
            seen.add(normalized);
        }
    }

    const limit = PLATFORM_CONFIG[platformName].maxHashtags;

    if (limit !== undefined && hashtags.length > limit) {
        const issue = createIssue(
            "hashtag_limit_exceeded",
            "hashtags",
            `Maximum ${limit} hashtags are allowed for ${platformName}. Found: ${hashtags.length}.`
        );

        if (platformName === "youtubeShorts") {
            warnings.push(issue);
        } else {
            errors.push(issue);
        }
    }
}

function validateTranslationsInText(
    translations,
    content,
    field,
    errors
) {
    for (const code of REQUIRED_LANGUAGES) {
        const translation = translations.get(code);

        if (!translation) {
            continue;
        }

        const expectedLine =
            `${translation.flag} ${translation.label}: ${translation.value}`;

        if (!content.includes(expectedLine)) {
            errors.push(
                createIssue(
                    "translation_missing_from_content",
                    field,
                    `Translation "${code}" is missing or does not match metadata.`
                )
            );
        }
    }
}

function validatePlatform({
    platformName,
    metadata,
    translations,
    platformContents,
}) {
    const errors = [];
    const warnings = [];

    const platform = metadata.platforms?.[platformName];
    const config = PLATFORM_CONFIG[platformName];

    if (!platform || typeof platform !== "object") {
        errors.push(
            createIssue(
                "platform_metadata_missing",
                platformName,
                `Metadata for ${platformName} is missing.`
            )
        );

        return {
            status: "needs_fixes",
            errors,
            warnings,
        };
    }

    validateHashtags(
        platformName,
        platform.hashtags,
        errors,
        warnings
    );

    if (platformName === "youtubeShorts") {
        if (
            typeof platform.title !== "string" ||
            !platform.title.trim()
        ) {
            errors.push(
                createIssue(
                    "title_missing",
                    "title",
                    "YouTube title is required."
                )
            );
        } else {
            const titleLength = config.countCharacters(platform.title);

            if (titleLength > config.maxTitleLength) {
                errors.push(
                    createIssue(
                        "title_too_long",
                        "title",
                        `YouTube title exceeds ${config.maxTitleLength} characters.`
                    )
                );
            }

            if (/[<>]/.test(platform.title)) {
                errors.push(
                    createIssue(
                        "invalid_title_characters",
                        "title",
                        "YouTube title cannot contain < or >."
                    )
                );
            }

            if (
                typeof metadata.word === "string" &&
                !normalizeText(platform.title).includes(
                    normalizeText(metadata.word)
                )
            ) {
                errors.push(
                    createIssue(
                        "title_word_mismatch",
                        "title",
                        "YouTube title does not contain the vocabulary word."
                    )
                );
            }

            if (
                typeof metadata.level === "string" &&
                !platform.title.includes(metadata.level)
            ) {
                warnings.push(
                    createIssue(
                        "title_level_missing",
                        "title",
                        "Consider including the vocabulary level in the YouTube title."
                    )
                );
            }
        }

        if (
            typeof platform.description !== "string" ||
            !platform.description.trim()
        ) {
            errors.push(
                createIssue(
                    "description_missing",
                    "description",
                    "YouTube description is required."
                )
            );
        } else {
            const descriptionWithHashtags = [
                platform.description.trim(),
                Array.isArray(platform.hashtags)
                    ? platform.hashtags.join(" ")
                    : "",
            ]
                .filter(Boolean)
                .join("\n\n");

            const descriptionLength = config.countCharacters(
                descriptionWithHashtags
            );

            if (descriptionLength > config.maxDescriptionLength) {
                errors.push(
                    createIssue(
                        "description_too_long",
                        "description",
                        `YouTube description exceeds ${config.maxDescriptionLength} characters.`
                    )
                );
            }

            if (/[<>]/.test(platform.description)) {
                errors.push(
                    createIssue(
                        "invalid_description_characters",
                        "description",
                        "YouTube description cannot contain < or >."
                    )
                );
            }

            validateTranslationsInText(
                translations,
                platform.description,
                "description",
                errors
            );
        }
    } else {
        if (
            typeof platform.caption !== "string" ||
            !platform.caption.trim()
        ) {
            errors.push(
                createIssue(
                    "caption_missing",
                    "caption",
                    `${platformName} caption is required.`
                )
            );
        } else {
            validateTranslationsInText(
                translations,
                platform.caption,
                "caption",
                errors
            );

            const completeCaption = formatCaption(platform);

            const captionLength = config.countCharacters(
                completeCaption
            );

            if (captionLength > config.maxCaptionLength) {
                errors.push(
                    createIssue(
                        "caption_too_long",
                        "caption",
                        `${platformName} caption exceeds ${config.maxCaptionLength} characters.`
                    )
                );
            }
        }
    }

    const expectedContent =
        formatExpectedContent(platformName, platform);

    const actualContent = platformContents?.[platformName];

    if (typeof actualContent !== "string") {
        errors.push(
            createIssue(
                "platform_file_missing",
                "file",
                `Publishing content file for ${platformName} is missing.`
            )
        );
    } else if (
        normalizeFileContent(actualContent) !==
        normalizeFileContent(expectedContent)
    ) {
        errors.push(
            createIssue(
                "platform_file_mismatch",
                "file",
                `Publishing content file for ${platformName} does not match metadata.json.`
            )
        );
    }

    return {
        status: errors.length > 0
            ? "needs_fixes"
            : "ready_for_review",
        errors,
        warnings,
    };
}

export class PublishingContentValidationService {
    static validate({
        metadata,
        platformContents = {},
    } = {}) {
        const errors = [];
        const warnings = [];
        const platforms = {};

        if (
            !metadata ||
            typeof metadata !== "object" ||
            Array.isArray(metadata)
        ) {
            return {
                valid: false,
                errors: [
                    createIssue(
                        "invalid_metadata",
                        "metadata",
                        "Metadata must be an object."
                    ),
                ],
                warnings,
                platforms,
            };
        }

        if (
            typeof metadata.word !== "string" ||
            !metadata.word.trim()
        ) {
            errors.push(
                createIssue(
                    "word_missing",
                    "word",
                    "Metadata word is required."
                )
            );
        }

        if (
            typeof metadata.category !== "string" ||
            !metadata.category.trim()
        ) {
            errors.push(
                createIssue(
                    "category_missing",
                    "category",
                    "Metadata category is required."
                )
            );
        }

        if (
            typeof metadata.level !== "string" ||
            !metadata.level.trim()
        ) {
            errors.push(
                createIssue(
                    "level_missing",
                    "level",
                    "Metadata level is required."
                )
            );
        }

        const translationResult = validateTranslations(metadata);

        errors.push(...translationResult.errors);

        for (const platformName of Object.keys(PLATFORM_CONFIG)) {
            const result = validatePlatform({
                platformName,
                metadata,
                translations: translationResult.translations,
                platformContents,
            });

            platforms[platformName] = result;

            warnings.push(
                ...result.warnings.map((warning) => ({
                    platform: platformName,
                    ...warning,
                }))
            );
        }

        return {
            valid:
                errors.length === 0 &&
                Object.values(platforms).every(
                    (platform) => platform.status === "ready_for_review"
                ),

            errors,
            warnings,
            platforms,
        };
    }
}