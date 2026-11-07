
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import { google } from "googleapis";

import {
    YouTubeAuthService,
} from "./YouTubeAuthService.js";

const VIDEO_MIME_TYPES = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".webm": "video/webm",
};

const PRIVACY_STATUSES = [
    "private",
    "unlisted",
    "public",
];

function validateVideoMetadata({
    metadata,
    title,
    description,
    hashtags,
    tags,
}) {
    const platformMetadata = metadata?.platforms?.youtubeShorts;

    if (!platformMetadata || typeof platformMetadata !== "object") {
        throw new Error(
            "YouTube Shorts metadata is missing."
        );
    }

    const finalTitle = (
        title ?? platformMetadata.title ?? ""
    ).trim();

    if (!finalTitle) {
        throw new Error("YouTube video title is required.");
    }

    if (Array.from(finalTitle).length > 100) {
        throw new Error(
            "YouTube video title cannot exceed 100 characters."
        );
    }

    if (/[<>]/.test(finalTitle)) {
        throw new Error(
            "YouTube video title cannot contain < or >."
        );
    }

    const finalHashtags = hashtags ?? platformMetadata.hashtags ?? [];

    if (!Array.isArray(finalHashtags)) {
        throw new Error("YouTube hashtags must be an array.");
    }

    const normalizedHashtags = [
        ...new Set(
            finalHashtags.map((hashtag) => {
                if (typeof hashtag !== "string") {
                    throw new Error(
                        "Every YouTube hashtag must be a string."
                    );
                }

                const value = hashtag.trim();

                return value.startsWith("#")
                    ? value
                    : `#${value}`;
            }).filter((hashtag) => hashtag.length > 1)
        ),
    ];

    const baseDescription = (
        description ?? platformMetadata.description ?? ""
    ).trim();

    const finalDescription = [
        baseDescription,
        normalizedHashtags.join(" "),
    ].filter(Boolean).join("\n\n");

    if (!finalDescription) {
        throw new Error("YouTube video description is required.");
    }

    if (Buffer.byteLength(finalDescription, "utf8") > 5000) {
        throw new Error(
            "YouTube video description cannot exceed 5000 bytes."
        );
    }

    if (/[<>]/.test(finalDescription)) {
        throw new Error(
            "YouTube video description cannot contain < or >."
        );
    }

    const finalTags = tags ?? normalizedHashtags.map(
        (hashtag) => hashtag.slice(1)
    );

    if (!Array.isArray(finalTags)) {
        throw new Error("YouTube tags must be an array.");
    }

    const normalizedTags = [
        ...new Set(
            finalTags.map((tag) => {
                if (typeof tag !== "string" || !tag.trim()) {
                    throw new Error(
                        "Every YouTube tag must be a non-empty string."
                    );
                }

                return tag.trim();
            })
        ),
    ];

    const tagsLength = normalizedTags.join(",").length +
        normalizedTags.filter((tag) => tag.includes(" ")).length * 2;

    if (tagsLength > 500) {
        throw new Error(
            "Combined YouTube tags length cannot exceed 500 characters."
        );
    }

    return {
        title: finalTitle,
        description: finalDescription,
        tags: normalizedTags,
    };
}

export class YouTubeUploadService {
    static async upload({
        videoPath,
        metadata,
        title,
        description,
        hashtags,
        tags,
        privacyStatus = "private",
        notifySubscribers = false,
        authClient,
        getAuthClient = () =>
            YouTubeAuthService.getAuthenticatedClient(),
        youtubeClientFactory = (auth) =>
            google.youtube({
                version: "v3",
                auth,
            }),
        fileStat = stat,
        createVideoStream = createReadStream,
        onProgress,
    } = {}) {
        if (
            typeof videoPath !== "string" ||
            !videoPath.trim()
        ) {
            throw new Error("Video file path is required.");
        }

        const resolvedVideoPath = path.resolve(videoPath);

        let fileInfo;

        try {
            fileInfo = await fileStat(resolvedVideoPath);
        } catch (error) {
            if (error.code === "ENOENT") {
                throw new Error(
                    `Video file not found: ${resolvedVideoPath}`
                );
            }

            throw error;
        }

        if (!fileInfo.isFile()) {
            throw new Error("Video path must point to a file.");
        }

        if (fileInfo.size <= 0) {
            throw new Error("Video file is empty.");
        }

        const extension = path.extname(resolvedVideoPath).toLowerCase();
        const mimeType = VIDEO_MIME_TYPES[extension];

        if (!mimeType) {
            throw new Error(
                `Unsupported video format: ${extension || "(no extension)"}`
            );
        }

        if (!PRIVACY_STATUSES.includes(privacyStatus)) {
            throw new Error(
                `Invalid YouTube privacy status: ${privacyStatus}`
            );
        }

        if (typeof notifySubscribers !== "boolean") {
            throw new Error(
                "notifySubscribers must be a boolean."
            );
        }

        if (onProgress !== undefined && typeof onProgress !== "function") {
            throw new Error("onProgress must be a function.");
        }

        const videoMetadata = validateVideoMetadata({
            metadata,
            title,
            description,
            hashtags,
            tags,
        });

        const auth = authClient ?? await getAuthClient();

        const youtube = youtubeClientFactory(auth);

        if (
            !youtube?.videos ||
            typeof youtube.videos.insert !== "function"
        ) {
            throw new Error(
                "YouTube API client is not configured correctly."
            );
        }

        const mediaStream = createVideoStream(resolvedVideoPath);

        const requestBody = {
            snippet: videoMetadata,
            status: {
                privacyStatus,
            },
        };

        try {
            const request = youtube.videos.insert(
                {
                    part: ["id", "snippet", "status"],
                    notifySubscribers,
                    requestBody,
                    media: {
                        mimeType,
                        body: mediaStream,
                    },
                },
                onProgress
                    ? {
                        onUploadProgress: (event) => {
                            const bytesUploaded = event.bytesRead ?? 0;

                            onProgress({
                                bytesUploaded,
                                totalBytes: fileInfo.size,
                                percent: Math.min(
                                    100,
                                    Math.round(
                                        (bytesUploaded / fileInfo.size) * 100
                                    )
                                ),
                            });
                        },
                    }
                    : undefined
            );

            const response = await request;
            const video = response?.data;

            if (!video?.id) {
                throw new Error(
                    "YouTube API did not return a video ID."
                );
            }

            return {
                id: video.id,
                url: `https://www.youtube.com/watch?v=${video.id}`,
                title: video.snippet?.title ?? videoMetadata.title,
                privacyStatus:
                    video.status?.privacyStatus ?? privacyStatus,
                uploadStatus: video.status?.uploadStatus ?? "uploaded",
            };
        } catch (error) {
            mediaStream.destroy();

            throw new Error(
                `YouTube video upload failed: ${error.message}`,
                { cause: error }
            );
        }
    }
}
