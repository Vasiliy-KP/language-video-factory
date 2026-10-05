import { parseRuntimeVideoOptions } from "./src/config/RuntimeVideoOptions.js";

function test(name, argv, defaults, expected) {
    const result = parseRuntimeVideoOptions(
        argv,
        defaults
    );

    const passed =
        result.content === expected.content &&
        result.design === expected.design;

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
    },
    {
        content: "default",
        design: "default",
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
    }
);

console.log("");
console.log(
    "✅ All runtime video option tests passed"
);