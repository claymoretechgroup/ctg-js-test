// Pipeline execution tests — §2 Pipeline Execution, §4 Responsibility
//
// Tests sequencing, outcome evaluation, comparison, halt behavior,
// and the step-to-pipeline data handoff.

import CTGTest from "../../src/CTGTest.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Sequencing ──────────────────────────────────────────────

    await test("pipeline: steps execute in order", async () => {
        const order = [];
        const state = await CTGTest.init("ordering")
            .stage("first", (state) => { order.push(1); return state; })
            .stage("second", (state) => { order.push(2); return state; })
            .stage("third", (state) => { order.push(3); return state; })
            .start(null);
        assert(order[0] === 1 && order[1] === 2 && order[2] === 3, "sequential order");
    });

    await test("pipeline: empty pipeline produces pass with zero results", async () => {
        const state = await CTGTest.init("empty")
            .start(null);
        assert(state.results.length === 0, "no results");
        assert(state.status === "pass", "empty is pass");
    });

    // ── Halt on Failure ─────────────────────────────────────────

    await test("pipeline: haltOnFailure stops at first fail", async () => {
        const state = await CTGTest.init("halt")
            .assert("pass", (state) => 1, 1)
            .assert("fail", (state) => 1, 99)
            .assert("unreachable", (state) => 1, 1)
            .start(null, { haltOnFailure: true });
        assert(state.results.length === 2, "stopped after fail");
        assert(state.results[1].status === "fail", "second is fail");
    });

    await test("pipeline: haltOnFailure false runs all steps", async () => {
        const state = await CTGTest.init("no halt")
            .assert("pass", (state) => 1, 1)
            .assert("fail", (state) => 1, 99)
            .assert("also runs", (state) => 1, 1)
            .start(null, { haltOnFailure: false });
        assert(state.results.length === 3, "all three ran");
    });

    await test("pipeline: haltOnFailure does not stop on recovered", async () => {
        const state = await CTGTest.init("no halt on recovered")
            .stage("recover", () => { throw new Error("boom"); },
                (err) => err.message)
            .assert("still runs", (state) => state.subject, "boom")
            .start(null, { haltOnFailure: true });
        assert(state.results.length === 2, "both ran");
        assert(state.results[0].status === "recovered", "first is recovered");
    });

    // ── Subject Threading ───────────────────────────────────────

    await test("pipeline: stage updates subject for next step", async () => {
        const state = await CTGTest.init("threading")
            .stage("set", (state) => { state.subject = 42; return state; })
            .assert("check", (state) => state.subject, 42)
            .start(null);
        assert(state.status === "pass", "threaded correctly");
    });

    await test("pipeline: assert does not update subject", async () => {
        const state = await CTGTest.init("assert no thread")
            .stage("set", (state) => { state.subject = 5; return state; })
            .assert("compute", (state) => state.subject * 2, 10)
            .assert("still 5", (state) => state.subject, 5)
            .start(null);
        assert(state.status === "pass", "subject unchanged after assert");
    });

    // ── Comparison ──────────────────────────────────────────────

    await test("pipeline: deep object comparison", async () => {
        const state = await CTGTest.init("deep compare")
            .assert("check", (state) => ({ a: 1, b: [2, 3] }), { a: 1, b: [2, 3] })
            .start(null);
        assert(state.results[0].status === "pass", "deep equal passes");
    });

    await test("pipeline: deep object mismatch fails", async () => {
        const state = await CTGTest.init("deep mismatch")
            .assert("check", (state) => ({ a: 1 }), { a: 2 })
            .start(null, { haltOnFailure: false });
        assert(state.results[0].status === "fail", "deep mismatch fails");
    });

    // ── Config ──────────────────────────────────────────────────

    await test("pipeline: config accessible in state", async () => {
        const state = await CTGTest.init("config access")
            .assert("check", (state) => state.config.strict, true)
            .start(null, { strict: true });
        assert(state.results[0].status === "pass", "config on state");
    });

    // ── Duplicate Step Names ────────────────────────────────────

    await test("pipeline: duplicate step names fail validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("dupes")
                .stage("same", (state) => state)
                .stage("same", (state) => state)
                .start(null);
        } catch {
            threw = true;
        }
        assert(threw, "duplicate names threw");
    });

    // ── Empty Test Name ─────────────────────────────────────────

    await test("pipeline: empty test name fails validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("")
                .stage("step", (state) => state)
                .start(null);
        } catch {
            threw = true;
        }
        assert(threw, "empty name threw");
    });

    // ── Start Wraps Raw Subject ─────────────────────────────────

    await test("pipeline: start wraps raw value in CTGTestState", async () => {
        const state = await CTGTest.init("wrap")
            .assert("check", (state) => state.subject, 42)
            .start(42);
        assert(state.results[0].status === "pass", "raw value wrapped");
    });

    await test("pipeline: start accepts null subject", async () => {
        const state = await CTGTest.init("null subject")
            .assert("check", (state) => state.subject, null)
            .start(null);
        assert(state.results[0].status === "pass", "null subject works");
    });
}
