// CTGTestStep base contract tests — §2 Polymorphic Step Types
//
// Validates the base step class contract: execute(state) and validate()
// as abstract methods that concrete step types must implement.

import CTGTestStep from "../../src/CTGTestStep.js";
import CTGTestState from "../../src/CTGTestState.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Base Class ──────────────────────────────────────────────

    await test("step: base class has execute method", () => {
        const step = new CTGTestStep("base", "test step");
        assert(typeof step.execute === "function", "execute is a function");
    });

    await test("step: base class has validate method", () => {
        const step = new CTGTestStep("base", "test step");
        assert(typeof step.validate === "function", "validate is a function");
    });

    await test("step: stores type and name", () => {
        const step = new CTGTestStep("stage", "my step");
        assert(step.type === "stage", "type is stored");
        assert(step.name === "my step", "name is stored");
    });

    // ── Execute Contract ────────────────────────────────────────

    await test("step: base execute throws not implemented", async () => {
        const step = new CTGTestStep("base", "test step");
        const state = new CTGTestState({ subject: 1 });
        let threw = false;
        try {
            await step.execute(state);
        } catch (err) {
            threw = true;
            assert(err.message.includes("execute"), "error mentions execute");
        }
        assert(threw, "base execute throws");
    });

    // ── Validate Contract ───────────────────────────────────────

    await test("step: base validate throws not implemented", () => {
        const step = new CTGTestStep("base", "test step");
        let threw = false;
        try {
            step.validate();
        } catch (err) {
            threw = true;
            assert(err.message.includes("validate"), "error mentions validate");
        }
        assert(threw, "base validate throws");
    });

    // ── Error Handler ───────────────────────────────────────────

    await test("step: stores error handler at construction", () => {
        const handler = (err) => err.message;
        const step = new CTGTestStep("stage", "my step", { errorHandler: handler });
        assert(step.errorHandler === handler, "error handler stored");
    });

    await test("step: error handler defaults to null", () => {
        const step = new CTGTestStep("stage", "my step");
        assert(step.errorHandler === null, "default is null");
    });
}
