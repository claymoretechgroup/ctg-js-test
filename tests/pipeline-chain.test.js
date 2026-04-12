import { describe, it, expect } from "vitest";
import CTGTest from "../src/CTGTest.js";
import CTGTestPredicate from "../src/CTGTestPredicate.js";
import CTGTestPredicates from "../src/CTGTestPredicates.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md sections 2.5, 4.3, Appendix A
// realizes: Core Semantics > Procedures > CHAIN
// realizes: Core Semantics > Procedures > START (chain execution path)

const { STATUS } = CTGTestResult;

// ---------------------------------------------------------------------------
// 1. Result label prepending
// ---------------------------------------------------------------------------

describe("chain label prepending", () => {

    it("prepends chain label to child stage result labels", async () => {
        const inner = CTGTest.init("inner")
            .stage("step-a", (state) => state.subject + 1);

        const outer = CTGTest.init("outer-pipeline")
            .chain("wrapper", inner);

        const state = await outer.start(10);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].label).toEqual(["wrapper", "step-a"]);
    });

    it("prepends chain label to child assert result labels", async () => {
        const inner = CTGTest.init("inner")
            .assert("check", (state) => state.subject, CTGTestPredicates.equals(10));

        const outer = CTGTest.init("pipeline")
            .chain("validate", inner);

        const state = await outer.start(10);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].label).toEqual(["validate", "check"]);
    });

    it("prepends chain label to multiple child results", async () => {
        const inner = CTGTest.init("inner")
            .stage("first", (state) => state.subject)
            .stage("second", (state) => state.subject);

        const outer = CTGTest.init("pipeline")
            .chain("group", inner);

        const state = await outer.start(42);
        expect(state.results).toHaveLength(2);
        expect(state.results[0].label).toEqual(["group", "first"]);
        expect(state.results[1].label).toEqual(["group", "second"]);
    });

    it("stacks labels through nested chains", async () => {
        const deepest = CTGTest.init("deepest")
            .stage("step", (state) => state.subject);

        const middle = CTGTest.init("middle")
            .chain("inner", deepest);

        const outer = CTGTest.init("pipeline")
            .chain("outer", middle);

        const state = await outer.start(1);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].label).toEqual(["outer", "inner", "step"]);
    });

    it("preserves labels for operations before and after a chain", async () => {
        const inner = CTGTest.init("inner")
            .stage("chained-step", (state) => state.subject * 2);

        const pipeline = CTGTest.init("pipeline")
            .stage("before", (state) => state.subject + 1)
            .chain("middle", inner)
            .stage("after", (state) => state.subject + 10);

        const state = await pipeline.start(5);
        expect(state.results).toHaveLength(3);
        expect(state.results[0].label).toEqual(["before"]);
        expect(state.results[1].label).toEqual(["middle", "chained-step"]);
        expect(state.results[2].label).toEqual(["after"]);
    });
});

// ---------------------------------------------------------------------------
// 2. Same-state semantics
// ---------------------------------------------------------------------------

describe("chain same-state semantics", () => {

    it("subject mutation in chain is visible to outer pipeline", async () => {
        const inner = CTGTest.init("inner")
            .stage("multiply", (state) => state.subject * 3);

        const pipeline = CTGTest.init("pipeline")
            .stage("set", () => 10)
            .chain("transform", inner)
            .assert("verify", (state) => state.subject, CTGTestPredicates.equals(30));

        const state = await pipeline.start(0);
        const verifyResult = state.results[2];
        expect(verifyResult.status).toBe(STATUS.PASS);
        expect(verifyResult.computedValue).toBe(30);
    });

    it("subject mutation before chain is visible inside chain", async () => {
        const inner = CTGTest.init("inner")
            .assert("check", (state) => state.subject, CTGTestPredicates.equals(99));

        const pipeline = CTGTest.init("pipeline")
            .stage("set-subject", () => 99)
            .chain("verify", inner);

        const state = await pipeline.start(0);
        expect(state.results[1].status).toBe(STATUS.PASS);
    });

    it("nested chain mutations propagate outward", async () => {
        const deep = CTGTest.init("deep")
            .stage("set-deep", () => "deep-value");

        const mid = CTGTest.init("mid")
            .chain("deep-chain", deep);

        const pipeline = CTGTest.init("pipeline")
            .chain("mid-chain", mid)
            .assert("check-outer", (state) => state.subject, CTGTestPredicates.equals("deep-value"));

        const state = await pipeline.start("initial");
        expect(state.results[1].status).toBe(STATUS.PASS);
    });
});

// ---------------------------------------------------------------------------
// 3. No self-result
// ---------------------------------------------------------------------------

