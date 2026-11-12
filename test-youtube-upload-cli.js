
import assert from "node:assert/strict";

import {
    parseUploadArguments,
    runYouTubeUploadCommand,
} from "./src/commands/youtube-upload.js";

const TEST_HASH = "a".repeat(64);

function createHarness({
    duplicate = null,
    confirmation = "UPLOAD",
    uploadError = null,
    historyError = null,
} = {}) {
    const state = {
        events: [],
        uploadCalls: [],
        historyCalls: [],
        logs: [],
    };

    const queueService = {
        async build() {
            return {
                items: [
                    {
                        word: "Apple",
                        videoPath: "output/videos/apple.mp4",
                        metadataPath: "output/metadata/Apple.json",
                        platforms: ["youtubeShorts"],
                    },
                ],
            };
        },
    };

    const historyService = {
        async fingerprintFile({ videoPath }) {
            state.events.push("fingerprint");

            return {
                fileHash: TEST_HASH,
                fileSize: 12345,
                videoPath,
            };
        },

        async findDuplicate({ fileHash }) {
            state.events.push("duplicate-check");

            assert.equal(fileHash, TEST_HASH);

            return duplicate;
        },

        async recordUpload(record) {
            state.events.push("record-history");
            state.historyCalls.push(record);

            if (historyError) {
                throw historyError;
            }

            return {
                ...record,
                fileHash: TEST_HASH,
            };
        },
    };

    const uploadService = {
        async upload(options) {
            state.events.push("upload");
            state.uploadCalls.push(options);

            if (uploadError) {
                throw uploadError;
            }

            return {
                id: "test-youtube-video-001",
                url: "https://www.youtube.com/watch?v=test-youtube-video-001",
                title: "Apple in 6 languages | A1 Vocabulary",
                privacyStatus: "private",
                uploadStatus: "uploaded",
            };
        },
    };

    const logger = {
        log(...values) {
            state.logs.push(values.join(" "));
        },
    };

    async function readMetadata(metadataPath) {
        assert.equal(
            metadataPath,
            "output/metadata/Apple.json"
        );

        return {
            platforms: {
                youtubeShorts: {
                    title: "Apple in 6 languages | A1 Vocabulary",
                    description: "Learn Apple in six languages.",
                    hashtags: ["#English", "#Vocabulary"],
                },
            },
        };
    }

    async function confirmUpload() {
        state.events.push("confirmation");
        return confirmation;
    }

    const dependencies = {
        args: ["--word=Apple"],
        queueService,
        uploadService,
        historyService,
        readMetadata,
        confirmUpload,
        logger,
    };

    return {
        state,
        dependencies,
    };
}

