
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
};

const platformFiles = {
    tiktok: "tiktok.txt",
    instagram: "instagram.txt",
    youtubeShorts: "youtube-shorts.txt",
};

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
        JSON.stringify({ word: "Bicycle" }, null, 2),
        "utf8"
    );

    for (const fileName of Object.values(platformFiles)) {
        await writeFile(
            path.join(packagePath, fileName),
            "Test publishing content",
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
    const readyReport = await PublishingReadinessService.check(
        packageDirectory,
        {
            projectRoot: tempRoot,
            probe: async () => ({ ...validVideo }),
        }
    );

    assert.equal(readyReport.status, "ready_for_review");
    assert.equal(readyReport.errors.length, 0);
    assert.equal(readyReport.checks.video.exists, true);
    assert.equal(readyReport.checks.metadata.validJson, true);

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

    // 2. Імітуємо відео з непідтримуваним кодеком,
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

    // 3. Перевіряємо відсутній текстовий файл платформи.
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

    // 4. Перевіряємо відсутнє відео.
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

    // 5. Перевіряємо відсутній маніфест.
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
