import path from "path";
import "dotenv/config";

import { readFile } from "node:fs/promises";
import { config } from "./config/config.js";
import { parseRuntimeVideoOptions } from "./config/RuntimeVideoOptions.js";
import { showCliHelp } from "./config/cliHelp.js";
import { logger } from "./utils/logger.js";
import { ExcelReader } from "./data/ExcelReader.js";
import { WordValidator } from "./validators/wordValidator.js";
import { Pipeline } from "./pipeline/Pipeline.js";

import {
    PublishingQueueService,
} from "./services/PublishingQueueService.js";

async function main() {
    try {
        console.clear();

        const runtimeVideoOptions = parseRuntimeVideoOptions(
            process.argv.slice(2),
            {
                content: config.video.content,
                design: config.video.design,
            }
        );

        if (runtimeVideoOptions.help) {
            showCliHelp();
            return;
        }

        if (runtimeVideoOptions.publishingPreview) {
            const queue = await PublishingQueueService.build();

            console.log("\n## Publishing preview");

            if (queue.items.length === 0) {
                console.log("No packages are ready for review.");
            } else {
                console.log(`\nReady for review: ${queue.items.length}`);

                for (const item of queue.items) {
                    console.log(`\n✅ ${item.word} — ${item.status}`);
                    console.log(`   Platforms: ${item.platforms.join(", ")}`);
                    console.log(`   Video: ${item.videoPath}`);
                    console.log(`   Metadata: ${item.metadataPath}`);

                    try {
                        const metadata = JSON.parse(
                            await readFile(item.metadataPath, "utf8")
                        );

                        const platformLabels = {
                            tiktok: "TikTok",
                            instagram: "Instagram",
                            youtubeShorts: "YouTube Shorts",
                        };

                        for (const platform of item.platforms) {
                            const platformData = metadata.platforms?.[platform];

                            console.log(
                                `\n   --- ${platformLabels[platform] ?? platform} ---`
                            );

                            if (!platformData) {
                                console.log("   ⚠️ Platform metadata not found.");
                                continue;
                            }

                            if (platform === "youtubeShorts") {
                                console.log(`   Title: ${platformData.title ?? "(missing)"}`);
                                console.log("   Description:");

                                console.log(
                                    (platformData.description ?? "(missing)")
                                        .split("\n")
                                        .map((line) => `      ${line}`)
                                        .join("\n")
                                );
                            } else {
                                console.log("   Caption:");

                                console.log(
                                    (platformData.caption ?? "(missing)")
                                        .split("\n")
                                        .map((line) => `      ${line}`)
                                        .join("\n")
                                );
                            }

                            if (
                                Array.isArray(platformData.hashtags) &&
                                platformData.hashtags.length > 0
                            ) {
                                console.log(
                                    `   Hashtags: ${platformData.hashtags.join(" ")}`
                                );
                            }
                        }
                    } catch (error) {
                        console.log(
                            `   ⚠️ Could not read metadata: ${error.message}`
                        );
                    }
                }
            }

            if (queue.excluded.length > 0) {
                console.log(
                    `\n## Excluded packages: ${queue.excluded.length}`
                );

                for (const item of queue.excluded) {
                    console.log(
                        `\n⚠️ ${item.word} — ${item.status}`
                    );

                    for (const error of item.errors ?? []) {
                        console.log(
                            `   ❌ ${error.message ?? error.code ?? "Unknown error"}`
                        );
                    }

                    for (const error of item.platformErrors ?? []) {
                        console.log(
                            `   ❌ ${error.platform}: ${error.message}`
                        );
                    }
                }
            }

            return;
        }

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

        console.log("");
        console.log("## Generation Plan");
        console.log("");

        logger.info(`Words selected: ${wordsToProcess.length}`);
        logger.info(
            `Words: ${wordsToProcess.map(word => word.en).join(", ")}`
        );
        logger.info(`Video content: ${config.video.content}`);
        logger.info(`Video design: ${config.video.design}`);

        if (runtimeVideoOptions.dryRun) {
            logger.info("Execution: Preview only. Pipeline will not start.");
        } else {
            logger.info("Execution: Generation enabled.");

            const pipeline = new Pipeline({
                force: runtimeVideoOptions.force,
            });

            await pipeline.run(wordsToProcess);
        }
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : String(error);

        console.error(`❌ ${message}`);

        process.exitCode = 1;
    }
}

main();