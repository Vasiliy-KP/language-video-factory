import ExcelJS from "exceljs";
import { Word } from "../models/Word.js";

export class ExcelReader {
    async read(filePath) {
        const workbook = new ExcelJS.Workbook();

        await workbook.xlsx.readFile(filePath);

        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new Error("Excel worksheet not found.");
        }

        const headerRow = worksheet.getRow(1);

        const headers = headerRow.values
            .slice(1)
            .map((header) =>
                String(header).trim()
            );

        const words = [];

        worksheet.eachRow(
            (row, rowNumber) => {
                if (rowNumber === 1) {
                    return;
                }

                const data = {};

                row.eachCell(
                    (cell, columnNumber) => {
                        const field =
                            headers[columnNumber - 1];

                        if (!field) {
                            return;
                        }

                        data[field] = cell.value;
                    }
                );

                words.push(
                    new Word(data)
                );
            }
        );

        return words;
    }
}