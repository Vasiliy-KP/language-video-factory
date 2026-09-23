import path from "path";
import { languages } from "./languages.js";

export const config = {
    app: {
        name: "Language Video Factory",
        version: "0.1.0",
    },

    paths: {
        data: path.resolve("data"),
        output: path.resolve("output"),
        cache: path.resolve("cache"),
        downloads: path.resolve("downloads"),
        assets: path.resolve("assets"),
        temp: path.resolve("temp"),
        logs: path.resolve("logs"),
    },

    data: {
        wordsFile: "words.xlsx",
    },

    video: {
        width: 1080,
        height: 1920,
        fps: 30,
    },

    languages: languages.map(
        (language) => language.code
    ),
};