import { VideoTemplateService } from "./src/services/video/VideoTemplateService.js";

const templateService =
    new VideoTemplateService();

const languageCounts = [
    3,
    4,
    5,
    6,
    7,
    8,
];

console.log(
    "▶ Testing responsive layouts...\n"
);

for (const count of languageCounts) {
    const template =
        templateService.getWordTemplate(
            count
        );

    console.log(
        `${count} languages:`
    );

    console.log(
        `  mainWordY:          ${template.mainWord.y}`
    );

    console.log(
        `  mainWordFontSize:   ${template.mainWord.fontSize}`
    );

    console.log(
        `  translationStartY:  ${template.translations.startY}`
    );

    console.log(
        `  translationCardY:   ${template.translations.card.y}`
    );

    console.log(
        `  lineHeight:         ${template.translations.lineHeight}`
    );

    console.log(
        `  textFontSize:       ${template.translations.textFontSize}`
    );

    console.log(
        `  footerDividerY:     ${template.footer.dividerY}`
    );

    console.log(
        `  footerTextY:        ${template.footer.textY}`
    );

    console.log("");
}

console.log(
    "✅ Responsive layout test completed"
);