// AssertAnyStep tests — §2 Step Types
//
// AssertAny computes an actual value and the pipeline compares it against
// a list of candidates. Passes if actual matches any candidate.

import CTGTest from "../../src/CTGTest.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Pass ────────────────────────────────────────────────────

    await test("assertAny: passes when actual matches a candidate", async () => {
        const state = await CTGTest.init("assertAny pass")
            .assertAny("check", (state) => state.subject, [1, 5, 10])
            .start(5);
        assert(state.results[0].status === "pass", "matched candidate");
    });

    // ── Fail ────────────────────────────────────────────────────

    await test("assertAny: fails when actual matches no candidate", async () => {
        const state = await CTGTest.init("assertAny fail")
            .assertAny("check", (state) => state.subject, [1, 2, 3])
            .start(5, { haltOnFailure: false });
        assert(state.results[0].status === "fail", "no match");
    });

    await test("assertAny: empty candidates always fails", async () => {
        const state = await CTGTest.init("assertAny empty")
            .assertAny("check", (state) => state.subject, [])
            .start(5, { haltOnFailure: false });
        assert(state.results[0].status === "fail", "empty always fails");
    });

    // ── Result Shape ────────────────────────────────────────────

    await test("assertAny: result includes actual and candidates", async () => {
        const state = await CTGTest.init("assertAny shape")
            .assertAny("check", (state) => state.subject, [1, 5, 10])
            .start(5);
        const result = state.results[0];
        assert(result.actual === 5, "actual recorded");
        assert(Array.isArray(result.candidates), "candidates is array");
        assert(result.candidates.length === 3, "candidates preserved");
    });

    // ── Does Not Mutate Subject ─────────────────────────────────

    await test("assertAny: does not mutate subject", async () => {
        const state = await CTGTest.init("assertAny no mutate")
            .assertAny("check", (state) => state.subject * 2, [10])
            .start(5);
        assert(state.subject === 5, "subject unchanged");
    });

    // ── Strict vs Loose ─────────────────────────────────────────

    await test("assertAny: respects strict mode", async () => {
        const state = await CTGTest.init("assertAny strict")
            .assertAny("check", (state) => state.subject, ["5"])
            .start(5, { strict: true, haltOnFailure: false });
        assert(state.results[0].status === "fail", "strict rejects type coercion");
    });

    await test("assertAny: loose mode allows type coercion", async () => {
        const state = await CTGTest.init("assertAny loose")
            .assertAny("check", (state) => state.subject, ["5"])
            .start(5, { strict: false });
        assert(state.results[0].status === "pass", "loose accepts coercion");
    });

    // ── Error Handling ──────────────────────────────────────────

    await test("assertAny: error in fn produces error result", async () => {
        const state = await CTGTest.init("assertAny error")
            .assertAny("check", () => { throw new Error("boom"); }, [1])
            .start(1, { haltOnFailure: false });
        assert(state.results[0].status === "error", "status is error");
    });

    await test("assertAny: error handler recovers and re-compares", async () => {
        const state = await CTGTest.init("assertAny recovery")
            .assertAny("check", () => { throw new Error("boom"); }, ["boom", "bang"],
                (err) => err.message)
            .start(1);
        assert(state.results[0].status === "recovered", "status is recovered");
    });

    // ── Validation ──────────────────────────────────────────────

    await test("assertAny: non-array candidates fails validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad candidates")
                .assertAny("check", (state) => state.subject, "not an array")
                .start(1);
        } catch {
            threw = true;
        }
        assert(threw, "non-array threw");
    });
}
