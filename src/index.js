import { config } from "./config/config.js";
import { logger } from "./utils/logger.js";
import { ExcelReader } from "./data/ExcelReader.js";
import { WordValidator } from "./validators/wordValidator.js";
import { Pipeline } from "./pipeline/Pipeline.js";

console.clear();

logger.success(config.app.name);
logger.info(`Version: ${config.app.version}`);

const reader = new ExcelReader();

const words = await reader.read();

const validWords = words.filter(word =>
    WordValidator.validate(word)
);

logger.success(`Valid words: ${validWords.length}`);

console.table(validWords);

const pipeline = new Pipeline();

await pipeline.run(validWords);