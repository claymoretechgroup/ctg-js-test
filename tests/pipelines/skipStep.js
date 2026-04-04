// SkipStep tests — §2 Skip
//
// Skip is a step type that targets another step by name. It evaluates
// a predicate against state and determines whether the target executes.

import CTGTest from "../../src/CTGTest.js";
import CTGTestResult from "../../src/CTGTestResult.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Unconditional Skip ──────────────────────────────────────

    await test("skip: unconditional skip prevents target execution", async () => {
        const state = await CTGTest.init("unconditional skip")
            .skip("skip it", "check")
            .assert("check", (state) => state.subject, 99)
            .start(5);

        const result = state.results.find((r) => r.name === "check");
        assert(result.status === CTGTestResult.STATUS.SKIP, "target was skipped");
    });

    // ── Conditional Skip — True ─────────────────────────────────

    await test("skip: predicate true skips target", async () => {
        const state = await CTGTest.init("conditional skip true")
            .skip("skip if negative", "check", (state) => state.subject < 0)
            .assert("check", (state) => state.subject, 99)
            .start(-1);

        const result = state.results.find((r) => r.name === "check");
        assert(result.status === CTGTestResult.STATUS.SKIP, "negative subject skipped");
    });

    // ── Conditional Skip — False ────────────────────────────────

    await test("skip: predicate false executes target normally", async () => {
        const state = await CTGTest.init("conditional skip false")
            .skip("skip if negative", "check", (state) => state.subject < 0)
            .assert("check", (state) => state.subject, 5)
            .start(5);

        const result = state.results.find((r) => r.name === "check");
        assert(result.status === CTGTestResult.STATUS.PASS, "positive subject not skipped");
    });

    // ── Skip Does Not Affect Other Steps ────────────────────────

    await test("skip: only affects targeted step", async () => {
        const state = await CTGTest.init("skip scope")
            .skip("skip second", "second")
            .assert("first", (state) => state.subject, 5)
            .assert("second", (state) => state.subject, 99)
            .assert("third", (state) => state.subject, 5)
            .start(5, { haltOnFailure: false });

        const first = state.results.find((r) => r.name === "first");
        const second = state.results.find((r) => r.name === "second");
        const third = state.results.find((r) => r.name === "third");
        assert(first.status === CTGTestResult.STATUS.PASS, "first ran");
        assert(second.status === CTGTestResult.STATUS.SKIP, "second skipped");
        assert(third.status === CTGTestResult.STATUS.PASS, "third ran");
    });

    // ── Ordering Rules ──────────────────────────────────────────

    await test("skip: target must exist, fails validation otherwise", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad target")
                .skip("skip ghost", "nonexistent")
                .assert("check", (state) => state.subject, 5)
                .start(1);
        } catch {
            threw = true;
        }
        assert(threw, "nonexistent target threw");
    });

    await test("skip: duplicate skip for same target fails validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("duplicate skip")
                .skip("first skip", "check")
                .skip("second skip", "check")
                .assert("check", (state) => state.subject, 5)
                .start(1);
        } catch {
            threw = true;
        }
        assert(threw, "duplicate skip threw");
    });

    await test("skip: must appear before target in pipeline", async () => {
        let threw = false;
        try {
            await CTGTest.init("skip after target")
                .assert("check", (state) => state.subject, 5)
                .skip("late skip", "check")
                .start(1);
        } catch {
            threw = true;
        }
        assert(threw, "skip after target threw");
    });

    // ── Skip Predicate Error ──────────────────────────────────

    await test("skip: predicate error records error result and does not skip target", async () => {
        const state = await CTGTest.init("skip error")
            .skip("bad skip", "check", () => { throw new Error("predicate boom"); })
            .assert("check", (state) => state.subject, 5)
            .start(5, { haltOnFailure: false });

        const skipResult = state.results.find((r) => r.name === "bad skip");
        const checkResult = state.results.find((r) => r.name === "check");
        assert(skipResult.status === CTGTestResult.STATUS.ERROR, "skip error recorded");
        assert(skipResult.type === "stage", "error result type is stage, not skip");
        assert(skipResult.message.includes("predicate boom"), "error message present");
        assert(checkResult.status === CTGTestResult.STATUS.PASS, "target was not skipped");
    });

    await test("skip: predicate error halts when haltOnFailure true", async () => {
        const state = await CTGTest.init("skip error halt")
            .skip("bad skip", "check", () => { throw new Error("boom"); })
            .assert("check", (state) => state.subject, 5)
            .start(5, { haltOnFailure: true });

        assert(state.results.length === 1, "halted after skip error");
        assert(state.results[0].status === CTGTestResult.STATUS.ERROR, "error recorded");
    });

    // ── Skip Scoping ────────────────────────────────────────────

    await test("skip: cannot target step inside chained pipeline", async () => {
        const inner = CTGTest.init("inner")
            .assert("inner check", (state) => state.subject, 5);

        let threw = false;
        try {
            await CTGTest.init("cross-chain skip")
                .skip("skip inner", "inner check")
                .chain("inner", inner)
                .start(5);
        } catch {
            threw = true;
        }
        assert(threw, "cross-chain skip threw");
    });
}
