import assert from "node:assert/strict";

import {
    PublishingMetadataService,
} from "./src/services/PublishingMetadataService.js";

import {
    PublishingContentValidationService,
} from "./src/services/PublishingContentValidationService.js";

const word = {
    category: "Transport",
    level: "A1",
    uk: "велосипед",
    en: "Bicycle",
    pl: "Rower",
    fr: "Vélo",
    de: "Fahrrad",
    es: "Bicicleta",
};

const metadata = PublishingMetadataService.create(word);

function clone(value) {
    return structuredClone(value);
}

function buildPlatformContents(source) {
    const { tiktok, instagram, youtubeShorts } = source.platforms;

    return {
        tiktok: [
            tiktok.caption.trim(),
            tiktok.hashtags.join(" "),
        ].filter(Boolean).join("\n\n"),

        instagram: [
            instagram.caption.trim(),
            instagram.hashtags.join(" "),
        ].filter(Boolean).join("\n\n"),

        youtubeShorts: [
            "TITLE",
            youtubeShorts.title,
            "",
            "DESCRIPTION",
            youtubeShorts.description,
            "",
            "HASHTAGS",
            youtubeShorts.hashtags.join(" "),
        ].join("\n"),
    };
}

function validate(source = metadata) {
    return PublishingContentValidationService.validate({
        metadata: source,
        platformContents: buildPlatformContents(source),
    });
}

function hasError(result, code, platform) {
    const errors = platform
        ? result.platforms[platform].errors
        : result.errors;

    return errors.some((error) => error.code === code);
}

console.log("▶ Testing PublishingContentValidationService...");

// 1. Правильний контент.
const validResult = validate();

assert.equal(validResult.valid, true);

for (const platform of Object.values(validResult.platforms)) {
    assert.equal(platform.status, "ready_for_review");
    assert.equal(platform.errors.length, 0);
}

console.log("✅ Valid publishing content is accepted");

// 2. Усі шість перекладів присутні.
const missingTranslation = clone(metadata);

missingTranslation.translations =
    missingTranslation.translations.filter(
        (translation) => translation.code !== "es"
    );

const translationResult = validate(missingTranslation);

assert.equal(translationResult.valid, false);
assert.ok(hasError(translationResult, "missing_translation"));

console.log("✅ Missing translations are detected");

// 3. Англійське слово відповідає metadata.word.
const mismatchedWord = clone(metadata);
mismatchedWord.word = "Cycle";

const mismatchResult = validate(mismatchedWord);

assert.ok(
    hasError(mismatchResult, "word_translation_mismatch")
);

console.log("✅ Word and English translation mismatch is detected");

// Metadata word with an invalid type must not crash validation.
const invalidMetadataWord = clone(metadata);
invalidMetadataWord.word = 123;

const invalidWordResult = validate(invalidMetadataWord);

assert.equal(invalidWordResult.valid, false);
assert.ok(
    hasError(invalidWordResult, "word_missing")
);

console.log("✅ Invalid metadata word type is handled safely");

// 4. Перевірка неправильного формату хештега.
const malformedHashtag = clone(metadata);

malformedHashtag.platforms.tiktok.hashtags[0] =
    "#Language Learning";

const malformedResult = validate(malformedHashtag);

assert.ok(
    hasError(malformedResult, "invalid_hashtag", "tiktok")
);

console.log("✅ Invalid hashtag format is detected");

// 5. Дублікати хештегів без урахування регістру.
const duplicateHashtag = clone(metadata);

duplicateHashtag.platforms.tiktok.hashtags = [
    "#Bicycle",
    "#bicycle",
];

const duplicateResult = validate(duplicateHashtag);

assert.ok(
    hasError(duplicateResult, "duplicate_hashtag", "tiktok")
);

console.log("✅ Duplicate hashtags are detected");

// 6. Обмеження Instagram.
const tooManyInstagramHashtags = clone(metadata);

tooManyInstagramHashtags.platforms.instagram.hashtags.push(
    "#ExtraTag"
);

const instagramHashtagResult =
    validate(tooManyInstagramHashtags);

