import fs from "fs/promises";
import path from "path";

export class FileSystem {

    static async ensureDirectory(filePath) {
        const dir = path.dirname(filePath);

        await fs.mkdir(dir, {
            recursive: true
        });
    }

    static async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}