import "dotenv/config";
import path from "path";

import { ExcelReader } from "./src/data/ExcelReader.js";
import { Pipeline } from "./src/pipeline/Pipeline.js";
import { OutputPathService } from "./src/services/OutputPathService.js";
import { FileSystem } from "./src/utils/FileSystem.js";
import { config } from "./src/config/config.js";

const excelReader = new ExcelReader();

const excelPath = path.join(
    config.paths.data,
    "words.xlsx"
);

console.log("▶ Loading words from Excel...");

const words = await excelReader.read(
    excelPath
);

const bicycle = words.find(
    word => word.en === "Bicycle"
);

if (!bicycle) {
    throw new Error(
        "Bicycle not found in words.xlsx"
    );
}

console.log(
    "✅ Bicycle found"
);

/*
 * Force quiz mode only for this test.
 */

config.video.content = "quiz";
config.video.design = "minimal";

/*
 * Use a separate test output so we do not
 * overwrite the normal Bicycle video.
 */

const originalGetVideoPath =
    OutputPathService.getVideoPath;

OutputPathService.getVideoPath = () =>
    path.resolve(
        "output",
        "videos",
        "test-bicycle-quiz-pipeline.mp4"
    );

const testOutputPath =
    OutputPathService.getVideoPath(
        bicycle.en
    );

await FileSystem.remove(
    testOutputPath
);

console.log("");
console.log(
    "================================"
);
console.log(
    "▶ Starting Quiz Pipeline test"
);
console.log(
    "================================"
);
console.log("");

try {
    const pipeline = new Pipeline();

    await pipeline.run([
        bicycle
    ]);

    console.log("");
    console.log(
        "================================"
    );
    console.log(
        "✅ Quiz Pipeline test completed"
    );
    console.log(
        "================================"
    );
    console.log("");

    console.log(
        `Output: ${testOutputPath}`
    );

} finally {
    /*
     * Restore original OutputPathService
     * method after test.
     */

    OutputPathService.getVideoPath =
        originalGetVideoPath;
}