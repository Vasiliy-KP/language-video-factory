import path from "path";

export class VideoTemplateService {
    getWordTemplate() {
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
                y: 1110,
                fontSize: 88,
            },

            translations: {
                startY: 1260,
                lineHeight: 100,

                card: {
                    x: 100,
                    y: 1220,
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
                textFontSize: 58,
            },

            footer: {
                dividerY: 1650,
                textY: 1720,
                fontSize: 36,
            },

            margins: {
                left: 120,
                right: 120,
            },
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