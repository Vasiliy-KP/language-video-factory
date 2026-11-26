
import assert from "node:assert/strict";
import {
    mkdtemp,
    mkdir,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import path from "node:path";

import { PublishingReadinessService } from
    "./src/services/PublishingReadinessService.js";
import {
    PublishingMetadataService,
} from "./src/services/PublishingMetadataService.js";

const validVideo = {
    containerFormats: ["mp4"],
    durationSeconds: 20,
    fileSizeBytes: 500_000,
    videoCodec: "h264",
    width: 1080,
    height: 1920,
    frameRate: 30,
    hasAudio: true,
    audioCodec: "aac",
    audioSampleRate: 48000,
    integrity: {
        checked: true,
        valid: true,
    },
};

const platformFiles = {
    tiktok: "tiktok.txt",
    instagram: "instagram.txt",
    youtubeShorts: "youtube-shorts.txt",
};

const wordData = {
    category: "Transport",
    level: "A1",
    uk: "велосипед",
    en: "Bicycle",
    pl: "Rower",
    fr: "Vélo",
    de: "Fahrrad",
    es: "Bicicleta",
};

const metadata = PublishingMetadataService.create(wordData);

function buildPlatformFileContent(sourceMetadata, platformName) {
    const platform = sourceMetadata.platforms[platformName];

    if (platformName === "youtubeShorts") {
        return [
            "TITLE",
            platform.title,
            "",
            "DESCRIPTION",
            platform.description,
            "",
            "HASHTAGS",
            platform.hashtags.join(" "),
        ].join("\n");
    }

    return [
        platform.caption.trim(),
        platform.hashtags.join(" "),
    ]
        .filter(Boolean)
        .join("\n\n");
}

let tempRoot;

try {
    // Тимчасова папка на тому самому диску, що й проєкт.
    tempRoot = await mkdtemp(
        path.join(process.cwd(), ".publishing-readiness-test-")
    );

    const packageDirectory = "output/publishing/Bicycle";
    const packagePath = path.join(tempRoot, packageDirectory);

    const videoPath = path.join(
        tempRoot,
        "output",
        "videos",
        "bicycle.mp4"
    );

    const metadataPath = path.join(
        tempRoot,
        "output",
        "metadata",
        "Bicycle.json"
    );

    await mkdir(packagePath, { recursive: true });
    await mkdir(path.dirname(videoPath), { recursive: true });
    await mkdir(path.dirname(metadataPath), { recursive: true });

    // Створюємо тестові файли. Це не справжнє відео.
    await writeFile(videoPath, "fake video", "utf8");

    await writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        "utf8"
    );

    for (const [platform, fileName] of Object.entries(platformFiles)) {
        await writeFile(
            path.join(packagePath, fileName),
            buildPlatformFileContent(metadata, platform),
            "utf8"
        );
    }

    const manifest = {
        schemaVersion: 1,
        word: "Bicycle",
        category: "Transport",
        level: "A1",
        status: "ready_for_review",
        assets: {
            video: {
                path: path.relative(tempRoot, videoPath),
                exists: true,
            },
            metadata: {
                path: path.relative(tempRoot, metadataPath),
                exists: true,
            },
        },
        platforms: {
            tiktok: {
                file: platformFiles.tiktok,
                ready: true,
            },
            instagram: {
                file: platformFiles.instagram,
                ready: true,
            },
            youtubeShorts: {
                file: platformFiles.youtubeShorts,
                ready: true,
            },
        },
    };

    const manifestPath = path.join(packagePath, "manifest.json");

    await writeFile(
        manifestPath,
        JSON.stringify(manifest, null, 2),
        "utf8"
    );

    console.log("▶ Testing PublishingReadinessService...");

    // 1. Усі матеріали та параметри відео відповідають правилам.
    let receivedProbeArguments;

    const readyReport = await PublishingReadinessService.check(
        packageDirectory,
        {
            projectRoot: tempRoot,
            probe: async (options) => {
                receivedProbeArguments = options;
                return { ...validVideo };
            },
        }
    );

    assert.equal(receivedProbeArguments.projectRoot, tempRoot);
    assert.equal(receivedProbeArguments.videoPath, videoPath);

    assert.equal(readyReport.status, "ready_for_review");
    assert.equal(readyReport.errors.length, 0);
    assert.equal(readyReport.checks.video.exists, true);
    assert.equal(readyReport.checks.metadata.validJson, true);

    assert.equal(readyReport.checks.content.valid, true);

    assert.equal(
        readyReport.checks.content.errors.length,
        0
    );

    console.log("✅ Publishing content passed validation");

    for (const platform of Object.keys(platformFiles)) {
        assert.equal(
            readyReport.platforms[platform].status,
            "ready_for_review"
        );

        assert.equal(
            readyReport.platforms[platform].errors.length,
            0
        );
    }

    const readinessPath = path.join(
        packagePath,
        "readiness.json"
    );

    const savedReadiness = JSON.parse(
        await readFile(readinessPath, "utf8")
    );

    assert.deepEqual(savedReadiness, readyReport);

    console.log("✅ readiness.json was saved and verified");

    console.log("✅ Valid package passed all platform checks");

    // Перевіряємо, що змінений текстовий файл блокує готовність.
    const tiktokPath = path.join(
        packagePath,
        platformFiles.tiktok
    );

    const originalTiktokContent = await readFile(
        tiktokPath,
        "utf8"
    );

    await writeFile(
        tiktokPath,
        "Incorrect publishing content",
        "utf8"
    );

    const mismatchedContentReport =
        await PublishingReadinessService.check(
            packageDirectory,
            {
                projectRoot: tempRoot,
                probe: async () => ({ ...validVideo }),
            }
        );

    assert.equal(
        mismatchedContentReport.status,
        "needs_fixes"
    );

    assert.ok(
        mismatchedContentReport.platforms.tiktok.errors.some(
            (error) => error.code === "platform_file_mismatch"
        )
    );

    assert.equal(
        mismatchedContentReport.platforms.instagram.status,
        "ready_for_review"
    );

    await writeFile(
        tiktokPath,
        originalTiktokContent,
        "utf8"
    );

    console.log("✅ Publishing file mismatch blocks only affected platform");

    // Понад 60 хештегів YouTube має створювати попередження,
    // але не блокувати готовність пакета.
    const metadataWithWarnings = structuredClone(metadata);

    metadataWithWarnings.platforms.youtubeShorts.hashtags =
        Array.from(
            { length: 61 },
            (_, index) => `#Tag${index}`
        );

    await writeFile(
        metadataPath,
        JSON.stringify(metadataWithWarnings, null, 2),
        "utf8"
    );

    await writeFile(
        path.join(
            packagePath,
            platformFiles.youtubeShorts
        ),
        buildPlatformFileContent(
            metadataWithWarnings,
            "youtubeShorts"
        ),
        "utf8"
    );

    const warningReport =
        await PublishingReadinessService.check(
            packageDirectory,
            {
                projectRoot: tempRoot,
                probe: async () => ({ ...validVideo }),
            }
        );

    assert.equal(
        warningReport.status,
        "ready_for_review"
    );

    assert.ok(
        warningReport.warnings.some(
            (warning) =>
                warning.code === "hashtag_limit_exceeded" &&
                warning.platform === "youtubeShorts"
        )
    );

    assert.equal(
        warningReport.platforms.youtubeShorts.status,
        "ready_for_review"
    );

    // Повертаємо початкові метадані та текст YouTube.
    await writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        "utf8"
    );

    await writeFile(
        path.join(
            packagePath,
            platformFiles.youtubeShorts
        ),
        buildPlatformFileContent(metadata, "youtubeShorts"),
        "utf8"
    );

    console.log("✅ Non-blocking content warnings are handled correctly");

    // 2. Перевіряємо реакцію на пошкоджене відео.
    const corruptedIntegrityReport =
        await PublishingReadinessService.check(
            packageDirectory,
            {
                projectRoot: tempRoot,
                probe: async () => ({
                    ...validVideo,
                    integrity: {
                        checked: true,
                        valid: false,
                    },
                }),
            }
        );

    assert.equal(
        corruptedIntegrityReport.status,
        "needs_fixes"
    );

    assert.equal(
        corruptedIntegrityReport.checks.video.integrity.valid,
        false
    );

    assert.ok(
        corruptedIntegrityReport.errors.some(
            (error) =>
                error.code === "video_integrity_check_failed"
        )
    );

    for (
        const platform of Object.values(
            corruptedIntegrityReport.platforms
        )
    ) {
        assert.equal(platform.status, "needs_fixes");
    }

    console.log("✅ Failed video integrity check was detected");

    // 3. Імітуємо відео з непідтримуваним кодеком,
    // низькою частотою кадрів, без аудіо та з великою тривалістю.
    const invalidVideo = {
        ...validVideo,
        durationSeconds: 240,
        videoCodec: "mpeg4",
        frameRate: 15,
        hasAudio: false,
        audioCodec: null,
        audioSampleRate: null,
    };

    const invalidReport = await PublishingReadinessService.check(
        packageDirectory,
        {
            projectRoot: tempRoot,
            probe: async () => ({ ...invalidVideo }),
        }
    );

    assert.equal(invalidReport.status, "needs_fixes");

    assert.ok(
        invalidReport.platforms.tiktok.errors.some(
            (error) => error.code === "unsupported_video_codec"
        )
    );

    assert.ok(
        invalidReport.platforms.instagram.errors.some(
            (error) => error.code === "unsupported_audio_codec"
        )
    );

    assert.ok(
        invalidReport.platforms.youtubeShorts.errors.some(
            (error) => error.code === "duration_too_long"
        )
    );

    console.log("✅ Invalid video was flagged for fixes");

    // 4. Перевіряємо відсутній текстовий файл платформи.
    await rm(
        path.join(packagePath, platformFiles.instagram)
    );

    const missingTextReport =
        await PublishingReadinessService.check(
            packageDirectory,
            {
                projectRoot: tempRoot,
                probe: async () => ({ ...validVideo }),
            }
        );

    assert.equal(missingTextReport.status, "needs_fixes");

    assert.ok(
        missingTextReport.errors.some(
            (error) =>
                error.code === "platform_file_missing" &&
                error.message.includes("instagram.txt")
        )
    );

    console.log("✅ Missing platform file was detected");

    // 5. Перевіряємо відсутнє відео.
    await rm(videoPath);

    const missingVideoReport =
        await PublishingReadinessService.check(
            packageDirectory,
            {
                projectRoot: tempRoot,
                probe: async () => ({ ...validVideo }),
            }
        );

    assert.equal(missingVideoReport.status, "needs_fixes");

    assert.ok(
        missingVideoReport.errors.some(
            (error) => error.code === "video_missing"
        )
    );

    assert.ok(
        missingVideoReport.errors.some(
            (error) => error.code === "video_manifest_mismatch"
        )
    );

    console.log("✅ Missing video was detected");

    // 6. Перевіряємо відсутній маніфест.
    const missingManifestReport =
        await PublishingReadinessService.check(
            "output/publishing/DoesNotExist",
            { projectRoot: tempRoot }
        );

    assert.equal(missingManifestReport.status, "needs_fixes");

    assert.ok(
        missingManifestReport.errors.some(
            (error) => error.code === "manifest_missing"
        )
    );

    console.log("✅ Missing manifest was detected");

    console.log(
        "\n✅ Publishing readiness service tests passed."
    );
} catch (error) {
    console.error("\n❌ Publishing readiness service tests failed.");
    console.error(error);
    process.exitCode = 1;
} finally {
    if (tempRoot) {
        await rm(tempRoot, {
            recursive: true,
            force: true,
        });
    }
}
