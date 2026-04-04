// StageStep tests — §2 Step Types
//
// Stage computes a transformed subject. The pipeline records the result.
// Stage does not evaluate correctness — it transforms state.subject.

import CTGTest from "../../src/CTGTest.js";
import CTGTestState from "../../src/CTGTestState.js";
import CTGTestResult from "../../src/CTGTestResult.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Basic Transformation ────────────────────────────────────

    await test("stage: transforms subject", async () => {
        const state = await CTGTest.init("stage transform")
            .stage("double", (state) => { state.subject = state.subject * 2; return state; })
            .start(5);
        assert(state.subject === 10, "subject doubled");
    });

    await test("stage: chains transformations sequentially", async () => {
        const state = await CTGTest.init("stage chain")
            .stage("add 1", (state) => { state.subject = state.subject + 1; return state; })
            .stage("multiply 3", (state) => { state.subject = state.subject * 3; return state; })
            .start(5);
        assert(state.subject === 18, "(5 + 1) * 3 = 18");
    });

    await test("stage: result recorded as pass", async () => {
        const state = await CTGTest.init("stage pass")
            .stage("noop", (state) => state)
            .start(1);
        assert(state.results.length === 1, "one result");
        assert(state.results[0].status === CTGTestResult.STATUS.PASS, "status is pass");
        assert(state.results[0].name === "noop", "name matches");
    });

    // ── Async ───────────────────────────────────────────────────

    await test("stage: async fn is awaited", async () => {
        const state = await CTGTest.init("async stage")
            .stage("async double", async (state) => {
                state.subject = state.subject * 2;
                return state;
            })
            .start(7);
        assert(state.subject === 14, "async result applied");
    });

    // ── Error Handling ──────────────────────────────────────────

    await test("stage: error produces error result", async () => {
        const state = await CTGTest.init("stage error")
            .stage("fail", () => { throw new Error("boom"); })
            .start(1, { haltOnFailure: false });
        assert(state.results[0].status === CTGTestResult.STATUS.ERROR, "status is error");
    });

    await test("stage: error handler recovers", async () => {
        const state = await CTGTest.init("stage recovery")
            .stage("fail", () => { throw new Error("boom"); },
                (err) => err.message)
            .start(1);
        assert(state.results[0].status === CTGTestResult.STATUS.RECOVERED, "status is recovered");
    });

    // ── v2 Callback Signature ─────────────────────────────────

    await test("stage: callback receives CTGTestState, not raw subject", async () => {
        let receivedArg = null;
        const state = await CTGTest.init("callback sig")
            .stage("capture", (arg) => { receivedArg = arg; return arg; })
            .start(5);
        assert(receivedArg instanceof CTGTestState, "arg is CTGTestState");
        assert(receivedArg.subject === 5, "subject accessible on state");
    });

    // ── Return Contract ─────────────────────────────────────────

    await test("stage: non-state return produces error", async () => {
        const state = await CTGTest.init("bad return")
            .stage("bad", () => 42)
            .start(1, { haltOnFailure: false });
        assert(state.results[0].status === CTGTestResult.STATUS.ERROR, "non-state return errored");
    });

    // ── Validation ──────────────────────────────────────────────

    await test("stage: non-function fn fails validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad stage")
                .stage("bad", "not a function")
                .start(1);
        } catch (err) {
            threw = true;
        }
        assert(threw, "validation threw");
    });

    await test("stage: empty name fails validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad name")
                .stage("", (state) => state)
                .start(1);
        } catch (err) {
            threw = true;
        }
        assert(threw, "empty name threw");
    });
}
