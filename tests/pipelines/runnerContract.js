// Runner contract tests — §1 Runner Contract, Exit Code Rule
//
// Tests the canonical runner behavior: state-based collection,
// formatter accepts CTGTestState, exit code semantics.

import CTGTest from "../../src/CTGTest.js";
import CTGTestState from "../../src/CTGTestState.js";
import CTGTestConsoleFormatter from "../../src/formatters/CTGTestConsoleFormatter.js";
import CTGTestJsonFormatter from "../../src/formatters/CTGTestJsonFormatter.js";
import CTGTestJunitFormatter from "../../src/formatters/CTGTestJunitFormatter.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Formatter Accepts CTGTestState ──────────────────────────

    await test("runner: console formatter accepts CTGTestState", async () => {
        const state = await CTGTest.init("formatter test")
            .assert("check", (state) => state.subject, 5)
            .start(5);
        assert(state instanceof CTGTestState, "state is CTGTestState");
        const formatted = CTGTestConsoleFormatter.format(state);
        assert(typeof formatted === "string", "returns string");
        assert(formatted.length > 0, "non-empty output");
    });

    await test("runner: json formatter accepts CTGTestState", async () => {
        const state = await CTGTest.init("json test")
            .assert("check", (state) => state.subject, 5)
            .start(5);
        const formatted = CTGTestJsonFormatter.format(state);
        assert(typeof formatted === "string", "returns string");
        const parsed = JSON.parse(formatted);
        assert(parsed !== null, "valid JSON");
    });

    await test("runner: junit formatter accepts CTGTestState", async () => {
        const state = await CTGTest.init("junit test")
            .assert("check", (state) => state.subject, 5)
            .start(5);
        const formatted = CTGTestJunitFormatter.format(state);
        assert(typeof formatted === "string", "returns string");
        assert(formatted.includes("<?xml") || formatted.includes("<testsuite"),
            "XML output");
    });

    // ── Exit Code Semantics ─────────────────────────────────────

    await test("runner: pass status is non-failing", () => {
        const state = new CTGTestState({ subject: 1, name: "test" });
        state.results.push({ name: "a", status: "pass" });
        const failing = state.status === "fail" || state.status === "error";
        assert(!failing, "pass is non-failing");
    });

    await test("runner: recovered status is non-failing", () => {
        const state = new CTGTestState({ subject: 1, name: "test" });
        state.results.push({ name: "a", status: "recovered" });
        const failing = state.status === "fail" || state.status === "error";
        assert(!failing, "recovered is non-failing");
    });

    await test("runner: skip status is non-failing", () => {
        const state = new CTGTestState({ subject: 1, name: "test" });
        state.results.push({ name: "a", status: "skip" });
        const failing = state.status === "fail" || state.status === "error";
        assert(!failing, "skip is non-failing");
    });

    await test("runner: fail status is failing", () => {
        const state = new CTGTestState({ subject: 1, name: "test" });
        state.results.push({ name: "a", status: "fail" });
        const failing = state.status === "fail" || state.status === "error";
        assert(failing, "fail is failing");
    });

    await test("runner: error status is failing", () => {
        const state = new CTGTestState({ subject: 1, name: "test" });
        state.results.push({ name: "a", status: "error" });
        const failing = state.status === "fail" || state.status === "error";
        assert(failing, "error is failing");
    });

    // ── Removed Config Surface ──────────────────────────────────

    await test("runner: output is not a valid config key", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { output: "console" });
        } catch {
            threw = true;
        }
        assert(threw, "output config rejected");
    });

    await test("runner: formatter is not a valid config key", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { formatter: null });
        } catch {
            threw = true;
        }
        assert(threw, "formatter config rejected");
    });
}
