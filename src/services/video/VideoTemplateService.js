import path from "path";

import { videoDesign } from "../../config/videoDesign.js";

export class VideoTemplateService {
    getWordTemplate(
        languageCount = 5,
        designName = "default"
    ) {
        const design = videoDesign[designName];

        if (!design) {
            throw new Error(
                `Video design not found: ${designName}`
            );
        }

        const layout = this.getResponsiveLayout(
            languageCount,
            design
        );

        return {
            width: 1080,
            height: 1920,

            colors: {
                ...design.colors,
            },

            title: {
                ...design.title,
            },

            image: {
                ...design.image,
            },

            mainWord: {
                y: layout.mainWordY,
                fontSize: layout.mainWordFontSize,
            },

            translations: {
                startY: layout.translationStartY,
                lineHeight: layout.translationLineHeight,

                card: {
                    x: design.translations.card.x,
                    y: layout.translationCardY,
                    width: design.translations.card.width,
                    height: design.translations.card.height,
                },

                flag: {
                    ...design.translations.flag,
                },

                labelX: design.translations.label.x,
                labelFontSize:
                    design.translations.label.fontSize,

                textX: design.translations.text.x,
                textFontSize:
                    layout.translationTextFontSize,

                textColor: design.translations.text.color,

                animation: {
                    ...design.translations.animation,
                },
            },

            footer: {
                dividerY: layout.footerDividerY,
                textY: layout.footerTextY,
                fontSize: design.footer.fontSize,
                categoryX: design.footer.categoryX,
                levelX: design.footer.levelX,
            },

            margins: {
                ...design.margins,
            },

            responsive: {
                languageCount,
                designName,
            },
        };
    }

    getResponsiveLayout(
        languageCount,
        design
    ) {
        const count = Math.max(
            1,
            Number(languageCount) || 1
        );

        const referenceCount = 5;

        const extraLanguages = Math.max(
            0,
            count - referenceCount
        );

        const fewerLanguages = Math.max(
            0,
            referenceCount - count
        );

        const translationStartY =
            design.translations.card.y
            + 40
            - extraLanguages * 28
            + Math.min(fewerLanguages, 2) * 18;

        const translationCardY =
            translationStartY - 40;

        const footerDividerY =
            design.footer.dividerY
            + Math.min(extraLanguages, 3) * 10;

        const footerTextY =
            design.footer.textY
            + Math.min(extraLanguages, 3) * 10;

        const translationTextFontSize =
            Math.max(
                56,
                Math.min(
                    design.translations.text.fontSize,
                    design.translations.text.fontSize -
                    extraLanguages * 2
                )
            );

        const mainWordFontSize =
            Math.max(
                78,
                Math.min(
                    design.mainWord.fontSize,
                    design.mainWord.fontSize -
                    extraLanguages * 2
                )
            );

        const translationLineHeight =
            Math.max(
                82,
                Math.min(
                    100,
                    100 - extraLanguages * 4
                )
            );

        return {
            mainWordY:
                design.mainWord.y -
                extraLanguages * 8,

            mainWordFontSize,

            translationStartY,

            translationCardY,

            translationLineHeight,

            translationTextFontSize,

            footerDividerY,

            footerTextY,
        };
    }

    getFont() {
        return path.join(
            process.env.WINDIR || "C:\\Windows",
            "Fonts",
            "arial.ttf"
        );
    }
}