assert.ok(
    hasError(
        instagramHashtagResult,
        "hashtag_limit_exceeded",
        "instagram"
    )
);

console.log("✅ Instagram hashtag limit is enforced");

// 7. Обмеження TikTok caption.
const longTikTokCaption = clone(metadata);

longTikTokCaption.platforms.tiktok.caption +=
    "x".repeat(2300);

const tiktokLengthResult = validate(longTikTokCaption);

assert.ok(
    hasError(
        tiktokLengthResult,
        "caption_too_long",
        "tiktok"
    )
);

console.log("✅ TikTok caption length is checked");

// 8. Обмеження Instagram caption.
const longInstagramCaption = clone(metadata);

longInstagramCaption.platforms.instagram.caption +=
    "x".repeat(2300);

const instagramLengthResult = validate(longInstagramCaption);

assert.ok(
    hasError(
        instagramLengthResult,
        "caption_too_long",
        "instagram"
    )
);

console.log("✅ Instagram caption length is checked");

// 9. Обмеження YouTube title.
const longYouTubeTitle = clone(metadata);

longYouTubeTitle.platforms.youtubeShorts.title =
    "Bicycle " + "A".repeat(110);

const youtubeTitleResult = validate(longYouTubeTitle);

assert.ok(
    hasError(
        youtubeTitleResult,
        "title_too_long",
        "youtubeShorts"
    )
);

console.log("✅ YouTube title length is checked");

// 10. Обмеження YouTube description.
const longYouTubeDescription = clone(metadata);

longYouTubeDescription.platforms.youtubeShorts.description +=
    "x".repeat(5100);

const youtubeDescriptionResult = validate(
    longYouTubeDescription
);

assert.ok(
    hasError(
        youtubeDescriptionResult,
        "description_too_long",
        "youtubeShorts"
    )
);

console.log("✅ YouTube description length is checked");

// 11. Понад 60 хештегів YouTube — попередження.
const manyYouTubeHashtags = clone(metadata);

manyYouTubeHashtags.platforms.youtubeShorts.hashtags =
    Array.from(
        { length: 61 },
        (_, index) => `#Tag${index}`
    );

const youtubeHashtagResult = validate(manyYouTubeHashtags);

assert.equal(youtubeHashtagResult.valid, true);

assert.ok(
    youtubeHashtagResult.platforms.youtubeShorts.warnings.some(
        (warning) => warning.code === "hashtag_limit_exceeded"
    )
);

console.log("✅ YouTube hashtag overflow produces a warning");

// 12. Файл не відповідає metadata.json.
const incorrectFiles = buildPlatformContents(metadata);

incorrectFiles.tiktok = "Different text";

const fileMismatchResult =
    PublishingContentValidationService.validate({
        metadata,
        platformContents: incorrectFiles,
    });

assert.ok(
    hasError(fileMismatchResult, "platform_file_mismatch", "tiktok")
);

console.log("✅ Publishing file mismatch is detected");

// 13. Некоректний тип hashtags не повинен ламати валідатор.
const malformedHashtags = clone(metadata);

malformedHashtags.platforms.tiktok.hashtags = "not-an-array";

const malformedHashtagsResult =
    PublishingContentValidationService.validate({
        metadata: malformedHashtags,
        platformContents: buildPlatformContents(metadata),
    });

assert.ok(
    hasError(
        malformedHashtagsResult,
        "invalid_hashtags",
        "tiktok"
    )
);

console.log("✅ Invalid hashtag type is handled safely");

// 14. Некоректний тип caption не повинен ламати валідатор.
const malformedCaption = clone(metadata);

malformedCaption.platforms.instagram.caption = 123;

const malformedCaptionResult =
    PublishingContentValidationService.validate({
        metadata: malformedCaption,
        platformContents: buildPlatformContents(metadata),
    });

assert.ok(
    hasError(
        malformedCaptionResult,
        "caption_missing",
        "instagram"
    )
);

console.log("✅ Invalid caption type is handled safely");

console.log(
    "\n✅ All PublishingContentValidationService tests passed."
);