async function runTests() {
    console.log("▶ Testing YouTube upload CLI integration...");

    // 1. Valid command arguments.
    assert.deepEqual(
        parseUploadArguments(["--word=Apple"]),
        {
            word: "Apple",
            force: false,
        }
    );

    assert.deepEqual(
        parseUploadArguments(["--word=Apple", "--force"]),
        {
            word: "Apple",
            force: true,
        }
    );

    console.log("✅ Upload arguments are parsed");

    // 2. Invalid and duplicate arguments.
    assert.throws(
        () => parseUploadArguments([]),
        /Exactly one word/
    );

    assert.throws(
        () => parseUploadArguments(["--word=Apple", "--word=Bicycle"]),
        /Exactly one word/
    );

    assert.throws(
        () => parseUploadArguments(["--word=Apple", "--unknown"]),
        /Unknown arguments/
    );

    assert.throws(
        () => parseUploadArguments(["--word=Apple", "--force", "--force"]),
        /more than once/
    );

    console.log("✅ Invalid upload arguments are rejected");

    // 3. A duplicate is blocked before confirmation.
    {
        const duplicate = {
            word: "Apple",
            videoId: "previous-video-001",
            uploadedAt: "2026-11-08T20:00:00.000Z",
        };

        const { state, dependencies } = createHarness({
            duplicate,
        });

        await assert.rejects(
            runYouTubeUploadCommand(dependencies),
            /Duplicate upload blocked/
        );

        assert.deepEqual(
            state.events,
            ["fingerprint", "duplicate-check"]
        );

        assert.equal(state.uploadCalls.length, 0);
        assert.equal(state.historyCalls.length, 0);

        console.log("✅ Duplicate upload is blocked before confirmation");
    }

    // 4. --force bypasses duplicate protection but not confirmation.
    {
        const { state, dependencies } = createHarness({
            duplicate: {
                word: "Apple",
                videoId: "previous-video-002",
                uploadedAt: "2026-11-08T20:00:00.000Z",
            },
            confirmation: "",
        });

        dependencies.args.push("--force");

        const result = await runYouTubeUploadCommand(dependencies);

        assert.equal(result.cancelled, true);

        assert.deepEqual(
            state.events,
            [
                "fingerprint",
                "duplicate-check",
                "confirmation",
            ]
        );

        assert.equal(state.uploadCalls.length, 0);
        assert.equal(state.historyCalls.length, 0);

        console.log("✅ --force still requires UPLOAD confirmation");
    }

    // 5. User can cancel a normal upload.
    {
        const { state, dependencies } = createHarness({
            confirmation: "",
        });

        const result = await runYouTubeUploadCommand(dependencies);

        assert.equal(result.cancelled, true);
        assert.equal(state.uploadCalls.length, 0);
        assert.equal(state.historyCalls.length, 0);

        console.log("✅ Cancelled upload does not change history");
    }

    // 6. Successful upload is recorded after the upload call.
    {
        const { state, dependencies } = createHarness();

        const result = await runYouTubeUploadCommand(dependencies);

        assert.equal(result.cancelled, false);
        assert.equal(
            result.result.id,
            "test-youtube-video-001"
        );

        assert.deepEqual(
            state.events,
            [
                "fingerprint",
                "duplicate-check",
                "confirmation",
                "upload",
                "record-history",
            ]
        );

        assert.equal(state.uploadCalls.length, 1);
        assert.equal(state.historyCalls.length, 1);

        assert.equal(
            state.uploadCalls[0].privacyStatus,
            "private"
        );

        assert.equal(
            state.uploadCalls[0].notifySubscribers,
            false
        );

        assert.equal(
            state.historyCalls[0].videoId,
            "test-youtube-video-001"
        );

        assert.equal(
            state.historyCalls[0].fileHash,
            TEST_HASH
        );

        console.log("✅ Successful upload is recorded after YouTube response");
        console.log("✅ PRIVATE privacy and disabled notifications are preserved");
    }

    // 7. Upload failure must not create a history record.
    {
        const { state, dependencies } = createHarness({
            uploadError: new Error("Simulated YouTube API failure"),
        });

        await assert.rejects(
            runYouTubeUploadCommand(dependencies),
            /Simulated YouTube API failure/
        );

        assert.equal(state.uploadCalls.length, 1);
        assert.equal(state.historyCalls.length, 0);

        console.log("✅ Failed upload is not recorded in history");
    }

    // 8. History failure is reported without hiding the uploaded video ID.
    {
        const { state, dependencies } = createHarness({
            historyError: new Error("Simulated history write failure"),
        });

        await assert.rejects(
            runYouTubeUploadCommand(dependencies),
            /uploaded successfully.*test-youtube-video-001.*history could not be saved/
        );

        assert.equal(state.uploadCalls.length, 1);
        assert.equal(state.historyCalls.length, 1);

        console.log("✅ History write failure reports successful YouTube upload");
    }

    // 9. --force allows an intentional duplicate upload.
    {
        const { state, dependencies } = createHarness({
            duplicate: {
                word: "Apple",
                videoId: "previous-video-003",
                uploadedAt: "2026-11-08T20:00:00.000Z",
            },
        });

        dependencies.args.push("--force");

        const result = await runYouTubeUploadCommand(dependencies);

        assert.equal(result.cancelled, false);
        assert.equal(state.uploadCalls.length, 1);
        assert.equal(state.historyCalls.length, 1);

        console.log("✅ --force allows an intentional duplicate upload");
    }

    console.log("\n✅ All YouTube upload CLI integration tests passed");
}

runTests().catch((error) => {
    console.error("\n❌ YouTube upload CLI integration tests failed:");
    console.error(error);
    process.exitCode = 1;
});
