// CTGTestState tests — §5 Pipeline State
//
// Validates the state object contract: construction, subject wrapping,
// results accumulation, config access, and extensibility.

import CTGTestState from "../../src/CTGTestState.js";
import CTGTestResult from "../../src/CTGTestResult.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Construction ────────────────────────────────────────────

    await test("state: constructs with subject, results, and config", () => {
        const state = new CTGTestState({ subject: 5, config: { haltOnFailure: true } });
        assert(state.subject === 5, "subject is set");
        assert(Array.isArray(state.results), "results is an array");
        assert(state.results.length === 0, "results starts empty");
        assert(state.config.haltOnFailure === true, "config is accessible");
    });

    await test("state: defaults subject to null", () => {
        const state = new CTGTestState({});
        assert(state.subject === null, "subject defaults to null");
    });

    await test("state: defaults config to empty object", () => {
        const state = new CTGTestState({ subject: 1 });
        assert(typeof state.config === "object", "config is an object");
        assert(Object.keys(state.config).length === 0, "config is empty");
    });

    await test("state: results accumulates entries", () => {
        const state = new CTGTestState({ subject: 1 });
        state.results.push({ name: "step 1", status: CTGTestResult.STATUS.PASS });
        state.results.push({ name: "step 2", status: CTGTestResult.STATUS.FAIL });
        assert(state.results.length === 2, "two results");
        assert(state.results[0].name === "step 1", "first result name");
        assert(state.results[1].status === CTGTestResult.STATUS.FAIL, "second result status");
    });

    // ── Subject Mutation ────────────────────────────────────────

    await test("state: subject is mutable", () => {
        const state = new CTGTestState({ subject: 5 });
        state.subject = 10;
        assert(state.subject === 10, "subject updated");
    });

    // ── Actual Value Handoff ────────────────────────────────────

    await test("state: actual field for assert handoff", () => {
        const state = new CTGTestState({ subject: 5 });
        state.actual = 42;
        assert(state.actual === 42, "actual is readable");
    });

    // ── Skip Targets ────────────────────────────────────────────

    await test("state: skipTargets for skip handoff", () => {
        const state = new CTGTestState({ subject: 1 });
        assert(typeof state.skipTargets === "object", "skipTargets exists");
        state.skipTargets["my step"] = true;
        assert(state.skipTargets["my step"] === true, "skip target set");
    });

    // ── Status ──────────────────────────────────────────────────

    await test("state: status aggregates from results", () => {
        const state = new CTGTestState({ subject: 1 });
        state.results.push({ name: "a", status: CTGTestResult.STATUS.PASS });
        state.results.push({ name: "b", status: CTGTestResult.STATUS.PASS });
        assert(state.status === CTGTestResult.STATUS.PASS, "all pass = pass");
    });

    await test("state: status is fail when any result fails", () => {
        const state = new CTGTestState({ subject: 1 });
        state.results.push({ name: "a", status: CTGTestResult.STATUS.PASS });
        state.results.push({ name: "b", status: CTGTestResult.STATUS.FAIL });
        assert(state.status === CTGTestResult.STATUS.FAIL, "any fail = fail");
    });

    await test("state: status is error when any result errors", () => {
        const state = new CTGTestState({ subject: 1 });
        state.results.push({ name: "a", status: CTGTestResult.STATUS.PASS });
        state.results.push({ name: "b", status: CTGTestResult.STATUS.ERROR });
        assert(state.status === CTGTestResult.STATUS.ERROR, "any error = error");
    });

    await test("state: error status takes precedence over fail", () => {
        const state = new CTGTestState({ subject: 1 });
        state.results.push({ name: "a", status: CTGTestResult.STATUS.FAIL });
        state.results.push({ name: "b", status: CTGTestResult.STATUS.ERROR });
        assert(state.status === CTGTestResult.STATUS.ERROR, "error > fail");
    });

    await test("state: name is accessible", () => {
        const state = new CTGTestState({ subject: 1, name: "my pipeline" });
        assert(state.name === "my pipeline", "name is set");
    });
}
