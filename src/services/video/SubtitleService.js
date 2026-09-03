import fs from "fs/promises";
import path from "path";

export class SubtitleService {
    async create(timeline, outputPath) {
        const content = [
            "[Script Info]",
            "ScriptType: v4.00+",
            "PlayResX: 1080",
            "PlayResY: 1920",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, " +
            "SecondaryColour, OutlineColour, BackColour, Bold, " +
            "Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, " +
            "Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, " +
            "MarginR, MarginV, Encoding",
            "Style: Default,Arial,72,&H00FFFFFF,&H00FFFFFF," +
            "&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,4,2,2," +
            "2,60,60,200,1",
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, " +
            "MarginR, MarginV, Effect, Text",
        ];

        for (const segment of timeline) {
            const start = this.formatTime(segment.start);
            const end = this.formatTime(segment.end);

            const text = this.escapeText(segment.text);

            content.push(
                `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`
            );
        }

        await fs.mkdir(
            path.dirname(outputPath),
            { recursive: true }
        );

        await fs.writeFile(
            outputPath,
            content.join("\n"),
            "utf8"
        );

        return outputPath;
    }

    formatTime(seconds) {
        const centiseconds =
            Math.floor((seconds % 1) * 100);

        const totalSeconds =
            Math.floor(seconds);

        const hours =
            Math.floor(totalSeconds / 3600);

        const minutes =
            Math.floor((totalSeconds % 3600) / 60);

        const remainingSeconds =
            totalSeconds % 60;

        return (
            `${hours}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(remainingSeconds).padStart(2, "0")}.` +
            `${String(centiseconds).padStart(2, "0")}`
        );
    }

    escapeText(text) {
        return text
            .replaceAll("\\", "\\\\")
            .replaceAll("{", "\\{")
            .replaceAll("}", "\\}");
    }
}