const LANGUAGES = [
    { code: "uk", label: "Українська", flag: "🇺🇦" },
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "pl", label: "Polski", flag: "🇵🇱" },
    { code: "fr", label: "Français", flag: "🇫🇷" },
    { code: "de", label: "Deutsch", flag: "🇩🇪" },
    { code: "es", label: "Español", flag: "🇪🇸" },
];

function requiredString(value, field) {
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(
            `Field "${field}" must be a non-empty string.`
        );
    }

    return value.trim();
}

function createHashtag(value) {
    const words = value
        .normalize("NFKC")
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);

    if (words.length === 0) {
        return "";
    }

    const hashtag = words
        .map(word => word[0].toUpperCase() + word.slice(1))
        .join("");

    return `#${hashtag}`;
}

function uniqueHashtags(values) {
    return [...new Set(values.filter(Boolean))];
}

export class PublishingMetadataService {
    static create(word) {
        if (!word || typeof word !== "object") {
            throw new TypeError("Word must be an object.");
        }

        const category = requiredString(
            word.category,
            "category"
        );

        const level = requiredString(word.level, "level");

        const translations = LANGUAGES.map(language => ({
            code: language.code,
            label: language.label,
            flag: language.flag,
            value: requiredString(
                word[language.code],
                language.code
            ),
        }));

        const englishWord = translations.find(
            language => language.code === "en"
        ).value;

        const translationText = translations
            .map(
                language =>
                    `${language.flag} ${language.label}: ${language.value}`
            )
            .join("\n");

        const caption =
            `Learn "${englishWord}" in 6 languages 🌍\n\n` +
            `${translationText}`;

        const commonHashtags = [
            "#LanguageLearning",
            "#LearnLanguages",
            "#Vocabulary",
            createHashtag(englishWord),
            createHashtag(category),
            createHashtag(level),
        ];

        return {
            word: englishWord,
            category,
            level,
            translations,
            platforms: {
                tiktok: {
                    caption:
                        `${caption}\n\nSave this word to practice later!`,
                    hashtags: uniqueHashtags([
                        ...commonHashtags,
                        "#LearnEnglish",
                    ]),
                },

                instagram: {
                    caption:
                        `${caption}\n\nPractice a little every day ✨`,
                    hashtags: uniqueHashtags([
                        ...commonHashtags,
                        "#Multilingual",
                        "#Reels",
                    ]),
                },

                youtubeShorts: {
                    title:
                        `${englishWord} in 6 languages | ` +
                        `${level} Vocabulary`,
                    description:
                        `${caption}\n\nLearn new words every day.`,
                    hashtags: uniqueHashtags([
                        ...commonHashtags,
                        "#Shorts",
                    ]),
                },
            },
        };
    }
}