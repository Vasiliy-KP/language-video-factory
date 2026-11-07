
import assert from "node:assert/strict";

import {
    YouTubeVideoStatusService,
} from "./src/services/YouTubeVideoStatusService.js";

async function runTests() {
    console.log("▶ Testing YouTubeVideoStatusService...");

    const videoId = "Yf0n9TZmZe4";

    const authClient = {
        credentials: {
            access_token: "test-access-token",
        },
    };

    let capturedRequest = null;
    let updateWasCalled = false;

    const createFakeClient = (video) => (auth) => {
        assert.equal(auth, authClient);

        return {
            videos: {
                list: async (request) => {
                    capturedRequest = request;

                    return {
                        data: {
                            items: video ? [video] : [],
                        },
                    };
                },

                // Якщо сервіс спробує змінити відео,
                // тест має це виявити.
                update: async () => {
                    updateWasCalled = true;
                    throw new Error(
                        "Video update must not be called."
                    );
                },
            },
        };
    };

    const processingVideo = {
        id: videoId,

        snippet: {
            title: "Apple in 6 languages | A1 Vocabulary",
        },

        status: {
            uploadStatus: "uploaded",
            privacyStatus: "private",
        },

        processingDetails: {
            processingStatus: "processing",

            processingProgress: {
                partsTotal: 100,
                partsProcessed: 40,
                timeLeftMs: 120000,
            },
        },
    };

    const processingResult =
        await YouTubeVideoStatusService.getStatus({
            videoId,
            authClient,
            youtubeClientFactory: createFakeClient(processingVideo),
        });

    assert.equal(processingResult.videoId, videoId);

    assert.equal(
        processingResult.url,
        `https://www.youtube.com/watch?v=${videoId}`
    );

    assert.equal(processingResult.title,
        "Apple in 6 languages | A1 Vocabulary");

    assert.equal(processingResult.uploadStatus, "uploaded");
    assert.equal(processingResult.processingStatus, "processing");
    assert.equal(processingResult.isProcessingComplete, false);

    assert.deepEqual(processingResult.processingProgress, {
        partsTotal: 100,
        partsProcessed: 40,
        percent: 40,
        timeLeftMs: 120000,
    });

    console.log("✅ Processing status and progress are read");

    assert.deepEqual(capturedRequest, {
        part: [
            "id",
            "snippet",
            "status",
            "processingDetails",
        ],
        id: videoId,
    });

    console.log("✅ Correct videos.list request is created");

    assert.equal(processingResult.privacyStatus, "private");

    console.log("✅ Privacy status is read without modification");

    const completedVideo = {
        ...processingVideo,

        status: {
            uploadStatus: "processed",
            privacyStatus: "private",
        },

        processingDetails: {
            processingStatus: "succeeded",
        },
    };

    const completedResult =
        await YouTubeVideoStatusService.getStatus({
            videoId,
            authClient,
            youtubeClientFactory: createFakeClient(completedVideo),
        });

    assert.equal(completedResult.uploadStatus, "processed");
    assert.equal(completedResult.processingStatus, "succeeded");
    assert.equal(completedResult.isProcessingComplete, true);
    assert.equal(completedResult.processingProgress, null);

    console.log("✅ Successfully processed video is detected");

    const failedVideo = {
        ...processingVideo,

        status: {
            uploadStatus: "failed",
            privacyStatus: "private",
            failureReason: "conversion",
        },

        processingDetails: {
            processingStatus: "failed",
            processingFailureReason: "transcodeFailed",
        },
    };

    const failedResult =
        await YouTubeVideoStatusService.getStatus({
            videoId,
            authClient,
            youtubeClientFactory: createFakeClient(failedVideo),
        });

    assert.equal(failedResult.processingStatus, "failed");
    assert.equal(
        failedResult.processingFailureReason,
        "transcodeFailed"
    );
    assert.equal(failedResult.failureReason, "conversion");

    console.log("✅ Processing failures are detected");

    await assert.rejects(
        YouTubeVideoStatusService.getStatus({
            videoId: "invalid",
            authClient,
        }),
        /Invalid YouTube video ID/
    );

    console.log("✅ Invalid video ID is rejected");

    await assert.rejects(
        YouTubeVideoStatusService.getStatus({
            videoId,
            authClient,
            youtubeClientFactory: createFakeClient(null),
        }),
        /YouTube video not found/
    );

    console.log("✅ Missing video is detected");

    await assert.rejects(
        YouTubeVideoStatusService.getStatus({
            videoId,
            authClient,
            youtubeClientFactory: () => ({
                videos: {
                    list: async () => {
                        throw new Error("API connection failed");
                    },
                },
            }),
        }),
        /YouTube status check failed: API connection failed/
    );

    console.log("✅ API errors are handled");

    assert.equal(updateWasCalled, false);

    console.log("✅ Video privacy and metadata are never modified");

    console.log("\n✅ All YouTube video status tests passed");
}

runTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
