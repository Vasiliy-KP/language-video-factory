
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
    VideoQualityCheckService,
} from "./src/services/VideoQualityCheckService.js";

async function runTests() {
    const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "video-quality-check-test-")
    );

    try {
        console.log("▶ Testing VideoQualityCheckService...");

        const videoPath = path.join(
            tempRoot,
            "output",
            "videos",
            "sample.mp4"
        );

        await mkdir(path.dirname(videoPath), {
            recursive: true,
        });

        await writeFile(videoPath, "fake-video-content");

        const videoContentSize = Buffer.byteLength(
            "fake-video-content"
        );

        const probeData = {
            format: {
                format_name: "mov,mp4,m4a,3gp,3g2,mj2",
                duration: "9.961958",
                size: String(videoContentSize),
                bit_rate: "400000",
            },
            streams: [
                {
                    index: 0,
                    codec_type: "video",
                    codec_name: "h264",
                    width: 1080,
                    height: 1920,
                    avg_frame_rate: "30/1",
                    r_frame_rate: "30/1",
                    duration: "9.833333",
                    bit_rate: "305332",
                },
                {
                    index: 1,
                    codec_type: "audio",
                    codec_name: "aac",
                    sample_rate: "48000",
                    channels: 1,
                    duration: "9.961958",
                    bit_rate: "122633",
                },
                {
                    index: 2,
                    codec_type: "audio",
                    codec_name: "aac",
                    sample_rate: "48000",
                    channels: 2,
                    duration: "9.961958",
                    bit_rate: "96000",
                },
            ],
        };

        const calls = [];

        const mockExecFile = async (
            command,
            args,
            options
        ) => {
            calls.push({
                command,
                args,
                options,
            });

            if (command === "ffprobe") {
                return {
                    stdout: JSON.stringify(probeData),
                    stderr: "",
                };
            }

            if (command === "ffmpeg") {
                return {
                    stdout: "",
                    stderr: "",
                };
            }

            throw new Error(`Unexpected command: ${command}`);
        };

        // 1. Valid video inspection.
        const result = await VideoQualityCheckService.inspect({
            videoPath,
            projectRoot: tempRoot,
            execFile: mockExecFile,
        });

        assert.deepEqual(
            result.containerFormats,
            ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"]
        );

        assert.equal(result.durationSeconds, 9.961958);
        assert.equal(result.fileSizeBytes, videoContentSize);

        assert.equal(result.videoCodec, "h264");
        assert.equal(result.width, 1080);
        assert.equal(result.height, 1920);
        assert.equal(result.frameRate, 30);

        assert.equal(result.videoStreamDurationSeconds, 9.833333);
        assert.equal(result.videoStreamCount, 1);

        assert.equal(result.hasAudio, true);
        assert.equal(result.audioCodec, "aac");
        assert.equal(result.audioSampleRate, 48000);
        assert.equal(result.audioChannels, 1);
        assert.equal(result.audioStreamCount, 2);

        assert.deepEqual(result.integrity, {
            checked: true,
            valid: true,
        });

        console.log("✅ Video metadata is inspected");

        // 2. All audio and video streams are returned.
        assert.equal(result.videoStreams.length, 1);
        assert.equal(result.audioStreams.length, 2);
        assert.equal(result.audioStreams[1].channels, 2);

        console.log("✅ All media streams are inspected");

        // 3. FFprobe is executed before FFmpeg.
        assert.deepEqual(
            calls.map((call) => call.command),
            ["ffprobe", "ffmpeg"]
        );

        assert.ok(
            calls[1].args.includes("-xerror")
        );

        assert.ok(
            calls[1].args.includes("0:v:0")
        );

        assert.ok(
            calls[1].args.includes("0:a?")
        );

        console.log("✅ Full media decoding is executed");

        // 4. Missing video is rejected.
        await assert.rejects(
            VideoQualityCheckService.inspect({
                videoPath: path.join(tempRoot, "missing.mp4"),
                projectRoot: tempRoot,
                execFile: mockExecFile,
            }),
            /Video file not found/
        );

        console.log("✅ Missing video file is rejected");

        // 5. Empty video is rejected.
        const emptyVideoPath = path.join(
            tempRoot,
            "empty.mp4"
        );

        await writeFile(emptyVideoPath, "");

        await assert.rejects(
            VideoQualityCheckService.inspect({
                videoPath: emptyVideoPath,
                projectRoot: tempRoot,
                execFile: mockExecFile,
            }),
            /Video file is empty/
        );

        console.log("✅ Empty video file is rejected");

        // 6. Video without a video stream is rejected.
        const noVideoExecFile = async (command) => {
            if (command === "ffprobe") {
                return {
                    stdout: JSON.stringify({
                        format: {
                            format_name: "mp3",
                            duration: "10",
                            size: "100",
                        },
                        streams: [
                            {
                                codec_type: "audio",
                                codec_name: "mp3",
                            },
                        ],
                    }),
                    stderr: "",
                };
            }

            throw new Error("FFmpeg must not run.");
        };

        await assert.rejects(
            VideoQualityCheckService.inspect({
                videoPath,
                projectRoot: tempRoot,
                execFile: noVideoExecFile,
            }),
            /No video stream found/
        );

        console.log("✅ Missing video stream is rejected");

        // 7. Invalid FFprobe JSON is rejected.
        const invalidJsonExecFile = async () => ({
            stdout: "{invalid-json",
            stderr: "",
        });

        await assert.rejects(
            VideoQualityCheckService.inspect({
                videoPath,
                projectRoot: tempRoot,
                execFile: invalidJsonExecFile,
            }),
            /FFprobe returned invalid JSON/
        );

        console.log("✅ Invalid FFprobe JSON is rejected");

        // 8. FFmpeg decode errors are reported.
        const failingFfmpeg = async (command) => {
            if (command === "ffprobe") {
                return {
                    stdout: JSON.stringify(probeData),
                    stderr: "",
                };
            }

            const error = new Error("FFmpeg exited with code 1");
            error.stderr = "corrupt frame detected";

            throw error;
        };

        await assert.rejects(
            VideoQualityCheckService.inspect({
                videoPath,
                projectRoot: tempRoot,
                execFile: failingFfmpeg,
            }),
            /Video integrity check failed: corrupt frame detected/
        );

        console.log("✅ Corrupted video decoding errors are detected");

        // 9. Decode verification can be explicitly disabled.
        const probeOnlyCalls = [];

        const probeOnlyExecFile = async (command) => {
            probeOnlyCalls.push(command);

            return {
                stdout: JSON.stringify(probeData),
                stderr: "",
            };
        };

        const probeOnlyResult =
            await VideoQualityCheckService.inspect({
                videoPath,
                projectRoot: tempRoot,
                execFile: probeOnlyExecFile,
                verifyDecode: false,
            });

        assert.deepEqual(probeOnlyCalls, ["ffprobe"]);

        assert.deepEqual(probeOnlyResult.integrity, {
            checked: false,
            valid: null,
        });

        console.log("✅ Optional decode verification is supported");

        // 10. Invalid configuration is rejected.
        await assert.rejects(
            VideoQualityCheckService.inspect({
                videoPath,
                projectRoot: tempRoot,
                execFile: mockExecFile,
                verifyDecode: "yes",
            }),
            /verifyDecode must be a boolean/
        );

        console.log("✅ Invalid verification configuration is rejected");

        console.log(
            "\n✅ All VideoQualityCheckService tests passed"
        );
    } finally {
        await rm(tempRoot, {
            recursive: true,
            force: true,
        });
    }
}

runTests().catch((error) => {
    console.error("\n❌ VideoQualityCheckService tests failed:");
    console.error(error);
    process.exitCode = 1;
});
