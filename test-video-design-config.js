import { videoDesign } from "./src/config/videoDesign.js";
import { VideoTemplateService } from "./src/services/video/VideoTemplateService.js";

const templateService =
    new VideoTemplateService();

console.log("▶ Testing video design configuration...\n");

for (const designName of Object.keys(videoDesign)) {
    const template =
        templateService.getWordTemplate(
            5,
            designName
        );

    console.log(
        `Design: ${designName}`
    );

    console.log(
        `  background: ${template.colors.background}`
    );

    console.log(
        `  title: ${template.title.text}`
    );

    console.log(
        `  image: ${template.image.width}x${template.image.height}`
    );

    console.log(
        `  translation font: ${template.translations.textFontSize}`
    );

    console.log(
        `  fade: ${template.translations.animation.fadeDuration}s`
    );

    console.log(
        `  slide distance: ${template.translations.animation.slideDistance}`
    );

    console.log(
        `  slide speed: ${template.translations.animation.slideSpeed}`
    );

    console.log("");
}

console.log(
    "✅ Video design configuration test completed"
);