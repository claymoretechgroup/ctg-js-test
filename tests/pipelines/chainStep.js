// ChainStep tests — §2 Composition
//
// Chain inlines another pipeline's steps, threading the subject through.
// Results are nested. Outer config and prior results are preserved.

import CTGTest from "../../src/CTGTest.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Basic Composition ───────────────────────────────────────

    await test("chain: inlines another pipeline's steps", async () => {
        const inner = CTGTest.init("inner")
            .stage("add 1", (state) => { state.subject = state.subject + 1; return state; });

        const state = await CTGTest.init("outer")
            .chain("use inner", inner)
            .start(5);

        assert(state.subject === 6, "inner step applied");
    });

    // ── Subject Threading ───────────────────────────────────────

    await test("chain: subject threads from outer to inner to outer", async () => {
        const inner = CTGTest.init("inner")
            .stage("double", (state) => { state.subject = state.subject * 2; return state; });

        const state = await CTGTest.init("outer")
            .stage("add 1", (state) => { state.subject = state.subject + 1; return state; })
            .chain("double it", inner)
            .assert("check", (state) => state.subject, 12)
            .start(5);

        assert(state.subject === 12, "(5 + 1) * 2 = 12");
        assert(state.status === "pass", "pipeline passes");
    });

    // ── Results Nesting ─────────────────────────────────────────

    await test("chain: results are nested under chain entry", async () => {
        const inner = CTGTest.init("inner")
            .stage("noop", (state) => state);

        const state = await CTGTest.init("outer")
            .stage("setup", (state) => state)
            .chain("nested", inner)
            .start(1);

        // Outer should have: setup result + chain result
        assert(state.results.length === 2, "two top-level results");
        const chainResult = state.results[1];
        assert(chainResult.name === "nested", "chain result named");
        assert(Array.isArray(chainResult.steps), "chain has nested steps");
    });

    // ── Outer State Preserved ───────────────────────────────────

    await test("chain: outer results preserved before chain", async () => {
        const inner = CTGTest.init("inner")
            .stage("inner work", (state) => state);

        const state = await CTGTest.init("outer")
            .stage("before", (state) => state)
            .chain("middle", inner)
            .stage("after", (state) => state)
            .start(1);

        assert(state.results.length === 3, "before + chain + after");
        assert(state.results[0].name === "before", "first is before");
        assert(state.results[2].name === "after", "last is after");
    });

    // ── Chain Failure ───────────────────────────────────────────

    await test("chain: inner failure produces chain failure", async () => {
        const inner = CTGTest.init("inner")
            .assert("bad", (state) => state.subject, 99);

        const state = await CTGTest.init("outer")
            .chain("failing chain", inner)
            .start(5, { haltOnFailure: false });

        const chainResult = state.results[0];
        assert(chainResult.status === "fail", "chain reports failure");
    });

    // ── Validation ──────────────────────────────────────────────

    await test("chain: non-CTGTest target fails validation", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad chain")
                .chain("not a pipeline", "hello")
                .start(1);
        } catch {
            threw = true;
        }
        assert(threw, "non-CTGTest threw");
    });
}