describe("chain does not produce its own result entry", () => {

    it("chain with one child produces exactly one result", async () => {
        const inner = CTGTest.init("inner")
            .stage("only-step", (state) => state.subject);

        const pipeline = CTGTest.init("pipeline")
            .chain("wrapper", inner);

        const state = await pipeline.start(1);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].label).toEqual(["wrapper", "only-step"]);
    });

    it("chain with no operations produces zero results", async () => {
        const empty = CTGTest.init("empty");

        const pipeline = CTGTest.init("pipeline")
            .chain("no-ops", empty);

        const state = await pipeline.start(1);
        expect(state.results).toHaveLength(0);
    });

    it("chain with two children produces exactly two results", async () => {
        const inner = CTGTest.init("inner")
            .stage("a", (state) => state.subject)
            .stage("b", (state) => state.subject);

        const pipeline = CTGTest.init("pipeline")
            .chain("group", inner);

        const state = await pipeline.start(1);
        expect(state.results).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// 4. haltOnFailure propagation
// ---------------------------------------------------------------------------

describe("chain haltOnFailure propagation", () => {

    it("failure in chain halts outer pipeline when haltOnFailure is true", async () => {
        const inner = CTGTest.init("inner")
            .assert("fail-here", (state) => state.subject, CTGTestPredicates.equals("wrong"));

        const pipeline = CTGTest.init("pipeline")
            .chain("failing-chain", inner)
            .stage("should-not-run", (state) => state.subject);

        const state = await pipeline.start("actual", { haltOnFailure: true });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
        expect(state.results[0].label).toEqual(["failing-chain", "fail-here"]);
    });

    it("failure in chain does not halt outer when haltOnFailure is false", async () => {
        const inner = CTGTest.init("inner")
            .assert("fail-here", (state) => state.subject, CTGTestPredicates.equals("wrong"));

        const pipeline = CTGTest.init("pipeline")
            .chain("failing-chain", inner)
            .stage("should-run", (state) => state.subject);

        const state = await pipeline.start("actual", { haltOnFailure: false });
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.FAIL);
        expect(state.results[1].status).toBe(STATUS.PASS);
    });

    it("error in chain halts outer pipeline when haltOnFailure is true", async () => {
        const inner = CTGTest.init("inner")
            .stage("blow-up", () => { throw new Error("boom"); });

        const pipeline = CTGTest.init("pipeline")
            .chain("error-chain", inner)
            .stage("should-not-run", (state) => state.subject);

        const state = await pipeline.start(1, { haltOnFailure: true });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.ERROR);
        expect(state.results[0].label).toEqual(["error-chain", "blow-up"]);
    });

    it("failure in nested chain halts all levels when haltOnFailure is true", async () => {
        const deep = CTGTest.init("deep")
            .assert("fail", (state) => state.subject, CTGTestPredicates.equals("nope"));

        const mid = CTGTest.init("mid")
            .chain("deep-chain", deep)
            .stage("mid-after", (state) => state.subject);

        const pipeline = CTGTest.init("pipeline")
            .chain("mid-chain", mid)
            .stage("outer-after", (state) => state.subject);

        const state = await pipeline.start("value", { haltOnFailure: true });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
        expect(state.results[0].label).toEqual(["mid-chain", "deep-chain", "fail"]);
    });
});

// ---------------------------------------------------------------------------
// 5. Config sharing
// ---------------------------------------------------------------------------

describe("chain config sharing", () => {

    it("inner pipeline uses same haltOnFailure setting as outer", async () => {
        const inner = CTGTest.init("inner")
            .assert("fail-1", (state) => state.subject, CTGTestPredicates.equals("wrong"))
            .assert("fail-2", (state) => state.subject, CTGTestPredicates.equals("also-wrong"));

        const pipeline = CTGTest.init("pipeline")
            .chain("group", inner);

        // haltOnFailure: false — both inner asserts should run
        const state = await pipeline.start("actual", { haltOnFailure: false });
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.FAIL);
        expect(state.results[1].status).toBe(STATUS.FAIL);
    });

    it("inner pipeline halts on first failure when haltOnFailure is true", async () => {
        const inner = CTGTest.init("inner")
            .assert("fail-1", (state) => state.subject, CTGTestPredicates.equals("wrong"))
            .assert("fail-2", (state) => state.subject, CTGTestPredicates.equals("also-wrong"));

        const pipeline = CTGTest.init("pipeline")
            .chain("group", inner);

        // haltOnFailure: true — only first inner assert should run
        const state = await pipeline.start("actual", { haltOnFailure: true });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
        expect(state.results[0].label).toEqual(["group", "fail-1"]);
    });
});

// ---------------------------------------------------------------------------
// 6. Validation — non-CTGTest target
// ---------------------------------------------------------------------------

