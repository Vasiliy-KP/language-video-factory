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

if (runtimeVideoOptions.word) {
    wordsToProcess = validWords.filter(word =>
        word.en.toLowerCase() === runtimeVideoOptions.word.toLowerCase()
    );

    if (wordsToProcess.length === 0) {
        throw new Error(
            `Word not found: "${runtimeVideoOptions.word}".`
        );
    }

    logger.info(
        `Selected word: ${wordsToProcess[0].en}`
    );
}

console.table(wordsToProcess);

const pipeline = new Pipeline();

await pipeline.run(wordsToProcess);