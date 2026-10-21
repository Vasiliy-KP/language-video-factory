import assert from "node:assert/strict";

import {
    PublishingMetadataService,
} from "./src/services/PublishingMetadataService.js";

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

// Основні дані слова
assert.equal(metadata.word, "Bicycle");
assert.equal(metadata.category, "Transport");
assert.equal(metadata.level, "A1");

// Усі шість мов
assert.equal(metadata.translations.length, 6);
assert.deepEqual(
    metadata.translations.map(item => item.code),
    ["uk", "en", "pl", "fr", "de", "es"]
);

// Переклад присутній в описі
assert.ok(
    metadata.platforms.tiktok.caption.includes("велосипед")
);

assert.ok(
    metadata.platforms.tiktok.caption.includes("Bicicleta")
);

// Хештеги
assert.ok(
    metadata.platforms.tiktok.hashtags.includes("#Bicycle")
);

assert.ok(
    metadata.platforms.instagram.hashtags.includes("#Reels")
);

assert.ok(
    metadata.platforms.youtubeShorts.hashtags.includes("#Shorts")
);

// YouTube має заголовок та опис
assert.ok(metadata.platforms.youtubeShorts.title.length > 0);
assert.ok(metadata.platforms.youtubeShorts.description.length > 0);

// Відсутній переклад має викликати зрозумілу помилку
assert.throws(
    () =>
        PublishingMetadataService.create({
            ...word,
            es: "",
        }),
    /es/
);

console.log("✅ Publishing metadata tests passed.");