export const videoContent = {
    default: {
        title: {
            text: "LEARN A NEW WORD",
            enabled: true,
        },

        mainWord: {
            enabled: true,
            source: "primaryLanguage",
        },

        activeTranslation: {
            showFlag: true,
            showLanguageLabel: true,
            showText: true,
        },

        footer: {
            showCategory: true,
            showLevel: true,
        },
    },

    simple: {
        title: {
            text: "WORD OF THE DAY",
            enabled: true,
        },

        mainWord: {
            enabled: true,
            source: "primaryLanguage",
        },

        activeTranslation: {
            showFlag: true,
            showLanguageLabel: false,
            showText: true,
        },

        footer: {
            showCategory: false,
            showLevel: true,
        },
    },
};