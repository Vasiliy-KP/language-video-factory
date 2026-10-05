import { videoContent } from "./videoContent.js";
import { videoDesign } from "./videoDesign.js";

export function parseRuntimeVideoOptions(
    argv = process.argv.slice(2),
    defaults = {}
) {
    const options = {
        content: defaults.content ?? "default",
        design: defaults.design ?? "default",
    };

    for (const arg of argv) {
        if (arg.startsWith("--content=")) {
            options.content = arg.slice(
                "--content=".length
            );
        }

        if (arg.startsWith("--design=")) {
            options.design = arg.slice(
                "--design=".length
            );
        }
    }

    validateContent(options.content);
    validateDesign(options.design);

    return options;
}

function validateContent(content) {
    if (!Object.hasOwn(videoContent, content)) {
        const available = Object.keys(
            videoContent
        ).join(", ");

        throw new Error(
            `Invalid video content: "${content}". ` +
            `Available: ${available}`
        );
    }
}

function validateDesign(design) {
    if (!Object.hasOwn(videoDesign, design)) {
        const available = Object.keys(
            videoDesign
        ).join(", ");

        throw new Error(
            `Invalid video design: "${design}". ` +
            `Available: ${available}`
        );
    }
}