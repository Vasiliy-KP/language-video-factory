import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
    mkdtemp,
    rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    ExcelReader,
} from "./src/data/ExcelReader.js";

const HEADERS = [
    "id",
    "category",
    "uk",
    "en",
    "pl",
    "fr",
    "de",
    "es",
    "imagePrompt",
    "level",
];

const SAMPLE_WORD = {
    id: 1,
    category: "Transport",
    uk: "велосипед",
    en: "Bicycle",
    pl: "Rower",
    fr: "Vélo",
    de: "Fahrrad",
    es: "Bicicleta",
    imagePrompt: "modern bicycle isolated on white background",
    level: "A1",
};

let tempDirectory;

async function createWorkbook(
    fileName,
    headers = HEADERS,
    includeData = true
) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Words");

    if (headers !== null) {
        worksheet.addRow(headers);

        if (includeData) {
            worksheet.addRow(
                headers.map(
                    header => SAMPLE_WORD[header] ?? ""
                )
            );
        }
    }

    const filePath = path.join(tempDirectory, fileName);

    await workbook.xlsx.writeFile(filePath);

    return filePath;
}

try {
    tempDirectory = await mkdtemp(
        path.join(os.tmpdir(), "excel-reader-validation-")
    );

    const reader = new ExcelReader();

    console.log("▶ Testing ExcelReader validation...");

    // 1. Коректний Excel-файл.
    const validFile = await createWorkbook("valid.xlsx");

    const words = await reader.read(validFile);

    assert.equal(words.length, 1);
    assert.equal(words[0].en, "Bicycle");
    assert.equal(words[0].id, 1);
    assert.equal(words[0].rowNumber, 2);

    assert.equal(
        Object.keys(words[0]).includes("rowNumber"),
        false
    );

    console.log("✅ Valid Excel workbook is read correctly");

    // 2. Відсутній обов'язковий заголовок.
    const missingHeaders = HEADERS.filter(
        header => header !== "fr"
    );

    const missingHeaderFile = await createWorkbook(
        "missing-header.xlsx",
        missingHeaders
    );

    await assert.rejects(
        () => reader.read(missingHeaderFile),
        /Required header "fr" is missing/
    );

    console.log("✅ Missing required headers are rejected");

    // 3. Повторюваний заголовок.
    const duplicateHeaders = [...HEADERS];

    duplicateHeaders[HEADERS.indexOf("fr")] = "en";

    const duplicateHeaderFile = await createWorkbook(
        "duplicate-header.xlsx",
        duplicateHeaders
    );

    await assert.rejects(
        () => reader.read(duplicateHeaderFile),
        /Duplicate header/
    );

    console.log("✅ Duplicate headers are rejected");

    // 4. Невідомий заголовок.
    const unknownHeaders = [...HEADERS];

    unknownHeaders[HEADERS.indexOf("en")] = "english";

    const unknownHeaderFile = await createWorkbook(
        "unknown-header.xlsx",
        unknownHeaders
    );

    await assert.rejects(
        () => reader.read(unknownHeaderFile),
        /Unknown header "english"/
    );

    console.log("✅ Unknown headers are rejected");

    // 5. Порожній заголовок.
    const emptyHeaders = [...HEADERS];

    emptyHeaders[HEADERS.indexOf("fr")] = null;

    const emptyHeaderFile = await createWorkbook(
        "empty-header.xlsx",
        emptyHeaders
    );

    await assert.rejects(
        () => reader.read(emptyHeaderFile),
        /empty or invalid header/
    );

    console.log("✅ Empty headers are rejected");

    // 6. Відсутній рядок заголовків.
    const emptyWorkbookFile = await createWorkbook(
        "empty-workbook.xlsx",
        null
    );

    await assert.rejects(
        () => reader.read(emptyWorkbookFile),
        /Excel header row is empty/
    );

    console.log("✅ Empty worksheets are rejected");

    console.log("\n✅ All ExcelReader validation tests passed.");
} finally {
    if (tempDirectory) {
        await rm(tempDirectory, {
            recursive: true,
            force: true,
        });
    }
}