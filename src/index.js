import path from "path";
import "dotenv/config";

import { config } from "./config/config.js";
import { parseRuntimeVideoOptions } from "./config/RuntimeVideoOptions.js";
import { logger } from "./utils/logger.js";
import { ExcelReader } from "./data/ExcelReader.js";
import { WordValidator } from "./validators/wordValidator.js";
import { Pipeline } from "./pipeline/Pipeline.js";

console.clear();

const runtimeVideoOptions = parseRuntimeVideoOptions(
    process.argv.slice(2),
    {
        content: config.video.content,
        design: config.video.design,
    }
);

config.video.content = runtimeVideoOptions.content;
config.video.design = runtimeVideoOptions.design;

logger.success(config.app.name);
logger.info(`Version: ${config.app.version}`);
logger.info(`Video content: ${config.video.content}`);
logger.info(`Video design: ${config.video.design}`);

const reader = new ExcelReader();

const excelFilePath = path.join(
    config.paths.data,
    "words.xlsx"
);

console.log(`ℹ️ Excel file: ${excelFilePath}`);

const words = await reader.read(
    excelFilePath
);

//const words = await reader.read();

const validWords = words.filter(word =>
    WordValidator.validate(word)
);

logger.success(`Valid words: ${validWords.length}`);

let wordsToProcess = validWords;

// Filter by one specific word
if (runtimeVideoOptions.word) {
    const requestedWord = runtimeVideoOptions.word.toLowerCase();

    const wordExists = validWords.some(word =>
        word.en.toLowerCase() === requestedWord
    );

    if (!wordExists) {
        throw new Error(
            `Word not found: "${runtimeVideoOptions.word}".`
        );
    }

    wordsToProcess = wordsToProcess.filter(word =>
        word.en.toLowerCase() === requestedWord
    );

    logger.info(
        `Selected word: ${wordsToProcess[0].en}`
    );
}

// Filter by multiple words
if (runtimeVideoOptions.words) {
    const requestedWords = runtimeVideoOptions.words.map(
        word => word.toLowerCase()
    );

    const validWordNames = validWords.map(
        word => word.en.toLowerCase()
    );

    const missingWords = requestedWords.filter(
        word => !validWordNames.includes(word)
    );

    if (missingWords.length > 0) {
        throw new Error(
            `Words not found: ${missingWords.join(", ")}.`
        );
    }

    wordsToProcess = wordsToProcess.filter(word =>
        requestedWords.includes(word.en.toLowerCase())
    );

    logger.info(
        `Selected words: ${wordsToProcess
            .map(word => word.en)
            .join(", ")}`
    );
}

// Filter by category
if (runtimeVideoOptions.category) {
    const requestedCategory =
        runtimeVideoOptions.category.toLowerCase();

    wordsToProcess = wordsToProcess.filter(word =>
        word.category.toLowerCase() === requestedCategory
    );

    logger.info(
        `Category filter: ${runtimeVideoOptions.category}`
    );
}

// Filter by level
if (runtimeVideoOptions.level) {
    const requestedLevel =
        runtimeVideoOptions.level.toLowerCase();

    wordsToProcess = wordsToProcess.filter(word =>
        word.level.toLowerCase() === requestedLevel
    );

    logger.info(
        `Level filter: ${runtimeVideoOptions.level}`
    );
}

// Make sure filters did not produce an empty result
if (wordsToProcess.length === 0) {
    throw new Error(
        "No words match the selected filters."
    );
}

console.table(wordsToProcess);

const pipeline = new Pipeline();

await pipeline.run(wordsToProcess);