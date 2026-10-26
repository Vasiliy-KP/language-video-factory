import assert from "node:assert/strict";
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
} from "node:fs/promises";
import path from "node:path";

import {
    PublishingQueueService,
} from "./src/services/PublishingQueueService.js";

const platformNames = [
    "tiktok",
    "instagram",
    "youtubeShorts",
];

function createReport(word, status = "ready_for_review") {
    const platforms = Object.fromEntries(
        platformNames.map((platform) => [
            platform,
            {
                status,
                errors: [],
                warnings: [],
            },
        ])
    );

    return {
        schemaVersion: 1,
        word,
        checkedAt: new Date().toISOString(),
        status,
        errors: [],
        warnings: [],
        checks: {
            video: {
                path: `output/videos/${word.toLowerCase()}.mp4`,
                exists: true,
            },
            metadata: {
                path: `output/metadata/${word}.json`,
                validJson: true,
            },
        },
        platforms,
    };
}

let tempRoot;

try {
    console.log("▶ Testing PublishingQueueService...");

    // Створюємо ізольовану тестову директорію в проєкті.
    tempRoot = await mkdtemp(
        path.join(process.cwd(), ".publishing-queue-test-")
    );

    const publishingDirectory = "output/publishing";
    const packageNames = ["Bicycle", "Apple", "Pear"];

    for (const word of packageNames) {
        await mkdir(
            path.join(tempRoot, publishingDirectory, word),
            { recursive: true }
        );
    }

    // Імітуємо готовий пакет, пакет із помилкою
    // та помилку перевірки окремого пакета.
    const readinessCheck = async (packagePath) => {
        const word = path.basename(packagePath);

        if (word === "Pear") {
            throw new Error("Simulated readiness check failure");
        }

        if (word === "Apple") {
            const report = createReport(word, "needs_fixes");

            report.platforms.instagram.errors.push({
                code: "unsupported_audio_sample_rate",
                message: "Audio sample rate must be 48000 Hz.",
            });

            return report;
        }

        return createReport(word);
    };

    const queue = await PublishingQueueService.build({
        projectRoot: tempRoot,
        publishingDirectory,
        queueFile: `${publishingDirectory}/queue.json`,
        readinessCheck,
    });

    // 1. До черги має потрапити тільки Bicycle.
    assert.equal(queue.status, "ready_for_review");
    assert.deepEqual(
        queue.items.map((item) => item.word),
        ["Bicycle"]
    );

    assert.equal(queue.summary.scanned, 3);
    assert.equal(queue.summary.eligible, 1);
    assert.equal(queue.summary.excluded, 2);

    assert.deepEqual(
        queue.items[0].platforms.slice().sort(),
        platformNames.slice().sort()
    );

    console.log("✅ Eligible package was queued");

    // 2. Apple виключено через проблему Instagram.
    const apple = queue.excluded.find(
        (item) => item.word === "Apple"
    );

    assert.ok(apple);
    assert.equal(apple.status, "needs_fixes");
    assert.ok(
        apple.platformErrors.some(
            (error) =>
                error.platform === "instagram" &&
                error.code === "unsupported_audio_sample_rate"
        )
    );

    console.log("✅ Package needing fixes was excluded");

    // 3. Збій перевірки Pear не зупиняє побудову черги.
    const pear = queue.excluded.find(
        (item) => item.word === "Pear"
    );

    assert.ok(pear);
    assert.equal(pear.status, "check_failed");
    assert.match(
        pear.errors[0].message,
        /Simulated readiness check failure/
    );

    console.log("✅ Check failure did not stop other packages");

    // 4. Перевіряємо JSON-файл на диску.
    const queuePath = path.join(
        tempRoot,
        publishingDirectory,
        "queue.json"
    );

    const savedQueue = JSON.parse(
        await readFile(queuePath, "utf8")
    );

    assert.deepEqual(savedQueue, queue);

    console.log("✅ queue.json was saved and verified");

    console.log("\n✅ PublishingQueueService tests passed.");
} catch (error) {
    console.error("\n❌ PublishingQueueService tests failed.");
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