import { parseRuntimeVideoOptions } from "./src/config/RuntimeVideoOptions.js";

function test(name, argv, defaults, expected) {
    const result = parseRuntimeVideoOptions(argv, defaults);

    const passed =
        result.content === expected.content &&
        result.design === expected.design &&
        result.word === expected.word &&
        JSON.stringify(result.words) === JSON.stringify(expected.words);

    console.log(`${passed ? "✅" : "❌"} ${name}`);

    if (!passed) {
        console.log("Expected:", expected);
        console.log("Actual:", result);

        throw new Error(`Test failed: ${name}`);
    }
}

test(
    "Default values",
    [],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "default",
        word: null,
        words: null,
    }
);

test(
    "Quiz mode",
    ["--content=quiz"],
    {
        content: "default",
        design: "default",
    },
    {
        content: "quiz",
        design: "default",
        word: null,
        words: null,
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
    },
    {
        content: "simple",
        design: "minimal",
        word: null,
        words: null,
    }
);

test(
    "Design only",
    ["--design=minimal"],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "minimal",
        word: null,
        words: null,
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
        words: null,
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
        words: null,
    }
);

test(
    "Multiple words",
    ["--words=Bicycle,Apple"],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "default",
        word: null,
        words: ["Bicycle", "Apple"],
    }
);

test(
    "Multiple words + quiz + minimal",
    [
        "--words=Bicycle,Apple",
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
        word: null,
        words: ["Bicycle", "Apple"],
    }
);

try {
    parseRuntimeVideoOptions([
        "--word=Bicycle",
        "--words=Apple",
    ]);

    throw new Error(
        "Expected --word + --words combination to fail."
    );
} catch (error) {
    if (
        !error.message.includes(
            "Use either --word= or --words=, not both."
        )
    ) {
        throw error;
    }

    console.log("✅ Word + words conflict");
}

console.log("");
console.log(
    "✅ All runtime video option tests passed"
);