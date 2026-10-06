import { parseRuntimeVideoOptions } from "./src/config/RuntimeVideoOptions.js";

function test(name, argv, defaults, expected) {
    const result = parseRuntimeVideoOptions(
        argv,
        defaults
    );

    const passed =
        result.content === expected.content &&
        result.design === expected.design &&
        result.word === expected.word;

    console.log(
        `${passed ? "✅" : "❌"} ${name}`
    );

    if (!passed) {
        console.log("Expected:", expected);
        console.log("Actual:", result);
        throw new Error(
            `Test failed: ${name}`
        );
    }
}

test(
    "Default values",
    [],
    {
        content: "default",
        design: "default",
        word: null,
    },
    {
        content: "default",
        design: "default",
        word: null,
    }
);

test(
    "Quiz mode",
    ["--content=quiz"],
    {
        content: "default",
        design: "default",
        word: null,
    },
    {
        content: "quiz",
        design: "default",
        word: null,
    }
);

test(
    "Simple + minimal",
    [
        "--content=simple",
        "--design=minimal",
    ],
    {
        content: "default",
        design: "default",
        word: null,
    },
    {
        content: "simple",
        design: "minimal",
        word: null,
    }
);

test(
    "Design only",
    ["--design=minimal"],
    {
        content: "default",
        design: "default",
        word: null,
    },
    {
        content: "default",
        design: "minimal",
        word: null,
    }
);

test(
    "Specific word",
    ["--word=Bicycle"],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "default",
        word: "Bicycle",
    }
);

test(
    "Word + quiz + minimal",
    [
        "--word=Apple",
        "--content=quiz",
        "--design=minimal",
    ],
    {
        content: "default",
        design: "default",
    },
    {
        content: "quiz",
        design: "minimal",
        word: "Apple",
    }
);

console.log("");
console.log(
    "✅ All runtime video option tests passed"
);