describe("chain validation — INVALID_CHAIN", () => {

    it("rejects a plain object as chain target", async () => {
        const pipeline = CTGTest.init("pipeline")
            .chain("bad", {});

        await expect(pipeline.start(1)).rejects.toThrow();
        try {
            await pipeline.start(1);
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_CHAIN");
            expect(err.code).toBe(1001);
            expect(err.data.label).toBe("bad");
        }
    });

    it("rejects a function as chain target", async () => {
        const pipeline = CTGTest.init("pipeline")
            .chain("bad", () => {});

        await expect(pipeline.start(1)).rejects.toThrow();
        try {
            await pipeline.start(1);
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_CHAIN");
            expect(err.code).toBe(1001);
        }
    });

    it("rejects null as chain target", async () => {
        const pipeline = CTGTest.init("pipeline")
            .chain("bad", null);

        await expect(pipeline.start(1)).rejects.toThrow();
        try {
            await pipeline.start(1);
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_CHAIN");
            expect(err.code).toBe(1001);
        }
    });

    it("rejects a string as chain target", async () => {
        const pipeline = CTGTest.init("pipeline")
            .chain("bad", "not-a-pipeline");

        await expect(pipeline.start(1)).rejects.toThrow();
        try {
            await pipeline.start(1);
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_CHAIN");
            expect(err.code).toBe(1001);
        }
    });

    it("data includes the label and typeof the invalid target", async () => {
        const pipeline = CTGTest.init("pipeline")
            .chain("bad-chain", 42);

        try {
            await pipeline.start(1);
        } catch (err) {
            expect(err.data.label).toBe("bad-chain");
            expect(err.data.got).toBe("number");
        }
    });
});

// ---------------------------------------------------------------------------
// 7. Chain depth limit
// ---------------------------------------------------------------------------

describe("chain depth limit — CHAIN_DEPTH_EXCEEDED", () => {

    it("rejects chain nesting beyond MAX_CHAIN_DEPTH (64)", async () => {
        // Build a chain 65 levels deep (0-indexed depth 64 exceeds limit)
        let current = CTGTest.init("leaf")
            .stage("leaf-step", (state) => state.subject);

        for (let i = 0; i < 65; i++) {
            const wrapper = CTGTest.init(`level-${i}`)
                .chain(`chain-${i}`, current);
            current = wrapper;
        }

        await expect(current.start(1)).rejects.toThrow();
        try {
            await current.start(1);
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("CHAIN_DEPTH_EXCEEDED");
            expect(err.code).toBe(1100);
        }
    });

    it("allows chain nesting at exactly MAX_CHAIN_DEPTH", async () => {
        // Build a chain exactly 64 levels deep (should be allowed)
        let current = CTGTest.init("leaf")
            .stage("leaf-step", (state) => state.subject);

        for (let i = 0; i < 64; i++) {
            const wrapper = CTGTest.init(`level-${i}`)
                .chain(`chain-${i}`, current);
            current = wrapper;
        }

        // Should not throw — exactly at the limit
        const state = await current.start(1);
        expect(state.results.length).toBeGreaterThan(0);
    });

    it("data includes depth and max fields", async () => {
        let current = CTGTest.init("leaf")
            .stage("leaf-step", (state) => state.subject);

        for (let i = 0; i < 65; i++) {
            const wrapper = CTGTest.init(`level-${i}`)
                .chain(`chain-${i}`, current);
            current = wrapper;
        }

        try {
            await current.start(1);
        } catch (err) {
            expect(err.data.max).toBe(64);
            expect(typeof err.data.depth).toBe("number");
            expect(err.data.depth).toBeGreaterThan(64);
        }
    });
});

// ---------------------------------------------------------------------------
// 8. Skipped chain
// ---------------------------------------------------------------------------

describe("skipped chain", () => {

    it("produces a single skippedResult with chain label", async () => {
        const inner = CTGTest.init("inner")
            .stage("step-a", (state) => state.subject)
            .stage("step-b", (state) => state.subject);

        const pipeline = CTGTest.init("pipeline")
            .chain("skippable", inner)
            .skip("skippable");

        const state = await pipeline.start(1);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].skipped).toBe(true);
        expect(state.results[0].label).toEqual(["skippable"]);
        expect(state.results[0].status).toBeUndefined();
    });

    it("skipped chain does not run child operations", async () => {
        let childRan = false;
        const inner = CTGTest.init("inner")
            .stage("side-effect", () => {
                childRan = true;
                return 1;
            });

        const pipeline = CTGTest.init("pipeline")
            .chain("skipped-chain", inner)
            .skip("skipped-chain");

        await pipeline.start(1);
        expect(childRan).toBe(false);
    });

    it("conditional skip on chain — condition true skips", async () => {
        const inner = CTGTest.init("inner")
            .stage("step", (state) => state.subject);

        const pipeline = CTGTest.init("pipeline")
            .chain("conditional", inner)
            .skip("conditional", (state) => state.subject > 5);

        const state = await pipeline.start(10);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].skipped).toBe(true);
        expect(state.results[0].label).toEqual(["conditional"]);
    });

    it("conditional skip on chain — condition false runs chain", async () => {
        const inner = CTGTest.init("inner")
            .stage("step", (state) => state.subject * 2);

        const pipeline = CTGTest.init("pipeline")
            .chain("conditional", inner)
            .skip("conditional", (state) => state.subject > 100);

        const state = await pipeline.start(5);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].skipped).toBe(false);
        expect(state.results[0].label).toEqual(["conditional", "step"]);
        expect(state.results[0].status).toBe(STATUS.PASS);
    });
});
