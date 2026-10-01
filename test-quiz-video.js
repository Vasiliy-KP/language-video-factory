import "dotenv/config";

import {
    QuizTimelineService,
} from "./src/services/video/QuizTimelineService.js";

import {
    QuizAudioService,
} from "./src/services/audio/QuizAudioService.js";

import {
    VideoRenderService,
} from "./src/services/video/VideoRenderService.js";

import {
    AudioMetadataService,
} from "./src/services/audio/AudioMetadataService.js";

import {
    OutputPathService,
} from "./src/services/OutputPathService.js";

import {
    languages,
} from "./src/config/languages.js";

const timelineService =
    new QuizTimelineService(0.8);

const audioService =
    new QuizAudioService();

const renderer =
    new VideoRenderService();

const audioMetadata =
    new AudioMetadataService();

const word = {
    id: 1,
    category: "Transport",
    uk: "велосипед",
    en: "Bicycle",
    pl: "Rower",
    fr: "Vélo",
    de: "Fahrrad",
    level: "A1",
};

console.log(
    "▶ Creating quiz timeline..."
);

const timeline =
    await timelineService.createForWord(
        word,
        languages,
        OutputPathService
    );

const duration =
    timelineService.getDuration(
        timeline
    );

console.log(
    `Expected duration: ${duration.toFixed(3)} s`
);

const audioPath =
    "output/temp/test-bicycle-quiz.mp3";

const visualPath =
    "output/videos/test-bicycle-quiz-visual.mp4";

console.log(
    "\n▶ Creating quiz audio..."
);

await audioService.create(
    timeline,
    audioPath
);

console.log(
    "✅ Quiz audio created"
);

console.log(
    "\n▶ Creating quiz visual..."
);

await renderer.renderQuiz(
    word,
    "output/images/bicycle.png",
    timeline,
    visualPath,
    duration,
    "minimal",
    "quiz"
);

console.log(
    `✅ Quiz visual created: ${visualPath}`
);

const actualAudioDuration =
    await audioMetadata.getDuration(
        audioPath
    );

console.log(
    `\nAudio duration:  ${actualAudioDuration.toFixed(3)} s`
);

console.log(
    `Video duration:  ${duration.toFixed(3)} s`
);

const difference =
    Math.abs(
        actualAudioDuration -
        duration
    );

if (difference > 0.1) {
    throw new Error(
        `Audio/video duration mismatch: ${difference.toFixed(3)} s`
    );
}

console.log(
    "✅ Quiz audio and visual durations match."
);

console.log(
    "✅ Quiz video test completed"
);