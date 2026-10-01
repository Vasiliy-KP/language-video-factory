import path from "path";

import { ExcelReader } from "./src/data/ExcelReader.js";
import { OutputPathService } from "./src/services/OutputPathService.js";
import { QuizVideoService } from "./src/services/video/QuizVideoService.js";
import { languages } from "./src/config/languages.js";

const excelReader = new ExcelReader();
const outputPathService = OutputPathService;

const excelPath = path.resolve(
    "data",
    "words.xlsx"
);

console.log("▶ Loading words from Excel...");

const words = await excelReader.read(
    excelPath
);

const word = words.find(
    (item) => item.en === "Bicycle"
);

if (!word) {
    throw new Error(
        "Bicycle not found in words.xlsx"
    );
}

console.log(
    `✅ Word found: ${word.en}`
);

const imagePath = path.resolve(
    "output",
    "images",
    "bicycle.png"
);

const outputPath = path.resolve(
    "output",
    "videos",
    "test-bicycle-quiz.mp4"
);

const quizVideoService =
    new QuizVideoService(
        languages,
        outputPathService
    );

console.log("");
console.log("▶ Creating final quiz video...");
console.log("");

const result =
    await quizVideoService.create(
        word,
        imagePath,
        outputPath,
        "minimal",
        "quiz"
    );

console.log("");
console.log("================================");
console.log("✅ Quiz service test completed");
console.log("================================");
console.log("");
console.log(`Output: ${result.outputPath}`);
console.log(
    `Duration: ${result.duration.toFixed(3)} s`
);