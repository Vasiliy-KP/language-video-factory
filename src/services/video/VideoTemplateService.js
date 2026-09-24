import path from "path";

export class VideoTemplateService {
    getWordTemplate(languageCount = 5) {
        const layout = this.getResponsiveLayout(
            languageCount
        );

        return {
            width: 1080,
            height: 1920,

            colors: {
                background: "#0F172A",
                card: "#FFFFFF",
                activeCard: "#1E293B",
                title: "#94A3B8",
                primary: "#38BDF8",
                text: "#FFFFFF",
                secondary: "#CBD5E1",
                muted: "#64748B",
                divider: "#334155",
            },

            title: {
                text: "LEARN A NEW WORD",
                fontSize: 44,
                y: 120,
            },

            image: {
                x: 165,
                y: 275,
                width: 750,
                height: 750,
            },

            mainWord: {
                y: layout.mainWordY,
                fontSize: layout.mainWordFontSize,
            },

            translations: {
                startY: layout.translationStartY,
                lineHeight: layout.translationLineHeight,

                card: {
                    x: 100,
                    y: layout.translationCardY,
                    width: 880,
                    height: 88,
                },

                flag: {
                    x: 120,
                    size: 56,
                },

                labelX: 210,
                labelFontSize: 32,

                textX: 300,
                textFontSize: layout.translationTextFontSize,
                textColor: "#38BDF8",

                animation: {
                    fadeDuration: 0.18,
                    slideDistance: 60,
                },
            },

            footer: {
                dividerY: layout.footerDividerY,
                textY: layout.footerTextY,
                fontSize: 36,
            },

            margins: {
                left: 120,
                right: 120,
            },

            responsive: {
                languageCount,
            },
        };
    }

    getResponsiveLayout(languageCount) {
        const count = Math.max(
            1,
            Number(languageCount) || 1
        );

        /*
         * 5 languages = our current reference layout.
         */

        const referenceCount = 5;

        /*
         * Extra languages move the lower content
         * slightly upward so the composition
         * remains balanced.
         */

        const extraLanguages = Math.max(
            0,
            count - referenceCount
        );

        /*
         * Fewer languages give us a little more
         * vertical breathing room.
         */

        const fewerLanguages = Math.max(
            0,
            referenceCount - count
        );

        const translationStartY =
            1260
            - extraLanguages * 28
            + Math.min(fewerLanguages, 2) * 18;

        const translationCardY =
            translationStartY - 40;

        const footerDividerY =
            1650
            + Math.min(extraLanguages, 3) * 10;

        const footerTextY =
            1720
            + Math.min(extraLanguages, 3) * 10;

        /*
         * Keep typography within safe limits.
         */

        const translationTextFontSize =
            Math.max(
                56,
                Math.min(
                    64,
                    64 - extraLanguages * 2
                )
            );

        const mainWordFontSize =
            Math.max(
                78,
                Math.min(
                    88,
                    88 - extraLanguages * 2
                )
            );

        /*
         * Line height is only reduced when the
         * language count becomes large.
         */

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
                1110 - extraLanguages * 8,

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