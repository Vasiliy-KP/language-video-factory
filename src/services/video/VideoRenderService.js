import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

import { FileSystem } from "../../utils/FileSystem.js";
import { VideoTemplateService } from "./VideoTemplateService.js";

const execFileAsync = promisify(execFile);

export class VideoRenderService {
    constructor() {
        this.templateService = new VideoTemplateService();
    }

    async render(word, imagePath, outputPath) {
        const template = this.templateService.getWordTemplate();

        const absoluteImagePath = path.resolve(imagePath);
        const absoluteOutputPath = path.resolve(outputPath);

        await FileSystem.ensureDirectory(absoluteOutputPath);

        const fontPath = this.escapeFilterPath(
            this.templateService.getFont()
        );

        const filter = this.buildFilter(
            word,
            template,
            fontPath
        );

        const args = [
            "-f",
            "lavfi",
            "-i",
            `color=c=${template.colors.background}:s=${template.width}x${template.height}:r=30`,

            "-loop",
            "1",
            "-i",
            absoluteImagePath,

            "-filter_complex",
            filter,

            "-map",
            "[out]",

            "-t",
            "5",

            "-r",
            "30",

            "-c:v",
            "libx264",

            "-pix_fmt",
            "yuv420p",

            "-movflags",
            "+faststart",

            "-y",
            absoluteOutputPath,
        ];

        await execFileAsync("ffmpeg", args);

        return outputPath;
    }

    buildFilter(word, template, fontPath) {
        const filters = [];

        /*
         * IMAGE
         */

        filters.push(
            `[1:v]` +
            `scale=${template.image.width}:${template.image.height}:` +
            `force_original_aspect_ratio=decrease,` +
            `format=rgba` +
            `[img]`
        );

        /*
         * IMAGE CARD
         */

        filters.push(
            `[0:v]` +
            `drawbox=` +
            `x=${template.image.x - 20}:` +
            `y=${template.image.y - 20}:` +
            `w=${template.image.width + 40}:` +
            `h=${template.image.height + 40}:` +
            `color=${template.colors.card}:` +
            `t=fill` +
            `[bg1]`
        );

        /*
         * IMAGE OVERLAY
         */

        filters.push(
            `[bg1][img]` +
            `overlay=` +
            `${template.image.x}:` +
            `${template.image.y}` +
            `[bg2]`
        );

        /*
         * TITLE
         */

        filters.push(
            `[bg2]` +
            this.drawText({
                fontPath,
                text: template.title.text,
                fontSize: template.title.fontSize,
                fontColor: template.colors.title,
                x: "(w-text_w)/2",
                y: template.title.y,
            }) +
            `[bg3]`
        );

        /*
         * MAIN UKRAINIAN WORD
         */

        filters.push(
            `[bg3]` +
            this.drawText({
                fontPath,
                text: word.uk,
                fontSize: template.mainWord.fontSize,
                fontColor: template.colors.primary,
                x: "(w-text_w)/2",
                y: template.mainWord.y,
            }) +
            `[bg4]`
        );

        /*
         * TRANSLATIONS
         */

        const translations = [
            ["EN", word.en],
            ["FR", word.fr],
            ["DE", word.de],
        ];

        let currentInput = "bg4";

        translations.forEach(([language, text], index) => {
            const y =
                template.translations.startY +
                template.translations.lineHeight * index;

            const nextOutput = `translation${index}`;

            filters.push(
                `[${currentInput}]` +
                this.drawText({
                    fontPath,
                    text: language,
                    fontSize: template.translations.labelFontSize,
                    fontColor: template.colors.secondary,
                    x: 150,
                    y,
                }) +
                `[${nextOutput}]`
            );

            const textOutput = `translationText${index}`;

            filters.push(
                `[${nextOutput}]` +
                this.drawText({
                    fontPath,
                    text,
                    fontSize: template.translations.textFontSize,
                    fontColor: template.colors.text,
                    x: 270,
                    y: y - 10,
                }) +
                `[${textOutput}]`
            );

            currentInput = textOutput;
        });

        /*
         * DIVIDER
         */

        filters.push(
            `[${currentInput}]` +
            `drawbox=` +
            `x=${template.margins.left}:` +
            `y=${template.footer.dividerY}:` +
            `w=${template.width - template.margins.left - template.margins.right}:` +
            `h=2:` +
            `color=${template.colors.divider}:` +
            `t=fill` +
            `[footer]`
        );

        /*
         * CATEGORY + LEVEL
         */

        filters.push(
            `[footer]` +
            this.drawText({
                fontPath,
                text: word.category.toUpperCase(),
                fontSize: template.footer.fontSize,
                fontColor: template.colors.secondary,
                x: 120,
                y: template.footer.textY,
            }) +
            `[footer2]`
        );

        filters.push(
            `[footer2]` +
            this.drawText({
                fontPath,
                text: word.level,
                fontSize: template.footer.fontSize,
                fontColor: template.colors.primary,
                x: 900,
                y: template.footer.textY,
            }) +
            `[out]`
        );

        return filters.join(";");
    }

    drawText({
        fontPath,
        text,
        fontSize,
        fontColor,
        x,
        y,
    }) {
        return (
            `drawtext=` +
            `fontfile='${fontPath}':` +
            `text='${this.escapeText(text)}':` +
            `fontcolor=${fontColor}:` +
            `fontsize=${fontSize}:` +
            `x=${x}:` +
            `y=${y}`
        );
    }

    escapeFilterPath(filePath) {
        return filePath
            .replaceAll("\\", "/")
            .replaceAll(":", "\\:");
    }

    escapeText(text) {
        return String(text)
            .replaceAll("\\", "\\\\")
            .replaceAll("'", "\\'")
            .replaceAll(":", "\\:")
            .replaceAll(",", "\\,");
    }
}