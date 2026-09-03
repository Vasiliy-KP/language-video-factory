export class ProgressReporter {
    constructor(name, total) {
        this.name = name;
        this.total = total;

        this.completed = 0;
        this.generated = 0;
        this.skipped = 0;
        this.failed = 0;
    }

    complete(result) {
        this.completed++;

        if (result === "generated") {
            this.generated++;
        }

        if (result === "skipped") {
            this.skipped++;
        }

        if (result === "failed") {
            this.failed++;
        }

        this.show();
    }

    show() {
        const percentage =
            this.total === 0
                ? 100
                : ((this.completed / this.total) * 100).toFixed(1);

        console.log(
            `📊 ${this.name} Progress: ` +
            `${this.completed}/${this.total} ` +
            `(${percentage}%)`
        );
    }

    showSummary() {
        console.log("");
        console.log(`## ${this.name} Summary`);
        console.log("");

        console.log(`Generated: ${this.generated}`);
        console.log(`Skipped:   ${this.skipped}`);
        console.log(`Failed:    ${this.failed}`);
    }
}