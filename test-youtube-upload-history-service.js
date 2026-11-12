
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
    mkdtemp,
    mkdir,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
    YouTubeUploadHistoryService,
} from "./src/services/YouTubeUploadHistoryService.js";

async function runTests() {
    const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "youtube-upload-history-test-")
    );

    try {
        console.log("▶ Testing YouTubeUploadHistoryService...");

        const historyFile =
            "output/publishing/youtube-upload-history.json";

        const emptyHistory =
            await YouTubeUploadHistoryService.load({
                projectRoot: tempRoot,
            });

        assert.deepEqual(emptyHistory, {
            schemaVersion: 1,
            items: [],
        });

        console.log("✅ Missing history file returns empty history");

        const videoPath = path.join(
            tempRoot,
            "output",
            "videos",
            "apple.mp4"
        );

        await mkdir(path.dirname(videoPath), {
            recursive: true,
        });

        const videoContent = Buffer.from(
            "fake-video-content-for-history-test"
        );

        await writeFile(videoPath, videoContent);

        const fingerprint =
            await YouTubeUploadHistoryService.fingerprintFile({
                videoPath,
                projectRoot: tempRoot,
            });

        const expectedHash = createHash("sha256")
            .update(videoContent)
            .digest("hex");

        assert.equal(fingerprint.fileHash, expectedHash);
        assert.equal(fingerprint.fileSize, videoContent.length);

        console.log("✅ Video SHA-256 and file size are calculated");

        const missingDuplicate =
            await YouTubeUploadHistoryService.findDuplicate({
                fileHash: fingerprint.fileHash,
                projectRoot: tempRoot,
            });

        assert.equal(missingDuplicate, null);

        console.log("✅ New video is not detected as a duplicate");

        const uploadedAt = "2026-11-08T20:00:00.000Z";

        const record =
            await YouTubeUploadHistoryService.recordUpload({
                word: "Apple",
                title: "Apple in 6 languages | A1 Vocabulary",
                videoId: "history-video-001",
                url: "https://www.youtube.com/watch?v=history-video-001",
                videoPath,
                fileHash: fingerprint.fileHash,
                privacyStatus: "private",
                uploadStatus: "uploaded",
                uploadedAt,
                projectRoot: tempRoot,
            });

        assert.equal(record.word, "Apple");
        assert.equal(record.videoId, "history-video-001");
        assert.equal(record.fileHash, expectedHash);
        assert.equal(record.privacyStatus, "private");
        assert.equal(record.uploadStatus, "uploaded");

        console.log("✅ Successful upload is recorded");

        const storedHistory =
            await YouTubeUploadHistoryService.load({
                projectRoot: tempRoot,
            });

        assert.equal(storedHistory.items.length, 1);
        assert.equal(storedHistory.items[0].videoId, "history-video-001");

        const savedContent = await readFile(
            path.join(tempRoot, historyFile),
            "utf8"
        );

        assert.ok(savedContent.endsWith("\n"));

        console.log("✅ History is saved and loaded from JSON");

        const duplicate =
            await YouTubeUploadHistoryService.findDuplicate({
                videoPath,
                projectRoot: tempRoot,
            });

        assert.equal(duplicate.videoId, "history-video-001");

        console.log("✅ Previously uploaded video is detected");

        const secondPath = path.join(
            tempRoot,
            "output",
            "videos",
            "apple-copy.mp4"
        );

        await writeFile(secondPath, videoContent);

        const sameContentDuplicate =
            await YouTubeUploadHistoryService.findDuplicate({
                videoPath: secondPath,
                projectRoot: tempRoot,
            });

        assert.equal(
            sameContentDuplicate.videoId,
            "history-video-001"
        );

        console.log("✅ Identical files are detected by SHA-256");

        const differentPath = path.join(
            tempRoot,
            "output",
            "videos",
            "different.mp4"
        );

        await writeFile(
            differentPath,
            Buffer.from("different-video-content")
        );

        const differentDuplicate =
            await YouTubeUploadHistoryService.findDuplicate({
                videoPath: differentPath,
                projectRoot: tempRoot,
            });

        assert.equal(differentDuplicate, null);

        console.log("✅ Different video is not detected as a duplicate");

        const secondRecord =
            await YouTubeUploadHistoryService.recordUpload({
                word: "Bicycle",
                title: "Bicycle in 6 languages | A1 Vocabulary",
                videoId: "history-video-002",
                url: "https://www.youtube.com/watch?v=history-video-002",
                videoPath: differentPath,
                privacyStatus: "private",
                uploadStatus: "uploaded",
                uploadedAt: "2026-11-08T21:00:00.000Z",
                projectRoot: tempRoot,
            });

        assert.equal(secondRecord.word, "Bicycle");

        const latestItems =
            await YouTubeUploadHistoryService.list({
                projectRoot: tempRoot,
                limit: 1,
            });

        assert.equal(latestItems.length, 1);
        assert.equal(latestItems[0].videoId, "history-video-002");

        console.log("✅ History is sorted and limit is supported");

        await assert.rejects(
            YouTubeUploadHistoryService.list({
                projectRoot: tempRoot,
                limit: 0,
            }),
            /positive integer/
        );

        console.log("✅ Invalid history limit is rejected");

        await assert.rejects(
            YouTubeUploadHistoryService.recordUpload({
                word: "Apple",
                title: "Duplicate video ID",
                videoId: "history-video-001",
                url: "https://www.youtube.com/watch?v=history-video-001",
                videoPath,
                projectRoot: tempRoot,
            }),
            /already exists/
        );

        console.log("✅ Duplicate YouTube video ID is rejected");

        await assert.rejects(
            YouTubeUploadHistoryService.recordUpload({
                word: "Apple",
                title: "Invalid hash",
                videoId: "history-video-003",
                url: "https://www.youtube.com/watch?v=history-video-003",
                videoPath,
                fileHash: "invalid-hash",
                projectRoot: tempRoot,
            }),
            /SHA-256/
        );

        console.log("✅ Invalid SHA-256 hash is rejected");

        await assert.rejects(
            YouTubeUploadHistoryService.recordUpload({
                word: "Apple",
                title: "Invalid privacy",
                videoId: "history-video-004",
                url: "https://www.youtube.com/watch?v=history-video-004",
                videoPath,
                privacyStatus: "invalid",
                projectRoot: tempRoot,
            }),
            /Invalid YouTube privacy status/
        );

        console.log("✅ Invalid privacy status is rejected");

        await assert.rejects(
            YouTubeUploadHistoryService.fingerprintFile({
                videoPath: path.join(tempRoot, "missing.mp4"),
                projectRoot: tempRoot,
            }),
            /Video file not found/
        );

        console.log("✅ Missing video file is rejected");

        const brokenRoot = path.join(tempRoot, "broken");

        await mkdir(
            path.join(brokenRoot, "output", "publishing"),
            { recursive: true }
        );

        await writeFile(
            path.join(
                brokenRoot,
                historyFile
            ),
            "{invalid-json"
        );

        await assert.rejects(
            YouTubeUploadHistoryService.load({
                projectRoot: brokenRoot,
            }),
            /invalid JSON/
        );

        console.log("✅ Invalid JSON history is detected");

        const unsupportedRoot = path.join(tempRoot, "unsupported");

        await mkdir(
            path.join(unsupportedRoot, "output", "publishing"),
            { recursive: true }
        );

        await writeFile(
            path.join(unsupportedRoot, historyFile),
            JSON.stringify({
                schemaVersion: 99,
                items: [],
            })
        );

        await assert.rejects(
            YouTubeUploadHistoryService.load({
                projectRoot: unsupportedRoot,
            }),
            /unsupported structure/
        );

        console.log("✅ Unsupported history schema is rejected");

        console.log(
            "\n✅ All YouTube upload history service tests passed"
        );
    } finally {
        await rm(tempRoot, {
            recursive: true,
            force: true,
        });
    }
}

runTests().catch((error) => {
    console.error("\n❌ YouTube upload history tests failed:");
    console.error(error);
    process.exitCode = 1;
});
