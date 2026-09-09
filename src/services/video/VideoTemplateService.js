import path from "path";

export class VideoTemplateService {
    getWordTemplate() {
        return {
            width: 1080,
            height: 1920,

            colors: {
                background: "#0F172A",
                card: "#FFFFFF",
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
                startY: 1245,
                lineHeight: 100,
                labelFontSize: 34,
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