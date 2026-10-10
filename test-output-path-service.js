import assert from "node:assert/strict";
import path from "node:path";
import { OutputPathService } from "./src/services/OutputPathService.js";

const tests = [
    {
        name: "Default path remains compatible",
        args: ["Bicycle"],
        expected: path.join("output", "videos", "bicycle.mp4"),
    },
    {
        name: "Explicit default variant",
        args: ["Bicycle", "default", "default"],
        expected: path.join("output", "videos", "bicycle.mp4"),
    },
    {
        name: "Quiz minimal variant",
        args: ["Bicycle", "quiz", "minimal"],
        expected: path.join(
            "output",
            "videos",
            "bicycle-quiz-minimal.mp4"
        ),
    },
    {
        name: "Simple minimal variant",
        args: ["Bicycle", "simple", "minimal"],
        expected: path.join(
            "output",
            "videos",
            "bicycle-simple-minimal.mp4"
        ),
    },
    {
        name: "Quiz default design",
        args: ["Bicycle", "quiz", "default"],
        expected: path.join(
            "output",
            "videos",
            "bicycle-quiz-default.mp4"
        ),
    },
];

for (const test of tests) {
    const actual = OutputPathService.getVideoPath(...test.args);

    assert.equal(actual, test.expected, test.name);

    console.log(`✅ ${test.name}`);
}

console.log("\n✅ All output path service tests passed");