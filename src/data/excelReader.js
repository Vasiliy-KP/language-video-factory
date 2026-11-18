import ExcelJS from "exceljs";
import { Word } from "../models/Word.js";

const REQUIRED_HEADERS = [
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

export class ExcelReader {
    async read(filePath) {
        const workbook = new ExcelJS.Workbook();

        await workbook.xlsx.readFile(filePath);

        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new Error("Excel worksheet not found.");
        }

        const headerRow = worksheet.getRow(1);
        const headerValues = headerRow.values ?? [];

        if (headerValues.length <= 1) {
            throw new Error("Excel header row is empty.");
        }

        const headers = [];
        const headerErrors = [];
        const seenHeaders = new Map();

        for (
            let columnNumber = 1;
            columnNumber < headerValues.length;
            columnNumber++
        ) {
            const rawHeader = headerValues[columnNumber];

            if (
                typeof rawHeader !== "string" ||
                !rawHeader.trim()
            ) {
                headerErrors.push(
                    `Column ${columnNumber} has an empty or invalid header.`
                );

                continue;
            }

            const header = rawHeader.trim();
            const normalizedHeader = header.toLowerCase();

            headers[columnNumber - 1] = header;

            if (seenHeaders.has(normalizedHeader)) {
                headerErrors.push(
                    `Duplicate header "${header}" in columns ` +
                    `${seenHeaders.get(normalizedHeader)} and ${columnNumber}.`
                );
            } else {
                seenHeaders.set(normalizedHeader, columnNumber);
            }

            if (!REQUIRED_HEADERS.includes(header)) {
                headerErrors.push(
                    `Unknown header "${header}" in column ${columnNumber}.`
                );
            }
        }

        const actualHeaders = new Set(
            headers.filter(Boolean)
        );

        for (const requiredHeader of REQUIRED_HEADERS) {
            if (!actualHeaders.has(requiredHeader)) {
                headerErrors.push(
                    `Required header "${requiredHeader}" is missing.`
                );
            }
        }

        if (headerErrors.length > 0) {
            throw new Error(
                `Invalid Excel header row:\n- ${headerErrors.join("\n- ")}`
            );
        }

        const words = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
                return;
            }

            const data = {};

            row.eachCell((cell, columnNumber) => {
                const field = headers[columnNumber - 1];

                if (!field) {
                    return;
                }

                data[field] = cell.value;
            });

            const word = new Word(data);

            // Номер рядка потрібен для звіту про помилки.
            // Він не потрапляє до звичайного переліку властивостей Word.
            Object.defineProperty(word, "rowNumber", {
                value: rowNumber,
                enumerable: false,
                writable: false,
            });

            words.push(word);
        });

        return words;
    }
}