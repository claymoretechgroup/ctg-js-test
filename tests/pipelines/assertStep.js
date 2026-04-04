// AssertStep tests — §2 Step Types
//
// Assert computes an actual value from state. The pipeline compares it
// to the expected value. The step does not know if it passed or failed.

import CTGTest from "../../src/CTGTest.js";
import CTGTestState from "../../src/CTGTestState.js";
import CTGTestResult from "../../src/CTGTestResult.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Pass ────────────────────────────────────────────────────

    await test("assert: passes when actual matches expected", async () => {
        const state = await CTGTest.init("assert pass")
            .assert("check", (state) => state.subject, 5)
            .start(5);
        assert(state.results[0].status === CTGTestResult.STATUS.PASS, "status is pass");
    });

    // ── Fail ────────────────────────────────────────────────────

    await test("assert: fails when actual does not match expected", async () => {
        const state = await CTGTest.init("assert fail")
            .assert("check", (state) => state.subject, 99)
            .start(5, { haltOnFailure: false });
        assert(state.results[0].status === CTGTestResult.STATUS.FAIL, "status is fail");
    });

    // ── Does Not Mutate Subject ─────────────────────────────────

    await test("assert: does not mutate subject", async () => {
        const state = await CTGTest.init("assert no mutate")
            .assert("check", (state) => state.subject * 2, 10)
            .start(5);
        assert(state.subject === 5, "subject unchanged");
    });

    // ── Actual Value Recorded ───────────────────────────────────

    await test("assert: result includes actual and expected", async () => {
        const state = await CTGTest.init("assert values")
            .assert("check", (state) => state.subject, 5)
            .start(5);
        const result = state.results[0];
        assert(result.actual === 5, "actual recorded");
        assert(result.expected === 5, "expected recorded");
    });

    await test("assert: fail result includes actual and expected", async () => {
        const state = await CTGTest.init("assert fail values")
            .assert("check", (state) => state.subject, 99)
            .start(5, { haltOnFailure: false });
        const result = state.results[0];
        assert(result.actual === 5, "actual recorded");
        assert(result.expected === 99, "expected recorded");
    });

    // ── Async ───────────────────────────────────────────────────

    await test("assert: async fn is awaited", async () => {
        const state = await CTGTest.init("async assert")
            .assert("check", async (state) => state.subject, 5)
            .start(5);
        assert(state.results[0].status === CTGTestResult.STATUS.PASS, "async pass");
    });

    // ── v2 Callback Signature ─────────────────────────────────

    await test("assert: callback receives CTGTestState, not raw subject", async () => {
        let receivedArg = null;
        const state = await CTGTest.init("callback sig")
            .assert("capture", (arg) => { receivedArg = arg; return arg.subject; }, 5)
            .start(5);
        assert(receivedArg instanceof CTGTestState, "arg is CTGTestState");
    });

    // ── Strict vs Loose ─────────────────────────────────────────

    await test("assert: strict mode fails on type mismatch", async () => {
        const state = await CTGTest.init("strict assert")
            .assert("check", (state) => state.subject, "5")
            .start(5, { strict: true, haltOnFailure: false });
        assert(state.results[0].status === CTGTestResult.STATUS.FAIL, "strict rejects 5 === '5'");
    });

    await test("assert: loose mode passes on type coercion", async () => {
        const state = await CTGTest.init("loose assert")
            .assert("check", (state) => state.subject, "5")
            .start(5, { strict: false });
        assert(state.results[0].status === CTGTestResult.STATUS.PASS, "loose accepts 5 == '5'");
    });

    // ── Error Handling ──────────────────────────────────────────

    await test("assert: error in fn produces error result", async () => {
        const state = await CTGTest.init("assert error")
            .assert("check", () => { throw new Error("boom"); }, 5)
            .start(1, { haltOnFailure: false });
        assert(state.results[0].status === CTGTestResult.STATUS.ERROR, "status is error");
    });

    await test("assert: error handler recovers and re-compares", async () => {
        const state = await CTGTest.init("assert recovery")
            .assert("check", () => { throw new Error("boom"); }, "boom",
                (err) => err.message)
            .start(1);
        assert(state.results[0].status === CTGTestResult.STATUS.RECOVERED, "status is recovered");
    });

    // ── Validation ──────────────────────────────────────────────

    await test("assert: function as expected fails validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad expected")
                .assert("check", (state) => state.subject, () => {})
                .start(1);
        } catch {
            threw = true;
        }
        assert(threw, "function expected threw");
    });

    await test("assert: non-function fn fails validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad fn")
                .assert("check", "not a function", 5)
                .start(1);
        } catch {
            threw = true;
        }
        assert(threw, "non-function fn threw");
    });
}
