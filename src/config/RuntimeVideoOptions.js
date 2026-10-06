import { videoContent } from "./videoContent.js";
import { videoDesign } from "./videoDesign.js";

export function parseRuntimeVideoOptions(
    argv = process.argv.slice(2),
    defaults = {}
) {
    const options = {
        content: defaults.content ?? "default",
        design: defaults.design ?? "default",
        word: defaults.word ?? null,
        words: defaults.words ?? null,
    };

    for (const arg of argv) {
        if (arg.startsWith("--content=")) {
            options.content = arg.slice("--content=".length);
        }

        if (arg.startsWith("--design=")) {
            options.design = arg.slice("--design=".length);
        }

        if (arg.startsWith("--word=")) {
            options.word = arg.slice("--word=".length).trim();
        }

        if (arg.startsWith("--words=")) {
            const value = arg
                .slice("--words=".length)
                .trim();

            options.words = value
                .split(",")
                .map(word => word.trim())
                .filter(Boolean);
        }
    }

    validateContent(options.content);
    validateDesign(options.design);
    validateWord(options.word);
    validateWords(options.words);
    validateWordOptionsCombination(options);

    return options;
}

function validateContent(content) {
    if (!Object.hasOwn(videoContent, content)) {
        const available = Object.keys(videoContent).join(", ");

        throw new Error(
            `Invalid video content: "${content}". Available: ${available}`
        );
    }
}

function validateDesign(design) {
    if (!Object.hasOwn(videoDesign, design)) {
        const available = Object.keys(videoDesign).join(", ");

        throw new Error(
            `Invalid video design: "${design}". Available: ${available}`
        );
    }
}

function validateWord(word) {
    if (word !== null && word.length === 0) {
        throw new Error(
            "Invalid word: value after --word= cannot be empty."
        );
    }
}

function validateWords(words) {
    if (words !== null && words.length === 0) {
        throw new Error(
            "Invalid words: value after --words= cannot be empty."
        );
    }
}

function validateWordOptionsCombination(options) {
    if (options.word !== null && options.words !== null) {
        throw new Error(
            "Use either --word= or --words=, not both."
        );
    }
}