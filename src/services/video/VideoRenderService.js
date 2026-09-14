import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

import { FileSystem } from "../../utils/FileSystem.js";
import { VideoTemplateService } from "./VideoTemplateService.js";
import { FlagAssetService } from "./FlagAssetService.js";

const execFileAsync = promisify(execFile);

export class VideoRenderService {
    constructor() {
        this.templateService = new VideoTemplateService();
        this.flagAssetService = new FlagAssetService();
    }

    async render(word, imagePath, outputPath) {
        const template = this.templateService.getWordTemplate();

        const absoluteImagePath = path.resolve(imagePath);
        const absoluteOutputPath = path.resolve(outputPath);

        await FileSystem.ensureDirectory(absoluteOutputPath);

        const fontPath = this.escapeFilterPath(
            this.templateService.getFont()
        );

        const flagPaths = {
            en: this.flagAssetService.getFlagPath("en"),
            fr: this.flagAssetService.getFlagPath("fr"),
            de: this.flagAssetService.getFlagPath("de"),
        };

        const filter = this.buildFilter(
            word,
            template,
            fontPath
        );

        const args = [
            // Background
            "-f",
            "lavfi",
            "-i",
            `color=c=${template.colors.background}:s=${template.width}x${template.height}:r=30`,

            // Main image
            "-loop",
            "1",
            "-i",
            absoluteImagePath,

            // EN flag
            "-loop",
            "1",
            "-i",
            flagPaths.en,

            // FR flag
            "-loop",
            "1",
            "-i",
            flagPaths.fr,

            // DE flag
            "-loop",
            "1",
            "-i",
            flagPaths.de,

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

    async renderDynamic(
        word,
        imagePath,
        timeline,
        outputPath,
        duration
    ) {
        const template = this.templateService.getWordTemplate();

        const absoluteImagePath = path.resolve(imagePath);
        const absoluteOutputPath = path.resolve(outputPath);

        await FileSystem.ensureDirectory(absoluteOutputPath);

        const fontPath = this.escapeFilterPath(
            this.templateService.getFont()
        );

        const flagPaths = {
            uk: this.flagAssetService.getFlagPath("uk"),
            en: this.flagAssetService.getFlagPath("en"),
            fr: this.flagAssetService.getFlagPath("fr"),
            de: this.flagAssetService.getFlagPath("de"),
        };

        const filter = this.buildDynamicFilter(
            word,
            timeline,
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

            "-loop",
            "1",
            "-i",
            flagPaths.uk,

            "-loop",
            "1",
            "-i",
            flagPaths.en,

            "-loop",
            "1",
            "-i",
            flagPaths.fr,

            "-loop",
            "1",
            "-i",
            flagPaths.de,

            "-filter_complex",
            filter,

            "-map",
            "[out]",

            "-t",
            String(duration),

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
         * MAIN IMAGE
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
         * MAIN WORD
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
         * FLAGS
         */

        filters.push(
            `[2:v]` +
            `scale=${template.translations.flag.size}:` +
            `${template.translations.flag.size}` +
            `[flagEN]`
        );

        filters.push(
            `[3:v]` +
            `scale=${template.translations.flag.size}:` +
            `${template.translations.flag.size}` +
            `[flagFR]`
        );

        filters.push(
            `[4:v]` +
            `scale=${template.translations.flag.size}:` +
            `${template.translations.flag.size}` +
            `[flagDE]`
        );

        /*
         * TRANSLATIONS
         */

        const translations = [
            {
                language: "EN",
                text: word.en,
                flag: "flagEN",
            },
            {
                language: "FR",
                text: word.fr,
                flag: "flagFR",
            },
            {
                language: "DE",
                text: word.de,
                flag: "flagDE",
            },
        ];

        let currentInput = "bg4";

        translations.forEach(
            ({ language, text, flag }, index) => {
                const y =
                    template.translations.startY +
                    template.translations.lineHeight * index;

                /*
                 * FLAG
                 */

                const flagOutput = `flagOverlay${index}`;

                filters.push(
                    `[${currentInput}][${flag}]` +
                    `overlay=` +
                    `${template.translations.flag.x}:` +
                    `${y - 12}` +
                    `[${flagOutput}]`
                );

                /*
                 * LANGUAGE LABEL
                 */

                const labelOutput = `label${index}`;

                filters.push(
                    `[${flagOutput}]` +
                    this.drawText({
                        fontPath,
                        text: language,
                        fontSize:
                            template.translations.labelFontSize,
                        fontColor:
                            template.colors.secondary,
                        x: template.translations.labelX,
                        y: y + 2,
                    }) +
                    `[${labelOutput}]`
                );

                /*
                 * TRANSLATION TEXT
                 */

                const textOutput = `text${index}`;

                filters.push(
                    `[${labelOutput}]` +
                    this.drawText({
                        fontPath,
                        text,
                        fontSize:
                            template.translations.textFontSize,
                        fontColor:
                            template.colors.text,
                        x: template.translations.textX,
                        y: y - 10,
                    }) +
                    `[${textOutput}]`
                );

                currentInput = textOutput;
            }
        );

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
         * CATEGORY
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

        /*
         * LEVEL
         */

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

    buildDynamicFilter(
        word,
        timeline,
        template,
        fontPath
    ) {
        const filters = [];

        /*
         * MAIN IMAGE
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
         * IMAGE
         */

        filters.push(
            `[bg1][img]` +
            `overlay=${template.image.x}:${template.image.y}` +
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
         * UKRAINIAN MAIN WORD
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
         * FLAGS
         */

        filters.push(
            `[2:v]scale=${template.translations.flag.size}:${template.translations.flag.size}[flagUK]`
        );

        filters.push(
            `[3:v]scale=${template.translations.flag.size}:${template.translations.flag.size}[flagEN]`
        );

        filters.push(
            `[4:v]scale=${template.translations.flag.size}:${template.translations.flag.size}[flagFR]`
        );

        filters.push(
            `[5:v]scale=${template.translations.flag.size}:${template.translations.flag.size}[flagDE]`
        );

        /*
         * ACTIVE LANGUAGE
         */

        const languageData = {
            uk: {
                text: word.uk,
                label: "UA",
                flag: "flagUK",
            },

            en: {
                text: word.en,
                label: "EN",
                flag: "flagEN",
            },

            fr: {
                text: word.fr,
                label: "FR",
                flag: "flagFR",
            },

            de: {
                text: word.de,
                label: "DE",
                flag: "flagDE",
            },
        };

        let currentInput = "bg4";

        timeline.forEach((segment, index) => {
            const data = languageData[segment.language];

            if (!data) {
                return;
            }

            const start = segment.start;
            const end = segment.end;

            /*
             * ACTIVE CARD
             */

            const cardOutput = `activeCard${index}`;

            filters.push(
                `[${currentInput}]` +
                `drawbox=` +
                `x=${template.translations.card.x}:` +
                `y=${template.translations.card.y}:` +
                `w=${template.translations.card.width}:` +
                `h=${template.translations.card.height}:` +
                `color=${template.colors.activeCard}:` +
                `t=fill:` +
                `enable='between(t,${start},${end})'` +
                `[${cardOutput}]`
            );

            /*
             * ACTIVE FLAG
             */

            const flagOutput = `activeFlag${index}`;

            filters.push(
                `[${cardOutput}][${data.flag}]` +
                `overlay=` +
                `x=${template.translations.flag.x}:` +
                `y=${template.translations.startY - 12}:` +
                `enable='between(t,${start},${end})'` +
                `[${flagOutput}]`
            );

            /*
             * LANGUAGE LABEL
             */

            const labelOutput = `activeLabel${index}`;

            filters.push(
                `[${flagOutput}]` +
                this.drawText({
                    fontPath,
                    text: data.label,
                    fontSize: template.translations.labelFontSize,
                    fontColor: template.colors.secondary,
                    x: template.translations.labelX,
                    y: template.translations.startY + 2,
                    enable: `between(t,${start},${end})`,
                }) +
                `[${labelOutput}]`
            );

            /*
             * TRANSLATION
             */

            const textOutput = `activeText${index}`;

            filters.push(
                `[${labelOutput}]` +
                this.drawText({
                    fontPath,
                    text: data.text,
                    fontSize: template.translations.textFontSize,
                    fontColor: template.colors.text,
                    x: template.translations.textX,
                    y: template.translations.startY - 10,
                    enable: `between(t,${start},${end})`,
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
         * CATEGORY
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

        /*
         * LEVEL
         */

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
        enable = null,
    }) {
        let filter =
            `drawtext=` +
            `fontfile='${fontPath}':` +
            `text='${this.escapeText(text)}':` +
            `fontcolor=${fontColor}:` +
            `fontsize=${fontSize}:` +
            `x=${x}:` +
            `y=${y}`;

        if (enable) {
            filter += `:enable='${enable}'`;
        }

        return filter;
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