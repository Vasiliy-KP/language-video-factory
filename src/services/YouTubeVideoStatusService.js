
import { google } from "googleapis";

import {
    YouTubeAuthService,
} from "./YouTubeAuthService.js";

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function validateVideoId(videoId) {
    if (
        typeof videoId !== "string" ||
        !VIDEO_ID_PATTERN.test(videoId.trim())
    ) {
        throw new Error(
            "Invalid YouTube video ID. Expected an 11-character video ID."
        );
    }

    return videoId.trim();
}

function calculateProgress(progress) {
    if (!progress) {
        return null;
    }

    const partsTotal = Number(progress.partsTotal);
    const partsProcessed = Number(progress.partsProcessed);

    if (
        !Number.isFinite(partsTotal) ||
        !Number.isFinite(partsProcessed) ||
        partsTotal <= 0
    ) {
        return null;
    }

    return {
        partsTotal,
        partsProcessed,
        percent: Math.min(
            100,
            Math.round((partsProcessed / partsTotal) * 100)
        ),
        timeLeftMs:
            Number.isFinite(Number(progress.timeLeftMs))
                ? Number(progress.timeLeftMs)
                : null,
    };
}

function extractApiError(error) {
    return (
        error.response?.data?.error?.message ||
        error.errors?.[0]?.message ||
        error.message ||
        "Unknown YouTube API error."
    );
}

export class YouTubeVideoStatusService {
    static async getStatus({
        videoId,
        authClient,
        getAuthClient = () =>
            YouTubeAuthService.getAuthenticatedClient(),
        youtubeClientFactory = (auth) =>
            google.youtube({
                version: "v3",
                auth,
            }),
    } = {}) {
        const normalizedVideoId = validateVideoId(videoId);

        const auth = authClient ?? await getAuthClient();

        if (!auth) {
            throw new Error(
                "YouTube authentication is unavailable."
            );
        }

        const youtube = youtubeClientFactory(auth);

        if (
            !youtube?.videos ||
            typeof youtube.videos.list !== "function"
        ) {
            throw new Error(
                "YouTube API client is not configured correctly."
            );
        }

        try {
            const response = await youtube.videos.list({
                part: [
                    "id",
                    "snippet",
                    "status",
                    "processingDetails",
                ],
                id: normalizedVideoId,
            });

            const video = response?.data?.items?.[0];

            if (!video) {
                throw new Error(
                    `YouTube video not found: ${normalizedVideoId}`
                );
            }

            const processingDetails =
                video.processingDetails ?? {};

            const videoStatus = video.status ?? {};

            const processingStatus =
                processingDetails.processingStatus ?? "unknown";

            const uploadStatus =
                videoStatus.uploadStatus ?? "unknown";

            const isProcessingComplete =
                processingStatus === "succeeded" ||
                uploadStatus === "processed";

            return {
                videoId: video.id ?? normalizedVideoId,
                url: `https://www.youtube.com/watch?v=${normalizedVideoId}`,
                title: video.snippet?.title ?? null,

                // Окремо повертаємо статус завантаження
                // та статус обробки YouTube.
                uploadStatus,
                processingStatus,
                isProcessingComplete,

                // Це лише прочитане значення.
                // Сервіс ніколи його не змінює.
                privacyStatus:
                    videoStatus.privacyStatus ?? "unknown",

                processingProgress: calculateProgress(
                    processingDetails.processingProgress
                ),

                processingFailureReason:
                    processingDetails.processingFailureReason ?? null,

                failureReason:
                    videoStatus.failureReason ?? null,

                rejectionReason:
                    videoStatus.rejectionReason ?? null,
            };
        } catch (error) {
            if (
                error.message?.startsWith("YouTube video not found:")
            ) {
                throw error;
            }

            throw new Error(
                `YouTube status check failed: ${extractApiError(error)}`,
                { cause: error }
            );
        }
    }
}
