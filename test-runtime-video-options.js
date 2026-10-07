import { parseRuntimeVideoOptions } from "./src/config/RuntimeVideoOptions.js";

function test(name, argv, defaults, expected) {
    const result = parseRuntimeVideoOptions(argv, defaults);

    const passed =
        result.content === expected.content &&
        result.design === expected.design &&
        result.word === expected.word &&
        JSON.stringify(result.words) === JSON.stringify(expected.words) &&
        result.category === expected.category &&
        result.level === expected.level;

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
        category: null,
        level: null,
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
        category: null,
        level: null,
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
        category: null,
        level: null,
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
        category: null,
        level: null,
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
        category: null,
        level: null,
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
        category: null,
        level: null,
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
        category: null,
        level: null,
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
        category: null,
        level: null,
    }
);

test(
    "Category",
    ["--category=Transport"],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "default",
        word: null,
        words: null,
        category: "Transport",
        level: null,
    }
);

test(
    "Level",
    ["--level=A1"],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "default",
        word: null,
        words: null,
        category: null,
        level: "A1",
    }
);

test(
    "Category + Level",
    [
        "--category=Transport",
        "--level=A1",
    ],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "default",
        word: null,
        words: null,
        category: "Transport",
        level: "A1",
    }
);

test(
    "Words + Category",
    [
        "--words=Bicycle,Apple",
        "--category=Transport",
    ],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "default",
        word: null,
        words: ["Bicycle", "Apple"],
        category: "Transport",
        level: null,
    }
);

test(
    "Words + Level",
    [
        "--words=Bicycle,Apple",
        "--level=A1",
    ],
    {
        content: "default",
        design: "default",
    },
    {
        content: "default",
        design: "default",
        word: null,
        words: ["Bicycle", "Apple"],
        category: null,
        level: "A1",
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

try {
    parseRuntimeVideoOptions(["--category="]);

    throw new Error(
        "Expected empty category to fail."
    );
} catch (error) {
    if (
        !error.message.includes(
            "Invalid category: value after --category= cannot be empty."
        )
    ) {
        throw error;
    }

    console.log("✅ Empty category validation");
}

try {
    parseRuntimeVideoOptions(["--level="]);

    throw new Error(
        "Expected empty level to fail."
    );
} catch (error) {
    if (
        !error.message.includes(
            "Invalid level: value after --level= cannot be empty."
        )
    ) {
        throw error;
    }

    console.log("✅ Empty level validation");
}

console.log("");
console.log(
    "✅ All runtime video option tests passed"
);