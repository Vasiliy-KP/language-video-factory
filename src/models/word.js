export class Word {
    constructor(data) {
        this.id = data.id;
        this.category = data.category;
        this.uk = data.uk;
        this.en = data.en;
        this.fr = data.fr;
        this.de = data.de;
        this.imagePrompt = data.imagePrompt;
        this.level = data.level;
    }
}