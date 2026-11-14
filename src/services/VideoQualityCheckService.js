
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const COMMAND_OPTIONS = {
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
};

function parseNumber(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const result = Number(value);

    return Number.isFinite(result) ? result : null;
}

function parseFrameRate(value) {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }

    const parts = value.split("/");

    if (parts.length === 1) {
        const result = Number(parts[0]);

        return Number.isFinite(result) && result > 0
            ? result
            : null;
    }

    if (parts.length !== 2) {
        return null;
    }

    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);

    if (
        !Number.isFinite(numerator) ||
        !Number.isFinite(denominator) ||
        numerator <= 0 ||
        denominator <= 0
    ) {
        return null;
    }

    return numerator / denominator;
}

function normalizeVideoStream(stream) {
    return {
        index: parseNumber(stream.index),
        codec: stream.codec_name?.toLowerCase() ?? null,
        width: parseNumber(stream.width),
        height: parseNumber(stream.height),
        frameRate:
            parseFrameRate(stream.avg_frame_rate) ??
            parseFrameRate(stream.r_frame_rate),
        durationSeconds: parseNumber(stream.duration),
        bitRateBps: parseNumber(stream.bit_rate),
    };
}

function normalizeAudioStream(stream) {
    return {
        index: parseNumber(stream.index),
        codec: stream.codec_name?.toLowerCase() ?? null,
        sampleRate: parseNumber(stream.sample_rate),
        channels: parseNumber(stream.channels),
        durationSeconds: parseNumber(stream.duration),
        bitRateBps: parseNumber(stream.bit_rate),
    };
}

export class VideoQualityCheckService {
    static async inspect({
        videoPath,
        projectRoot = process.cwd(),
        execFile: executeFile = execFileAsync,
        verifyDecode = true,
    } = {}) {
        if (
            typeof videoPath !== "string" ||
            !videoPath.trim()
        ) {
            throw new Error("Video file path is required.");
        }

        if (typeof verifyDecode !== "boolean") {
            throw new Error("verifyDecode must be a boolean.");
        }

        const resolvedPath = path.resolve(
            projectRoot,
            videoPath
        );

        let fileStats;

        try {
            fileStats = await stat(resolvedPath);
        } catch (error) {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") {
                throw new Error(
                    `Video file not found: ${resolvedPath}`
                );
            }

            throw error;
        }

        if (!fileStats.isFile()) {
            throw new Error("Video path must point to a file.");
        }

        if (fileStats.size <= 0) {
            throw new Error("Video file is empty.");
        }

        const ffprobeArguments = [
            "-v", "error",
            "-show_entries",
            [
                "format=format_name,duration,size,bit_rate",
                "stream=index,codec_type,codec_name,width,height",
                "stream=avg_frame_rate,r_frame_rate,duration",
                "stream=sample_rate,channels,bit_rate",
            ].join(":"),
            "-of", "json",
            resolvedPath,
        ];

        let probeResponse;

        try {
            probeResponse = await executeFile(
                "ffprobe",
                ffprobeArguments,
                COMMAND_OPTIONS
            );
        } catch (error) {
            throw new Error(
                `Could not inspect video with ffprobe: ${error.message}`,
                { cause: error }
            );
        }

        let probeData;

        try {
            probeData = JSON.parse(probeResponse.stdout);
        } catch (error) {
            throw new Error(
                "FFprobe returned invalid JSON.",
                { cause: error }
            );
        }

        const format = probeData.format ?? {};
        const streams = Array.isArray(probeData.streams)
            ? probeData.streams
            : [];

        const videoStreams = streams
            .filter((stream) => stream.codec_type === "video")
            .map(normalizeVideoStream);

        const audioStreams = streams
            .filter((stream) => stream.codec_type === "audio")
            .map(normalizeAudioStream);

        if (videoStreams.length === 0) {
            throw new Error("No video stream found.");
        }

        const primaryVideo = videoStreams[0];
        const primaryAudio = audioStreams[0] ?? null;

        let integrity = {
            checked: false,
            valid: null,
        };

        if (verifyDecode) {
            const ffmpegArguments = [
                "-nostdin",
                "-v", "error",
                "-xerror",
                "-i", resolvedPath,
                "-map", "0:v:0",
                "-map", "0:a?",
                "-f", "null",
                "-",
            ];

            try {
                await executeFile(
                    "ffmpeg",
                    ffmpegArguments,
                    COMMAND_OPTIONS
                );

                integrity = {
                    checked: true,
                    valid: true,
                };
            } catch (error) {
                const diagnostic = String(
                    error.stderr ?? error.message
                )
                    .trim()
                    .slice(0, 1000);

                throw new Error(
                    `Video integrity check failed: ${diagnostic || error.message}`,
                    { cause: error }
                );
            }
        }

        const containerFormats = String(
            format.format_name ?? ""
        )
            .split(",")
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean);

        return {
            path: resolvedPath,

            containerFormats,

            durationSeconds: parseNumber(format.duration),
            fileSizeBytes:
                parseNumber(format.size) ?? fileStats.size,
            bitRateBps: parseNumber(format.bit_rate),

            videoCodec: primaryVideo.codec,
            width: primaryVideo.width,
            height: primaryVideo.height,
            frameRate: primaryVideo.frameRate,

            videoStreamDurationSeconds:
                primaryVideo.durationSeconds,

            videoStreamCount: videoStreams.length,
            videoStreams,

            hasAudio: audioStreams.length > 0,
            audioCodec: primaryAudio?.codec ?? null,
            audioSampleRate: primaryAudio?.sampleRate ?? null,
            audioChannels: primaryAudio?.channels ?? null,

            audioStreamDurationSeconds:
                primaryAudio?.durationSeconds ?? null,

            audioStreamCount: audioStreams.length,
            audioStreams,

            integrity,
        };
    }
}
