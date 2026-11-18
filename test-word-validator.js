import assert from "node:assert/strict";

import {
    WordValidator,
} from "./src/validators/wordValidator.js";

function createWord(overrides = {}, rowNumber = 2) {
    return {
        id: 1,
        category: "Transport",
        uk: "велосипед",
        en: "Bicycle",
        pl: "Rower",
        fr: "Vélo",
        de: "Fahrrad",
        es: "Bicicleta",
        imagePrompt: "modern bicycle isolated on white background",
        level: "A1",
        rowNumber,
        ...overrides,
    };
}

console.log("▶ Testing WordValidator...");

// 1. Валідний запис.
const validResult = WordValidator.validateAll([
    createWord(),
    createWord({
        id: 2,
        uk: "яблуко",
        en: "Apple",
        pl: "Jabłko",
        fr: "Pomme",
        de: "Apfel",
        es: "Manzana",
        category: "Food",
    }, 3),
]);

assert.equal(validResult.valid, true);
assert.equal(validResult.validWords.length, 2);
assert.equal(validResult.summary.total, 2);
assert.equal(validResult.summary.invalid, 0);

console.log("✅ Valid vocabulary records are accepted");

// 2. Порожнє поле та пробіли.
const missingFieldResult = WordValidator.validateAll([
    createWord({
        en: "   ",
    }, 5),
]);

assert.equal(missingFieldResult.valid, false);
assert.equal(missingFieldResult.validWords.length, 0);

assert.ok(
    missingFieldResult.errors.some(
        error =>
            error.row === 5 &&
            error.field === "en" &&
            error.code === "required_field"
    )
);

console.log("✅ Empty and whitespace-only fields are detected");

// 3. Неправильний тип даних.
const invalidTypeResult = WordValidator.validateAll([
    createWord({
        en: 123,
    }),
]);

assert.ok(
    invalidTypeResult.errors.some(
        error =>
            error.field === "en" &&
            error.code === "invalid_type"
    )
);

console.log("✅ Invalid field types are detected");

// 4. Непідтримуваний рівень.
const invalidLevelResult = WordValidator.validateAll([
    createWord({
        level: "D1",
    }),
]);

assert.ok(
    invalidLevelResult.errors.some(
        error =>
            error.field === "level" &&
            error.code === "invalid_level"
    )
);

console.log("✅ Unsupported CEFR levels are detected");

// 5. Некоректний ID.
const invalidIdResult = WordValidator.validateAll([
    createWord({
        id: 0,
    }),
]);

assert.ok(
    invalidIdResult.errors.some(
        error => error.code === "invalid_id"
    )
);

console.log("✅ Invalid IDs are detected");

// 6. Повторний ID.
const duplicateIdResult = WordValidator.validateAll([
    createWord({}, 2),
    createWord({
        id: 1,
        en: "Cycle",
        uk: "цикл",
        pl: "Cykl",
        fr: "Cycle",
        de: "Zyklus",
        es: "Ciclo",
    }, 7),
]);

assert.equal(duplicateIdResult.valid, false);

assert.ok(
    duplicateIdResult.errors.some(
        error =>
            error.row === 7 &&
            error.code === "duplicate_id" &&
            error.message.includes("row 2")
    )
);

console.log("✅ Duplicate IDs are detected");

// 7. Повторний словниковий запис.
const duplicateWordResult = WordValidator.validateAll([
    createWord({}, 2),
    createWord({
        id: 2,
    }, 9),
]);

assert.ok(
    duplicateWordResult.errors.some(
        error =>
            error.row === 9 &&
            error.code === "duplicate_word" &&
            error.message.includes("row 2")
    )
);

console.log("✅ Duplicate vocabulary records are detected");

// 8. Однакові переклади в різних категоріях
// не вважаються автоматично дублікатами.
const differentCategoryResult = WordValidator.validateAll([
    createWord({}, 2),
    createWord({
        id: 2,
        category: "Other category",
    }, 3),
]);

assert.equal(differentCategoryResult.valid, true);

console.log("✅ Different categories are treated separately");

// 9. Зберігаємо сумісність зі старим методом validate().
assert.equal(
    WordValidator.validate(createWord()),
    true
);

assert.equal(
    WordValidator.validate(
        createWord({ en: "" })
    ),
    false
);

console.log("✅ Legacy validate() method remains compatible");

// 10. Порожній словник.
const emptyResult = WordValidator.validateAll([]);

assert.equal(emptyResult.valid, false);
assert.equal(emptyResult.summary.total, 0);

assert.ok(
    emptyResult.errors.some(
        error => error.code === "no_words"
    )
);

console.log("✅ Empty vocabulary is rejected");

console.log("\n✅ All WordValidator tests passed.");