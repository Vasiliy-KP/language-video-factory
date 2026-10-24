
import {
    access,
    mkdir,
    readFile,
    stat,
    writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const PLATFORM_FILES = {
    tiktok: "tiktok.txt",
    instagram: "instagram.txt",
    youtubeShorts: "youtube-shorts.txt",
};

const PLATFORM_RULES = {
    tiktok: {
        containers: ["mp4", "mov", "webm"],
        videoCodecs: ["h264", "hevc", "h265", "vp8", "vp9"],
        minFps: 23,
        maxFps: 60,
        minDimension: 360,
        maxDimension: 4096,
        maxFileSize: 4 * 1024 ** 3,
        maxDuration: 600,
        recommendedMaxDuration: 180,
    },

    instagram: {
        containers: ["mp4", "mov"],
        videoCodecs: ["h264", "hevc"],
        minFps: 23,
        maxFps: 60,
        minDuration: 3,
        maxDuration: 900,
        maxWidth: 1920,
        maxFileSize: 1 * 1024 ** 3,
        audioCodec: "aac",
        audioSampleRate: 48000,
        minAspectRatio: 9 / 16,
        maxAspectRatio: 1.91,
    },

    youtubeShorts: {
        containers: ["mp4", "mov", "webm"],
        videoCodecs: ["h264", "hevc", "vp8", "vp9", "av1"],
        minFps: 23,
        maxFps: 60,
        maxDuration: 180,
        minDimension: 360,
        aspectRatio: "square-or-vertical",
    },
};

async function isFile(filePath) {
    if (!filePath) {
        return false;
    }

    try {
        return (await stat(filePath)).isFile();
    } catch (error) {
        if (
            error.code === "ENOENT" ||
            error.code === "ENOTDIR"
        ) {
            return false;
        }

        throw error;
    }
}

function parseFrameRate(value) {
    if (!value) {
        return null;
    }

    const [numerator, denominator] = value.split("/").map(Number);

    if (
        !Number.isFinite(numerator) ||
        !Number.isFinite(denominator) ||
        denominator === 0
    ) {
        return null;
    }

    return numerator / denominator;
}

async function probeVideo(videoPath) {
    const { stdout } = await execFileAsync(
        "ffprobe",
        [
            "-v", "error",
            "-show_entries",
            [
                "format=format_name,duration,size,bit_rate",
                "stream=codec_type,codec_name,width,height",
                "stream=avg_frame_rate,r_frame_rate",
                "stream=sample_rate,channels,bit_rate",
            ].join(":"),
            "-of", "json",
            videoPath,
        ],
        {
            windowsHide: true,
            maxBuffer: 8 * 1024 * 1024,
        }
    );

    const result = JSON.parse(stdout);
    const format = result.format ?? {};
    const streams = result.streams ?? [];

    const video = streams.find(
        (stream) => stream.codec_type === "video"
    );

    const audio = streams.find(
        (stream) => stream.codec_type === "audio"
    );

    if (!video) {
        throw new Error("No video stream found.");
    }

    const fileStats = await stat(videoPath);

    return {
        containerFormats: String(format.format_name ?? "")
            .split(",")
            .filter(Boolean),

        durationSeconds: Number(format.duration),
        fileSizeBytes: Number(format.size) || fileStats.size,

        videoCodec: video.codec_name?.toLowerCase() ?? null,
        width: Number(video.width) || null,
        height: Number(video.height) || null,

        frameRate:
            parseFrameRate(video.avg_frame_rate) ??
            parseFrameRate(video.r_frame_rate),

        hasAudio: Boolean(audio),
        audioCodec: audio?.codec_name?.toLowerCase() ?? null,
        audioSampleRate: Number(audio?.sample_rate) || null,
    };
}

function validatePlatform(platform, video) {
    const rules = PLATFORM_RULES[platform];
    const errors = [];
    const warnings = [];

    const addError = (code, message) => {
        errors.push({ code, message });
    };

    const addWarning = (code, message) => {
        warnings.push({ code, message });
    };

    if (
        !video.containerFormats.some(
            (format) => rules.containers.includes(format)
        )
    ) {
        addError(
            "unsupported_container",
            `Unsupported video container: ${video.containerFormats.join(", ") || "unknown"}`
        );
    }

    if (!rules.videoCodecs.includes(video.videoCodec)) {
        addError(
            "unsupported_video_codec",
            `Unsupported video codec: ${video.videoCodec ?? "unknown"}`
        );
    }

    if (
        !Number.isFinite(video.durationSeconds) ||
        video.durationSeconds <= 0
    ) {
        addError("invalid_duration", "Cannot determine video duration.");
    } else {
        if (
            rules.minDuration !== undefined &&
            video.durationSeconds < rules.minDuration
        ) {
            addError(
                "duration_too_short",
                `Video must be at least ${rules.minDuration} seconds long.`
            );
        }

        if (video.durationSeconds > rules.maxDuration) {
            addError(
                "duration_too_long",
                `Video exceeds the ${rules.maxDuration}-second limit.`
            );
        }

        if (
            platform === "tiktok" &&
            video.durationSeconds > rules.recommendedMaxDuration &&
            video.durationSeconds <= rules.maxDuration
        ) {
            addWarning(
                "account_duration_limit",
                "TikTok's available duration limit depends on account privileges. Verify the limit for the target account."
            );
        }
    }

    if (
        !Number.isFinite(video.frameRate) ||
        video.frameRate < rules.minFps ||
        video.frameRate > rules.maxFps
    ) {
        addError(
            "unsupported_frame_rate",
            `Frame rate must be between ${rules.minFps} and ${rules.maxFps} FPS.`
        );
    }

    if (
        !Number.isFinite(video.width) ||
        !Number.isFinite(video.height)
    ) {
        addError(
            "invalid_dimensions",
            "Cannot determine video dimensions."
        );
    } else {
        if (
            rules.minDimension &&
            (video.width < rules.minDimension ||
                video.height < rules.minDimension)
        ) {
            addError(
                "resolution_too_low",
                `Width and height must both be at least ${rules.minDimension} pixels.`
            );
        }

        if (
            rules.maxDimension &&
            (video.width > rules.maxDimension ||
                video.height > rules.maxDimension)
        ) {
            addError(
                "resolution_too_high",
                `Width and height must not exceed ${rules.maxDimension} pixels.`
            );
        }

        const ratio = video.width / video.height;
        const isVertical916 = Math.abs(ratio - 9 / 16) < 0.02;

        if (!isVertical916) {
            addWarning(
                "non_vertical_format",
                "A 9:16 vertical video is recommended for short-form content."
            );
        }

        if (
            rules.aspectRatio === "square-or-vertical" &&
            video.width > video.height
        ) {
            addError(
                "invalid_aspect_ratio",
                "YouTube Shorts requires a square or vertical video."
            );
        }

        if (
            rules.minAspectRatio !== undefined &&
            (ratio < rules.minAspectRatio || ratio > rules.maxAspectRatio)
        ) {
            addError(
                "invalid_aspect_ratio",
                "Video aspect ratio is outside the supported Instagram Reels range."
            );
        }

        if (rules.maxWidth && video.width > rules.maxWidth) {
            addError(
                "width_too_high",
                `Video width exceeds ${rules.maxWidth} pixels.`
            );
        }
    }

    if (
        rules.maxFileSize &&
        video.fileSizeBytes > rules.maxFileSize
    ) {
        addError(
            "file_too_large",
            `Video file exceeds the ${rules.maxFileSize} byte limit.`
        );
    }

    if (!video.hasAudio) {
        addError("missing_audio", "Video has no audio stream.");
    }

    if (
        rules.audioCodec &&
        video.audioCodec !== rules.audioCodec
    ) {
        addError(
            "unsupported_audio_codec",
            `Audio codec must be ${rules.audioCodec}.`
        );
    }

    if (
        rules.audioSampleRate &&
        video.audioSampleRate !== rules.audioSampleRate
    ) {
        addError(
            "unsupported_audio_sample_rate",
            `Audio sample rate must be ${rules.audioSampleRate} Hz.`
        );
    }

    return {
        status: errors.length ? "needs_fixes" : "ready_for_review",
        errors,
        warnings,
    };
}

export class PublishingReadinessService {
    static async check(
        packageDirectory = "output/publishing/Bicycle",
        {
            projectRoot = process.cwd(),
            probe = probeVideo,
        } = {}
    ) {
        const root = path.resolve(projectRoot);
        const directory = path.resolve(root, packageDirectory);
        const manifestPath = path.join(directory, "manifest.json");

        const report = {
            schemaVersion: 1,
            word: null,
            checkedAt: new Date().toISOString(),
            status: "needs_fixes",
            errors: [],
            warnings: [],
            checks: {},
            platforms: {},
        };

        const addError = (code, message) => {
            report.errors.push({ code, message });
        };

        const finish = async () => {
            report.status = report.errors.length
                ? "needs_fixes"
                : "ready_for_review";

            await mkdir(directory, { recursive: true });

            const reportPath = path.join(directory, "readiness.json");

            await writeFile(
                reportPath,
                `${JSON.stringify(report, null, 2)}\n`,
                "utf8"
            );

            return report;
        };

        if (!(await isFile(manifestPath))) {
            addError("manifest_missing", "manifest.json was not found.");
            return finish();
        }

        let manifest;

        try {
            manifest = JSON.parse(
                await readFile(manifestPath, "utf8")
            );
        } catch {
            addError(
                "manifest_invalid",
                "manifest.json is not valid JSON."
            );

            return finish();
        }

        report.word = manifest.word ?? null;

        if (manifest.schemaVersion !== 1) {
            addError(
                "unsupported_manifest_version",
                "Unsupported manifest schema version."
            );
        }

        if (
            typeof manifest.word !== "string" ||
            !manifest.word.trim()
        ) {
            addError(
                "word_missing",
                "Manifest must contain a word."
            );
        }

        const videoReference = manifest.assets?.video?.path;
        const metadataReference = manifest.assets?.metadata?.path;

        const videoPath =
            typeof videoReference === "string" && videoReference.trim()
                ? path.resolve(root, videoReference)
                : null;

        const metadataPath =
            typeof metadataReference === "string" &&
                metadataReference.trim()
                ? path.resolve(root, metadataReference)
                : null;

        const [videoExists, metadataExists] = await Promise.all([
            isFile(videoPath),
            isFile(metadataPath),
        ]);

        report.checks.manifest = {
            valid: true,
            path: path.relative(root, manifestPath),
        };

        report.checks.video = {
            path: videoReference ?? null,
            exists: videoExists,
            info: null,
        };

        report.checks.metadata = {
            path: metadataReference ?? null,
            exists: metadataExists,
            validJson: false,
        };

        if (!videoPath || !videoExists) {
            addError(
                "video_missing",
                "The video referenced in the manifest was not found."
            );
        }

        if (!metadataPath || !metadataExists) {
            addError(
                "metadata_missing",
                "The metadata JSON referenced in the manifest was not found."
            );
        }

        if (
            manifest.assets?.video?.exists !== videoExists
        ) {
            addError(
                "video_manifest_mismatch",
                "The manifest video exists flag does not match the actual file."
            );
        }

        if (
            manifest.assets?.metadata?.exists !== metadataExists
        ) {
            addError(
                "metadata_manifest_mismatch",
                "The manifest metadata exists flag does not match the actual file."
            );
        }

        if (metadataExists) {
            try {
                const metadata = JSON.parse(
                    await readFile(metadataPath, "utf8")
                );

                report.checks.metadata.validJson =
                    Boolean(metadata && typeof metadata === "object");

                if (!report.checks.metadata.validJson) {
                    addError(
                        "metadata_invalid",
                        "Metadata JSON must contain an object."
                    );
                } else if (metadata.word !== manifest.word) {
                    addError(
                        "metadata_word_mismatch",
                        "Word in metadata does not match the manifest."
                    );
                }
            } catch {
                addError(
                    "metadata_invalid",
                    "Metadata file is not valid JSON."
                );
            }
        }

        report.checks.platformFiles = {};

        for (const [platform, fileName] of Object.entries(PLATFORM_FILES)) {
            const platformEntry = manifest.platforms?.[platform];
            const filePath = path.join(directory, fileName);
            const exists = await isFile(filePath);

            report.checks.platformFiles[platform] = {
                file: fileName,
                exists,
            };

            if (
                !platformEntry ||
                platformEntry.file !== fileName ||
                platformEntry.ready !== true
            ) {
                addError(
                    "platform_manifest_invalid",
                    `Manifest entry for ${platform} is missing or invalid.`
                );
            }

            if (!exists) {
                addError(
                    "platform_file_missing",
                    `Required publishing file is missing: ${fileName}`
                );
            }
        }

        if (videoExists) {
            try {
                const video = await probe(videoPath);

                report.checks.video.info = video;

                for (const platform of Object.keys(PLATFORM_RULES)) {
                    const result = validatePlatform(platform, video);

                    report.platforms[platform] = result;

                    for (const error of result.errors) {
                        report.errors.push({
                            platform,
                            ...error,
                        });
                    }

                    for (const warning of result.warnings) {
                        report.warnings.push({
                            platform,
                            ...warning,
                        });
                    }
                }
            } catch (error) {
                addError(
                    "video_probe_failed",
                    `Could not inspect video with ffprobe: ${error.message}`
                );
            }
        }

        return finish();
    }
}
