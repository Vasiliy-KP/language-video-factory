import "dotenv/config";

import {
    QuizTimelineService,
} from "./src/services/video/QuizTimelineService.js";

import {
    QuizAudioService,
} from "./src/services/audio/QuizAudioService.js";

import {
    AudioMetadataService,
} from "./src/services/audio/AudioMetadataService.js";

import {
    OutputPathService,
} from "./src/services/OutputPathService.js";

import {
    languages,
} from "./src/config/languages.js";

const quizTimelineService =
    new QuizTimelineService(0.8);

const quizAudioService =
    new QuizAudioService();

const audioMetadataService =
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
    await quizTimelineService.createForWord(
        word,
        languages,
        OutputPathService
    );

const expectedDuration =
    quizTimelineService.getDuration(
        timeline
    );

console.log(
    `Expected duration: ${expectedDuration.toFixed(3)} s`
);

const outputPath =
    "output/temp/test-bicycle-quiz.mp3";

console.log(
    "\n▶ Creating quiz audio..."
);

await quizAudioService.create(
    timeline,
    outputPath
);

console.log(
    `✅ Quiz audio created: ${outputPath}`
);

const actualDuration =
    await audioMetadataService.getDuration(
        outputPath
    );

console.log(
    `Actual duration:   ${actualDuration.toFixed(3)} s`
);

const difference =
    Math.abs(
        actualDuration -
        expectedDuration
    );

console.log(
    `Difference:         ${difference.toFixed(3)} s`
);

if (difference > 0.1) {
    throw new Error(
        `Quiz audio duration mismatch: ${difference.toFixed(3)} s`
    );
}

console.log(
    "✅ Quiz audio duration is within tolerance."
);

console.log(
    "✅ Quiz audio test completed"
);