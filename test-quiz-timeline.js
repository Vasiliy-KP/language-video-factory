import {
    QuizTimelineService,
} from "./src/services/video/QuizTimelineService.js";

import { OutputPathService } from "./src/services/OutputPathService.js";
import { languages } from "./src/config/languages.js";

const quizTimelineService =
    new QuizTimelineService(0.8);

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
    "▶ Creating quiz timeline...\n"
);

const timeline =
    await quizTimelineService.createForWord(
        word,
        languages,
        OutputPathService
    );

for (const [index, segment] of timeline.entries()) {
    console.log(
        `Quiz ${index + 1}: ${segment.language}`
    );

    console.log(
        `  Segment:    ${segment.start.toFixed(3)} → ${segment.end.toFixed(3)}`
    );

    console.log(
        `  Prompt:     ${segment.start.toFixed(3)} → ${segment.promptEnd.toFixed(3)}`
    );

    console.log(
        `  Pause:      ${segment.promptEnd.toFixed(3)} → ${segment.answerStart.toFixed(3)}`
    );

    console.log(
        `  Answer:     ${segment.answerStart.toFixed(3)} → ${segment.end.toFixed(3)}`
    );

    console.log(
        `  Question:   ${segment.prompt.language} | ${segment.prompt.text}`
    );

    console.log(
        `  Answer:     ${segment.answer.language} | ${segment.answer.text}`
    );

    console.log("");
}

const totalDuration =
    quizTimelineService.getDuration(
        timeline
    );

console.log(
    `Total quiz duration: ${totalDuration.toFixed(3)} s`
);

/*
 * Basic structural validation
 */

const expectedSegments =
    languages.filter(
        (language) => !language.primary
    ).length;

if (timeline.length !== expectedSegments) {
    throw new Error(
        `Expected ${expectedSegments} quiz segments, ` +
        `received ${timeline.length}.`
    );
}

for (const segment of timeline) {
    if (
        !Number.isFinite(segment.start) ||
        !Number.isFinite(segment.promptEnd) ||
        !Number.isFinite(segment.answerStart) ||
        !Number.isFinite(segment.end)
    ) {
        throw new Error(
            `Invalid quiz timeline for ${segment.language}.`
        );
    }

    if (
        segment.promptEnd <= segment.start
    ) {
        throw new Error(
            `Invalid prompt timing for ${segment.language}.`
        );
    }

    if (
        segment.answerStart < segment.promptEnd
    ) {
        throw new Error(
            `Invalid pause timing for ${segment.language}.`
        );
    }

    if (
        segment.end <= segment.answerStart
    ) {
        throw new Error(
            `Invalid answer timing for ${segment.language}.`
        );
    }
}

console.log(
    "✅ Quiz timeline test completed"
);