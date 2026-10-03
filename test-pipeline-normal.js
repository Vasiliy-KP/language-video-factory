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
 * Force normal video mode for this test.
 */

config.video.content = "default";
config.video.design = "default";

/*
 * Use a separate output file.
 */

const originalGetVideoPath =
    OutputPathService.getVideoPath;

OutputPathService.getVideoPath = () =>
    path.resolve(
        "output",
        "videos",
        "test-bicycle-normal-pipeline.mp4"
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
    "▶ Starting Normal Pipeline test"
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
        "✅ Normal Pipeline test completed"
    );
    console.log(
        "================================"
    );
    console.log("");

    console.log(
        `Output: ${testOutputPath}`
    );

} finally {
    OutputPathService.getVideoPath =
        originalGetVideoPath;
}