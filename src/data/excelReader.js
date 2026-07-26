import ExcelJS from "exceljs";
import path from "path";
import { logger } from "../utils/logger.js";
import { Word } from "../models/Word.js";
import { config } from "../config/config.js";


export class ExcelReader {
    constructor() {
        this.filePath = path.resolve(config.paths.data,
            config.data.wordsFile);
    }

    async read() {
        const workbook = new ExcelJS.Workbook();

        await workbook.xlsx.readFile(this.filePath);

        const worksheet = workbook.getWorksheet(1);

        const rows = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            rows.push(
                new Word({
                    id: row.getCell(1).value,
                    category: row.getCell(2).value,
                    uk: row.getCell(3).value,
                    en: row.getCell(4).value,
                    fr: row.getCell(5).value,
                    de: row.getCell(6).value,
                    imagePrompt: row.getCell(7).value,
                    level: row.getCell(8).value,
                })
            );
        });

        logger.success(`Loaded ${rows.length} words`);

        return rows;
    }
}