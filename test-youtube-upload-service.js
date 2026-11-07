
import assert from "node:assert/strict";

import {
    mkdtemp,
    mkdir,
    rm,
    writeFile,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
    YouTubeUploadService,
} from "./src/services/YouTubeUploadService.js";

async function runTests() {
    const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "youtube-upload-test-")
    );

    try {
        console.log("▶ Testing YouTubeUploadService...");

        const videoPath = path.join(
            tempRoot,
            "test-video.mp4"
        );

        await writeFile(
            videoPath,
            Buffer.from("fake-video-content")
        );

        const metadata = {
            word: "Apple",
            platforms: {
                youtubeShorts: {
                    title: "Apple in 6 languages | A1 Vocabulary",
                    description: "Learn Apple in 6 languages.",
                    hashtags: [
                        "#LanguageLearning",
                        "#Vocabulary",
                        "#Apple",
                    ],
                },
            },
        };

        let capturedRequest = null;
        let capturedVideoContent = null;

        const fakeAuthClient = {
            credentials: {
                access_token: "fake-access-token",
            },
        };

        const fakeYoutubeClientFactory = (auth) => {
            assert.equal(auth, fakeAuthClient);

            return {
                videos: {
                    insert: async (request) => {
                        capturedRequest = request;

                        const chunks = [];

                        for await (const chunk of request.media.body) {
                            chunks.push(chunk);
                        }

                        capturedVideoContent = Buffer.concat(chunks);

                        return {
                            data: {
                                id: "test-youtube-video-id",
                                snippet: {
                                    title: request.requestBody.snippet.title,
                                },
                                status: {
                                    privacyStatus:
                                        request.requestBody.status.privacyStatus,
                                    uploadStatus: "uploaded",
                                },
                            },
                        };
                    },
                },
            };
        };

        const result = await YouTubeUploadService.upload({
            videoPath,
            metadata,
            authClient: fakeAuthClient,
            youtubeClientFactory: fakeYoutubeClientFactory,
        });

        assert.equal(result.id, "test-youtube-video-id");

        assert.equal(
            result.url,
            "https://www.youtube.com/watch?v=test-youtube-video-id"
        );

        assert.equal(result.privacyStatus, "private");
        assert.equal(result.uploadStatus, "uploaded");

        console.log("✅ Video upload response is processed");

        assert.equal(
            capturedRequest.requestBody.status.privacyStatus,
            "private"
        );

        assert.equal(capturedRequest.notifySubscribers, false);

        console.log("✅ Private privacy is used by default");

        assert.deepEqual(
            capturedRequest.requestBody.snippet.tags,
            [
                "LanguageLearning",
                "Vocabulary",
                "Apple",
            ]
        );

        assert.ok(
            capturedRequest.requestBody.snippet.description.includes(
                "#LanguageLearning #Vocabulary #Apple"
            )
        );

        console.log("✅ YouTube metadata and hashtags are prepared");

        assert.equal(capturedRequest.media.mimeType, "video/mp4");

        assert.deepEqual(
            capturedVideoContent,
            Buffer.from("fake-video-content")
        );

        console.log("✅ Video is passed through a readable stream");

        const customResult = await YouTubeUploadService.upload({
            videoPath,
            metadata,
            title: "Custom Apple title",
            description: "Custom description",
            hashtags: ["#Custom"],
            privacyStatus: "unlisted",
            notifySubscribers: true,
            authClient: fakeAuthClient,
            youtubeClientFactory: fakeYoutubeClientFactory,
        });

        assert.equal(
            capturedRequest.requestBody.snippet.title,
            "Custom Apple title"
        );

        assert.equal(
            capturedRequest.requestBody.status.privacyStatus,
            "unlisted"
        );

        assert.equal(capturedRequest.notifySubscribers, true);

        assert.equal(
            capturedRequest.requestBody.snippet.description,
            "Custom description\n\n#Custom"
        );

        assert.equal(customResult.privacyStatus, "unlisted");

        console.log("✅ Custom metadata and privacy are supported");

        await assert.rejects(
            YouTubeUploadService.upload({
                videoPath: path.join(tempRoot, "missing.mp4"),
                metadata,
                authClient: fakeAuthClient,
                youtubeClientFactory: fakeYoutubeClientFactory,
            }),
            /Video file not found/
        );

        console.log("✅ Missing video file is rejected");

        const emptyVideoPath = path.join(
            tempRoot,
            "empty-video.mp4"
        );

        await writeFile(emptyVideoPath, "");

        await assert.rejects(
            YouTubeUploadService.upload({
                videoPath: emptyVideoPath,
                metadata,
                authClient: fakeAuthClient,
                youtubeClientFactory: fakeYoutubeClientFactory,
            }),
            /Video file is empty/
        );

        console.log("✅ Empty video file is rejected");

        await assert.rejects(
            YouTubeUploadService.upload({
                videoPath,
                metadata,
                privacyStatus: "invalid",
                authClient: fakeAuthClient,
                youtubeClientFactory: fakeYoutubeClientFactory,
            }),
            /Invalid YouTube privacy status/
        );

        console.log("✅ Invalid privacy status is rejected");

        await assert.rejects(
            YouTubeUploadService.upload({
                videoPath,
                metadata: {
                    platforms: {
                        youtubeShorts: {
                            title: "",
                            description: "Description",
                        },
                    },
                },
                authClient: fakeAuthClient,
                youtubeClientFactory: fakeYoutubeClientFactory,
            }),
            /YouTube video title is required/
        );

        console.log("✅ Missing video title is rejected");

        await assert.rejects(
            YouTubeUploadService.upload({
                videoPath,
                metadata,
                title: "A".repeat(101),
                authClient: fakeAuthClient,
                youtubeClientFactory: fakeYoutubeClientFactory,
            }),
            /cannot exceed 100 characters/
        );

        console.log("✅ Title length is validated");

        const unsupportedPath = path.join(
            tempRoot,
            "test-video.txt"
        );

        await writeFile(unsupportedPath, "not a video");

        await assert.rejects(
            YouTubeUploadService.upload({
                videoPath: unsupportedPath,
                metadata,
                authClient: fakeAuthClient,
                youtubeClientFactory: fakeYoutubeClientFactory,
            }),
            /Unsupported video format/
        );

        console.log("✅ Unsupported video format is rejected");

        console.log("\n✅ All YouTube upload service tests passed");
    } finally {
        await rm(tempRoot, {
            recursive: true,
            force: true,
        });
    }
}

runTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
