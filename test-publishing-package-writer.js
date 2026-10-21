import assert from "node:assert/strict";
import {
    mkdtemp,
    readFile,
    rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PublishingPackageWriter } from
    "./src/services/PublishingPackageWriter.js";

const metadata = {
    word: "Bicycle",

    platforms: {
        tiktok: {
            caption: 'Learn "Bicycle" in 6 languages!',
            hashtags: [
                "#LanguageLearning",
                "#Bicycle",
            ],
        },

        instagram: {
            caption: "Practice languages every day!",
            hashtags: [
                "#LearnLanguages",
                "#Reels",
            ],
        },

        youtubeShorts: {
            title: "Bicycle in 6 languages | A1 Vocabulary",
            description: "Learn the word Bicycle in six languages.",
            hashtags: [
                "#LanguageLearning",
                "#Shorts",
            ],
        },
    },
};

let tempDirectory;

try {
    // Створюємо тимчасову папку для тесту.
    // Реальні файли проєкту не змінюються.
    tempDirectory = await mkdtemp(
        path.join(tmpdir(), "publishing-package-writer-")
    );

    console.log("▶ Testing PublishingPackageWriter...");

    const result = await PublishingPackageWriter.save(
        metadata,
        tempDirectory
    );

    // Перевіряємо створення папки для слова.
    assert.equal(
        result.directory,
        path.join(tempDirectory, "Bicycle")
    );

    // Перевіряємо наявність усіх трьох файлів.
    assert.deepEqual(
        Object.keys(result.files).sort(),
        [
            "instagram.txt",
            "tiktok.txt",
            "youtube-shorts.txt",
        ].sort()
    );

    console.log("✅ Publishing files created");

    // Перевіряємо TikTok.
    const tiktok = await readFile(
        result.files["tiktok.txt"],
        "utf8"
    );

    assert.ok(tiktok.includes('Learn "Bicycle"'));
    assert.ok(tiktok.includes("#LanguageLearning"));
    assert.ok(tiktok.includes("#Bicycle"));

    console.log("✅ TikTok content verified");

    // Перевіряємо Instagram.
    const instagram = await readFile(
        result.files["instagram.txt"],
        "utf8"
    );

    assert.ok(
        instagram.includes("Practice languages every day!")
    );
    assert.ok(instagram.includes("#LearnLanguages"));
    assert.ok(instagram.includes("#Reels"));

    console.log("✅ Instagram content verified");

    // Перевіряємо YouTube Shorts.
    const youtube = await readFile(
        result.files["youtube-shorts.txt"],
        "utf8"
    );

    assert.ok(
        youtube.includes(
            "Bicycle in 6 languages | A1 Vocabulary"
        )
    );
    assert.ok(
        youtube.includes(
            "Learn the word Bicycle in six languages."
        )
    );
    assert.ok(youtube.includes("#Shorts"));

    console.log("✅ YouTube Shorts content verified");

    // Перевіряємо реакцію на некоректні дані.
    await assert.rejects(
        () => PublishingPackageWriter.save(
            { word: "Bicycle" },
            tempDirectory
        ),
        /Metadata must contain all three platforms/
    );

    await assert.rejects(
        () => PublishingPackageWriter.save(
            { ...metadata, word: "   " },
            tempDirectory
        ),
        /non-empty word/
    );

    console.log("✅ Invalid metadata validation passed");
    console.log("\n✅ Publishing package writer tests passed.");
} catch (error) {
    console.error("\n❌ Publishing package writer tests failed.");
    console.error(error);
    process.exitCode = 1;
} finally {
    // Видаляємо тимчасові тестові файли.
    if (tempDirectory) {
        await rm(tempDirectory, {
            recursive: true,
            force: true,
        });
    }
}