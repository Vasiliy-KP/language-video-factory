
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    YouTubeUploadHistoryService,
} from "./src/services/YouTubeUploadHistoryService.js";

const COMMAND_PATH = path.resolve(
    "src/commands/youtube-history.js"
);

function runCommand(args, cwd) {
    return spawnSync(
        process.execPath,
        [COMMAND_PATH, ...args],
        {
            cwd,
            encoding: "utf8",
        }
    );
}

async function runTests() {
    const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "youtube-history-cli-test-")
    );

    try {
        console.log("▶ Testing YouTube history CLI...");

        const emptyResult = runCommand([], tempRoot);

        assert.equal(emptyResult.status, 0);
        assert.match(
            emptyResult.stdout,
            /No YouTube uploads found/
        );

        console.log("✅ Empty history is handled");

        const videoDirectory = path.join(
            tempRoot,
            "videos"
        );

        await mkdir(videoDirectory, {
            recursive: true,
        });

        const applePath = path.join(videoDirectory, "apple.mp4");
        const bicyclePath = path.join(videoDirectory, "bicycle.mp4");

        await writeFile(applePath, "apple-video-content");
        await writeFile(bicyclePath, "bicycle-video-content");

        await YouTubeUploadHistoryService.recordUpload({
            word: "Apple",
            title: "Apple in 6 languages",
            videoId: "history-cli-apple",
            url: "https://www.youtube.com/watch?v=history-cli-apple",
            videoPath: applePath,
            uploadedAt: "2026-11-08T20:00:00.000Z",
            privacyStatus: "private",
            projectRoot: tempRoot,
        });

        await YouTubeUploadHistoryService.recordUpload({
            word: "Bicycle",
            title: "Bicycle in 6 languages",
            videoId: "history-cli-bicycle",
            url: "https://www.youtube.com/watch?v=history-cli-bicycle",
            videoPath: bicyclePath,
            uploadedAt: "2026-11-08T21:00:00.000Z",
            privacyStatus: "private",
            projectRoot: tempRoot,
        });

        const historyResult = runCommand([], tempRoot);

        assert.equal(historyResult.status, 0);
        assert.ok(
            historyResult.stdout.indexOf("Bicycle") <
            historyResult.stdout.indexOf("Apple")
        );
        assert.match(historyResult.stdout, /PRIVATE/);
        assert.match(historyResult.stdout, /history-cli-apple/);
        assert.match(historyResult.stdout, /history-cli-bicycle/);
        assert.match(historyResult.stdout, /Total uploads shown: 2/);

        console.log("✅ Upload history is displayed correctly");

        const limitedResult = runCommand(
            ["--limit=1"],
            tempRoot
        );

        assert.equal(limitedResult.status, 0);
        assert.match(limitedResult.stdout, /Bicycle/);
        assert.doesNotMatch(limitedResult.stdout, /Apple/);
        assert.match(limitedResult.stdout, /Total uploads shown: 1/);

        console.log("✅ History limit is applied");

        const zeroLimitResult = runCommand(
            ["--limit=0"],
            tempRoot
        );

        assert.notEqual(zeroLimitResult.status, 0);
        assert.match(
            zeroLimitResult.stderr,
            /positive integer/
        );

        console.log("✅ Zero limit is rejected");

        const invalidLimitResult = runCommand(
            ["--limit=abc"],
            tempRoot
        );

        assert.notEqual(invalidLimitResult.status, 0);
        assert.match(
            invalidLimitResult.stderr,
            /positive integer/
        );

        console.log("✅ Invalid limit is rejected");

        const unknownArgumentResult = runCommand(
            ["--unknown"],
            tempRoot
        );

        assert.notEqual(unknownArgumentResult.status, 0);
        assert.match(
            unknownArgumentResult.stderr,
            /Unknown arguments/
        );

        console.log("✅ Unknown arguments are rejected");

        const duplicateLimitResult = runCommand(
            ["--limit=1", "--limit=2"],
            tempRoot
        );

        assert.notEqual(duplicateLimitResult.status, 0);
        assert.match(
            duplicateLimitResult.stderr,
            /more than once/
        );

        console.log("✅ Duplicate limit arguments are rejected");

        console.log("\n✅ All YouTube history CLI tests passed");
    } finally {
        await rm(tempRoot, {
            recursive: true,
            force: true,
        });
    }
}

runTests().catch((error) => {
    console.error("\n❌ YouTube history CLI tests failed:");
    console.error(error);
    process.exitCode = 1;
});
