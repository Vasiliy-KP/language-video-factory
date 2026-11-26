import assert from "node:assert/strict";

import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";

import path from "node:path";

import {
    PublishingMetadataService,
} from "./src/services/PublishingMetadataService.js";

import {
    PublishingMetadataWriter,
} from "./src/services/PublishingMetadataWriter.js";

import {
    PublishingPackageWriter,
} from "./src/services/PublishingPackageWriter.js";

import {
    PublishingReadinessService,
} from "./src/services/PublishingReadinessService.js";

import {
    PublishingQueueService,
} from "./src/services/PublishingQueueService.js";


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

let tempRoot;

try {
    console.log("▶ Testing complete publishing integration...");

    // 1. Створюємо ізольовану тестову директорію.
    tempRoot = await mkdtemp(
        path.join(
            process.cwd(),
            ".publishing-integration-test-"
        )
    );

    const metadataDirectory = path.join(
        tempRoot,
        "output",
        "metadata"
    );

    const videoDirectory = path.join(
        tempRoot,
        "output",
        "videos"
    );

    const publishingDirectory = path.join(
        tempRoot,
        "output",
        "publishing"
    );

    await Promise.all([
        mkdir(metadataDirectory, { recursive: true }),
        mkdir(videoDirectory, { recursive: true }),
        mkdir(publishingDirectory, { recursive: true }),
    ]);

    // 2. Створюємо метадані.
    const metadata = PublishingMetadataService.create(wordData);

    const metadataPath = await PublishingMetadataWriter.save(
        metadata,
        metadataDirectory
    );

    console.log("✅ Publishing metadata created");

    // 3. Створюємо тестовий відеофайл.
    // Реальне відео тут не потрібне: якість перевіряє mock probe.
    const videoPath = path.join(
        videoDirectory,
        "bicycle.mp4"
    );

    await writeFile(
        videoPath,
        "integration test video",
        "utf8"
    );

    // 4. Формуємо повний publishing package.
    const packageResult = await PublishingPackageWriter.save(
        metadata,
        publishingDirectory,
        {
            videoPath,
            metadataPath,
        }
    );

    console.log("✅ Publishing package created");

    // 5. Використовуємо реальний ReadinessService.
    // Замінюємо тільки перевірку медіафайлу.
    const readinessCheck = async (
        packagePath,
        options = {}
    ) => {
        return PublishingReadinessService.check(
            packagePath,
            {
                ...options,
                probe: async () => structuredClone(validVideo),
            }
        );
    };

    const readinessReport = await readinessCheck(
        packageResult.directory,
        {
            projectRoot: process.cwd(),
        }
    );

    assert.equal(
        readinessReport.status,
        "ready_for_review"
    );

    assert.equal(
        readinessReport.checks.content.valid,
        true
    );

    assert.equal(
        readinessReport.errors.length,
        0
    );

    console.log("✅ Publishing readiness passed");

    // 6. Створюємо реальну чергу через QueueService.
    const relativePublishingDirectory = path.relative(
        process.cwd(),
        publishingDirectory
    );

    const relativeQueueFile = path.relative(
        process.cwd(),
        path.join(publishingDirectory, "queue.json")
    );

    const buildQueue = () => PublishingQueueService.build({
        projectRoot: process.cwd(),
        publishingDirectory: relativePublishingDirectory,
        queueFile: relativeQueueFile,
        readinessCheck,
    });

    const validQueue = await buildQueue();

    assert.deepEqual(
        validQueue.items.map((item) => item.word),
        ["Bicycle"]
    );

    assert.equal(validQueue.summary.eligible, 1);
    assert.equal(validQueue.summary.excluded, 0);

    console.log("✅ Valid package entered publishing queue");

    // 7. Пошкоджуємо TikTok-файл.
    const tiktokPath = packageResult.files["tiktok.txt"];

    const originalTiktokContent = await readFile(
        tiktokPath,
        "utf8"
    );

    await writeFile(
        tiktokPath,
        "Tampered content #Wrong",
        "utf8"
    );

    // 8. Повторно формуємо чергу.
    const invalidQueue = await buildQueue();

    assert.equal(invalidQueue.items.length, 0);
    assert.equal(invalidQueue.summary.excluded, 1);

    const excludedPackage = invalidQueue.excluded.find(
        (item) => item.word === "Bicycle"
    );

    assert.ok(excludedPackage);
    assert.equal(excludedPackage.status, "needs_fixes");

    assert.ok(
        excludedPackage.platformErrors.some(
            (error) =>
                error.platform === "tiktok" &&
                error.code === "platform_file_mismatch"
        )
    );

    console.log("✅ Invalid package was excluded from queue");

    // 9. Відновлюємо правильний TikTok-файл.
    await writeFile(
        tiktokPath,
        originalTiktokContent,
        "utf8"
    );

    // 10. Повторно перевіряємо після виправлення.
    const repairedQueue = await buildQueue();

    assert.deepEqual(
        repairedQueue.items.map((item) => item.word),
        ["Bicycle"]
    );

    assert.equal(repairedQueue.summary.eligible, 1);
    assert.equal(repairedQueue.summary.excluded, 0);

    console.log("✅ Repaired package returned to queue");

    // 11. Перевіряємо записаний queue.json.
    const savedQueue = JSON.parse(
        await readFile(
            path.join(publishingDirectory, "queue.json"),
            "utf8"
        )
    );

    assert.deepEqual(savedQueue, repairedQueue);

    console.log("✅ Final queue.json was saved and verified");

    console.log(
        "\n✅ Complete publishing integration tests passed."
    );
} catch (error) {
    console.error(
        "\n❌ Publishing integration tests failed."
    );

    console.error(error);
    process.exitCode = 1;
} finally {
    if (tempRoot) {
        await rm(tempRoot, {
            recursive: true,
            force: true,
        });

        console.log("🧹 Temporary integration files removed");
    }
}