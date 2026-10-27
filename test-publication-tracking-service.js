
import assert from "node:assert/strict";
import {
    mkdtemp,
    readFile,
    rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    PublicationTrackingService,
} from "./src/services/PublicationTrackingService.js";

async function runTests() {
    const projectRoot = await mkdtemp(
        path.join(os.tmpdir(), "publication-tracking-test-")
    );

    try {
        console.log("▶ Testing PublicationTrackingService...");

        const empty = await PublicationTrackingService.load({
            projectRoot,
        });

        assert.deepEqual(empty, {
            schemaVersion: 1,
            items: {},
        });

        console.log("✅ Missing status file returns empty data");

        const initialStatus =
            await PublicationTrackingService.getForWord({
                word: "Apple",
                platforms: ["tiktok", "instagram"],
                projectRoot,
            });

        assert.deepEqual(initialStatus.platforms.tiktok, {
            status: "pending",
            publishedAt: null,
            url: null,
        });

        console.log("✅ New platform defaults to pending");

        const publishedAt = "2026-10-27T18:30:00.000Z";
        const url = "https://example.com/apple";

        await PublicationTrackingService.update({
            word: "Apple",
            platform: "instagram",
            status: "published",
            publishedAt,
            url,
            projectRoot,
        });

        const savedStatus =
            await PublicationTrackingService.getForWord({
                word: "Apple",
                platforms: ["tiktok", "instagram", "youtubeShorts"],
                projectRoot,
            });

        assert.deepEqual(savedStatus.platforms.instagram, {
            status: "published",
            publishedAt,
            url,
        });

        assert.equal(
            savedStatus.platforms.tiktok.status,
            "pending"
        );

        assert.equal(
            savedStatus.platforms.youtubeShorts.status,
            "pending"
        );

        console.log("✅ Published status is saved independently per platform");

        const filePath = path.join(
            projectRoot,
            "output",
            "publishing",
            "publication-status.json"
        );

        const savedFile = JSON.parse(
            await readFile(filePath, "utf8")
        );

        assert.deepEqual(
            savedFile.items.Apple.instagram,
            {
                status: "published",
                publishedAt,
                url,
            }
        );

        console.log("✅ publication-status.json is saved");

        await PublicationTrackingService.update({
            word: "Apple",
            platform: "instagram",
            status: "pending",
            projectRoot,
        });

        const resetStatus =
            await PublicationTrackingService.getForWord({
                word: "Apple",
                platforms: ["instagram"],
                projectRoot,
            });

        assert.deepEqual(resetStatus.platforms.instagram, {
            status: "pending",
            publishedAt: null,
            url: null,
        });

        console.log("✅ Status can be reset to pending");

        await assert.rejects(
            PublicationTrackingService.update({
                word: "Apple",
                platform: "unsupported",
                status: "published",
                url,
                projectRoot,
            }),
            /Unsupported publication platform/
        );

        console.log("✅ Unsupported platform is rejected");

        await assert.rejects(
            PublicationTrackingService.update({
                word: "Apple",
                platform: "tiktok",
                status: "published",
                url: "not-a-valid-url",
                projectRoot,
            }),
            /Published video URL/
        );

        console.log("✅ Invalid published URL is rejected");

        console.log("\n✅ All publication tracking tests passed");
    } finally {
        await rm(projectRoot, {
            recursive: true,
            force: true,
        });
    }
}

runTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
