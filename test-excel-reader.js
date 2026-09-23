import { ExcelReader } from "./src/data/ExcelReader.js";

const reader = new ExcelReader();

const words = await reader.read(
    "data/words.xlsx"
);

console.table(words);