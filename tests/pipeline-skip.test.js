import { describe, it, expect } from "vitest";
import CTGTest from "../src/CTGTest.js";
import CTGTestPredicate from "../src/CTGTestPredicate.js";
import CTGTestPredicates from "../src/CTGTestPredicates.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md sections 2.5, 4.3, Appendix A, Q3, Q5, Q6, Q7
// realizes: Core Semantics > Procedures > SKIP

const STATUS = CTGTestResult.STATUS;

describe("pipeline skip", () => {

    // ---------------------------------------------------------------
    // 1. Unconditional skip — target bypassed, skippedResult recorded
    // ---------------------------------------------------------------

    describe("unconditional skip", () => {

        it("skips a stage when no condition is provided", async () => {
            const state = await CTGTest.init("unconditional skip stage")
                .stage("first", (state) => state.subject + 1)
                .skip("second")
                .stage("second", (state) => state.subject * 10)
                .stage("third", (state) => state.subject + 100)
                .start(1);

            // "second" was skipped, so subject went 1 -> 2 -> 2 (skipped) -> 102
            expect(state.subject).toBe(102);
            expect(state.results).toHaveLength(3);

            // first ran normally
            expect(state.results[0].label).toEqual(["first"]);
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.results[0].skipped).toBe(false);

            // second was skipped
            expect(state.results[1].label).toEqual(["second"]);
            expect(state.results[1].skipped).toBe(true);
            expect(state.results[1].status).toBe(undefined);

            // third ran normally
            expect(state.results[2].label).toEqual(["third"]);
            expect(state.results[2].status).toBe(STATUS.PASS);
            expect(state.results[2].skipped).toBe(false);
        });

        it("skips an assert when no condition is provided", async () => {
            const state = await CTGTest.init("unconditional skip assert")
                .skip("check value")
                .assert("check value", (state) => state.subject, CTGTestPredicates.equals(99))
                .start(1);

            expect(state.results).toHaveLength(1);
            expect(state.results[0].label).toEqual(["check value"]);
            expect(state.results[0].skipped).toBe(true);
            expect(state.results[0].status).toBe(undefined);
        });

        it("skipped result has undefined computedValue and expectedOutcome", async () => {
            const state = await CTGTest.init("skipped result fields")
                .skip("skipped assert")
                .assert("skipped assert", (state) => state.subject, CTGTestPredicates.equals(1))
                .start(1);

            const result = state.results[0];
            expect(result.skipped).toBe(true);
            expect(result.computedValue).toBe(undefined);
            expect(result.expectedOutcome).toBe(undefined);
            expect(result.error).toBe(undefined);
        });
    });

    // ---------------------------------------------------------------
    // 2. Conditional skip true — target skipped
    // ---------------------------------------------------------------

    describe("conditional skip — condition returns true", () => {

        it("skips target when condition returns true", async () => {
            const state = await CTGTest.init("conditional skip true")
                .skip("expensive", () => true)
                .stage("expensive", (state) => state.subject * 1000)
                .start(5);

            expect(state.subject).toBe(5);
            expect(state.results).toHaveLength(1);
            expect(state.results[0].skipped).toBe(true);
            expect(state.results[0].label).toEqual(["expensive"]);
        });
    });

    // ---------------------------------------------------------------
    // 3. Conditional skip false — target runs normally
    // ---------------------------------------------------------------

    describe("conditional skip — condition returns false", () => {

        it("runs target when condition returns false", async () => {
            const state = await CTGTest.init("conditional skip false")
                .skip("compute", () => false)
                .stage("compute", (state) => state.subject * 10)
                .start(3);

            expect(state.subject).toBe(30);
            expect(state.results).toHaveLength(1);
            expect(state.results[0].label).toEqual(["compute"]);
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.results[0].skipped).toBe(false);
        });

        it("runs assert normally when condition returns false", async () => {
            const state = await CTGTest.init("conditional skip false assert")
                .skip("check", () => false)
                .assert("check", (state) => state.subject, CTGTestPredicates.equals(7))
                .start(7);

            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.results[0].skipped).toBe(false);
        });
    });

    // ---------------------------------------------------------------
    // 4. Condition sees current state (mutations from earlier stages)
    // ---------------------------------------------------------------

    describe("condition sees current state", () => {

        it("condition receives state with mutations from prior stages", async () => {
            const state = await CTGTest.init("condition sees state")
                .stage("double", (state) => state.subject * 2)
                .skip("maybe skip", (state) => state.subject > 5)
                .stage("maybe skip", (state) => state.subject + 100)
                .start(3);

            // 3 * 2 = 6, condition sees subject=6, 6 > 5 = true, so "maybe skip" is skipped
            expect(state.subject).toBe(6);
            expect(state.results).toHaveLength(2);
            expect(state.results[1].skipped).toBe(true);
        });

        it("condition runs when subject is below threshold", async () => {
            const state = await CTGTest.init("condition sees state below")
                .stage("double", (state) => state.subject * 2)
                .skip("maybe skip", (state) => state.subject > 5)
                .stage("maybe skip", (state) => state.subject + 100)
                .start(2);

            // 2 * 2 = 4, condition sees subject=4, 4 > 5 = false, so "maybe skip" runs
            expect(state.subject).toBe(104);
            expect(state.results).toHaveLength(2);
            expect(state.results[1].skipped).toBe(false);
            expect(state.results[1].status).toBe(STATUS.PASS);
        });
    });

    // ---------------------------------------------------------------
    // 5. Skip produces no result of its own
    // ---------------------------------------------------------------

    describe("skip produces no result entry", () => {

        it("unconditional skip adds only the target's skipped result", async () => {
            const state = await CTGTest.init("no skip result")
                .stage("first", (state) => state.subject)
                .skip("second")
                .stage("second", (state) => state.subject)
                .stage("third", (state) => state.subject)
                .start(1);

            // 3 operations (first, second, third) — skip is not an operation result
            expect(state.results).toHaveLength(3);
            const labels = state.results.map((r) => r.label[0]);
            expect(labels).toEqual(["first", "second", "third"]);
        });

        it("conditional skip that fires adds only the target's skipped result", async () => {
            const state = await CTGTest.init("conditional no skip result")
                .skip("target", () => true)
                .stage("target", (state) => state.subject)
                .start(1);

            expect(state.results).toHaveLength(1);
            expect(state.results[0].label).toEqual(["target"]);
            expect(state.results[0].skipped).toBe(true);
        });

        it("conditional skip that does not fire produces no extra result", async () => {
            const state = await CTGTest.init("conditional no extra result")
                .skip("target", () => false)
                .stage("target", (state) => state.subject)
                .start(1);

            expect(state.results).toHaveLength(1);
            expect(state.results[0].label).toEqual(["target"]);
            expect(state.results[0].skipped).toBe(false);
        });
    });

    // ---------------------------------------------------------------
    // 6. Skip condition error -> ERROR result for target
    // ---------------------------------------------------------------

    describe("skip condition throws", () => {

        it("records ERROR result for the target operation", async () => {
            const conditionError = new Error("condition broke");

            const state = await CTGTest.init("condition error")
                .skip("target stage", () => { throw conditionError; })
                .stage("target stage", (state) => state.subject)
                .start(1, { haltOnFailure: false });

            expect(state.results).toHaveLength(1);
            const result = state.results[0];
            expect(result.label).toEqual(["target stage"]);
            expect(result.status).toBe(STATUS.ERROR);
            expect(result.error).toBe(conditionError);
            expect(result.skipped).toBe(false);
        });

        it("target does not run when condition throws", async () => {
            let targetRan = false;

            const state = await CTGTest.init("target not run on error")
                .skip("guarded", () => { throw new Error("boom"); })
                .stage("guarded", () => {
                    targetRan = true;
                    return 999;
                })
                .start(1, { haltOnFailure: false });

            expect(targetRan).toBe(false);
            expect(state.subject).toBe(1);
        });

        it("ERROR result has the target label, not a skip label", async () => {
            const state = await CTGTest.init("error label check")
                .skip("my target", () => { throw new Error("oops"); })
                .stage("my target", (state) => state.subject)
                .start(1, { haltOnFailure: false });

            expect(state.results[0].label).toEqual(["my target"]);
        });
    });

    // ---------------------------------------------------------------
    // 7. No ordering constraint — skip after target in builder sequence
    // ---------------------------------------------------------------

    describe("no ordering constraint", () => {

        it("skip registered after target in builder order still works", async () => {
            const state = await CTGTest.init("skip after target")
                .stage("target op", (state) => state.subject * 10)
                .skip("target op")
                .start(5);

            expect(state.subject).toBe(5);
            expect(state.results).toHaveLength(1);
            expect(state.results[0].label).toEqual(["target op"]);
            expect(state.results[0].skipped).toBe(true);
        });

        it("skip between two stages still targets the correct one", async () => {
            const state = await CTGTest.init("skip between stages")
                .stage("first", (state) => state.subject + 1)
                .skip("second")
                .stage("second", (state) => state.subject * 100)
                .stage("third", (state) => state.subject + 10)
                .start(0);

            // 0 -> 1 -> skipped -> 11
            expect(state.subject).toBe(11);
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.results[1].skipped).toBe(true);
            expect(state.results[2].status).toBe(STATUS.PASS);
        });
    });

    // ---------------------------------------------------------------
    // 8. Skipped chain — single skippedResult, no child results
    // ---------------------------------------------------------------

    describe("skipped chain", () => {

        it("skipped chain produces a single skippedResult with chain label", async () => {
            const sub = CTGTest.init("sub pipeline")
                .stage("inner stage", (state) => state.subject + 1)
                .assert("inner check", (state) => state.subject, CTGTestPredicates.equals(2));

            const state = await CTGTest.init("skip chain test")
                .skip("chained")
                .chain("chained", sub)
                .start(1);

            expect(state.results).toHaveLength(1);
            expect(state.results[0].label).toEqual(["chained"]);
            expect(state.results[0].skipped).toBe(true);
            expect(state.results[0].status).toBe(undefined);
        });

        it("skipped chain does not run sub-pipeline operations", async () => {
            let innerRan = false;
            const sub = CTGTest.init("sub")
                .stage("inner", () => {
                    innerRan = true;
                    return 42;
                });

            const state = await CTGTest.init("skip chain no run")
                .skip("chained")
                .chain("chained", sub)
                .start(1);

            expect(innerRan).toBe(false);
            expect(state.subject).toBe(1);
        });

        it("skipped chain produces no child results", async () => {
            const sub = CTGTest.init("sub")
                .stage("a", (state) => state.subject)
                .stage("b", (state) => state.subject)
                .stage("c", (state) => state.subject);

            const state = await CTGTest.init("no child results")
                .skip("chained")
                .chain("chained", sub)
                .start(1);

            // Only the single skippedResult for the chain, no inner results
            expect(state.results).toHaveLength(1);
            expect(state.results[0].skipped).toBe(true);
        });

        it("conditional skip on chain works", async () => {
            const sub = CTGTest.init("sub")
                .stage("inner", (state) => state.subject * 10);

            const state = await CTGTest.init("conditional chain skip")
                .stage("setup", (state) => state.subject + 1)
                .skip("chained", (state) => state.subject > 5)
                .chain("chained", sub)
                .start(10);

            // subject=10, setup: 11, 11 > 5 = true, chain skipped
            expect(state.subject).toBe(11);
            expect(state.results).toHaveLength(2);
            expect(state.results[1].label).toEqual(["chained"]);
            expect(state.results[1].skipped).toBe(true);
        });
    });

    // ---------------------------------------------------------------
    // 9. Validation errors
    // ---------------------------------------------------------------

    describe("validation errors", () => {

        it("throws INVALID_SKIP for missing target", async () => {
            const pipeline = CTGTest.init("missing target")
                .skip("nonexistent")
                .stage("actual", (state) => state.subject);

            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);

            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.type).toBe("INVALID_SKIP");
                expect(err.code).toBe(1004);
                expect(err.data.targetLabel).toBe("nonexistent");
            }
        });

        it("throws INVALID_SKIP for duplicate skip targeting the same operation", async () => {
            const pipeline = CTGTest.init("duplicate skip")
                .skip("target")
                .skip("target", () => true)
                .stage("target", (state) => state.subject);

            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);

            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.type).toBe("INVALID_SKIP");
                expect(err.code).toBe(1004);
                expect(err.data.targetLabel).toBe("target");
            }
        });

        it("throws INVALID_SKIP for non-callable condition", async () => {
            const pipeline = CTGTest.init("non-callable condition")
                .skip("target", "not a function")
                .stage("target", (state) => state.subject);

            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);

            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.type).toBe("INVALID_SKIP");
                expect(err.code).toBe(1004);
                expect(err.data.targetLabel).toBe("target");
                expect(err.data.got).toBe("string");
            }
        });

        it("throws INVALID_SKIP for empty target label", async () => {
            const pipeline = CTGTest.init("empty target label")
                .skip("")
                .stage("actual", (state) => state.subject);

            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);

            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.type).toBe("INVALID_SKIP");
                expect(err.code).toBe(1004);
                expect(err.data.targetLabel).toBe("");
            }
        });

        it("throws INVALID_SKIP for whitespace-only target label", async () => {
            const pipeline = CTGTest.init("whitespace target label")
                .skip("   ")
                .stage("actual", (state) => state.subject);

            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);

            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.type).toBe("INVALID_SKIP");
                expect(err.code).toBe(1004);
            }
        });

        it("null condition is valid (unconditional skip)", async () => {
            const state = await CTGTest.init("null condition ok")
                .skip("target", null)
                .stage("target", (state) => state.subject)
                .start(1);

            expect(state.results).toHaveLength(1);
            expect(state.results[0].skipped).toBe(true);
        });

        it("undefined condition is valid (unconditional skip)", async () => {
            const state = await CTGTest.init("undefined condition ok")
                .skip("target", undefined)
                .stage("target", (state) => state.subject)
                .start(1);

            expect(state.results).toHaveLength(1);
            expect(state.results[0].skipped).toBe(true);
        });

        it("skips do not participate in label uniqueness namespace", async () => {
            // Two stages with different labels, both targeted by skips — no conflict
            const state = await CTGTest.init("skip label namespace")
                .skip("stage a")
                .skip("stage b")
                .stage("stage a", (state) => state.subject)
                .stage("stage b", (state) => state.subject)
                .start(1);

            expect(state.results).toHaveLength(2);
            expect(state.results[0].skipped).toBe(true);
            expect(state.results[1].skipped).toBe(true);
        });
    });

    // ---------------------------------------------------------------
    // 10. haltOnFailure after skip condition error
    // ---------------------------------------------------------------

    describe("haltOnFailure after skip condition error", () => {

        it("halts execution when haltOnFailure is true and condition throws", async () => {
            let thirdRan = false;

            const state = await CTGTest.init("halt on condition error")
                .skip("target", () => { throw new Error("condition failed"); })
                .stage("target", (state) => state.subject)
                .stage("after target", () => {
                    thirdRan = true;
                    return 99;
                })
                .start(1, { haltOnFailure: true });

            expect(thirdRan).toBe(false);
            expect(state.results).toHaveLength(1);
            expect(state.results[0].label).toEqual(["target"]);
            expect(state.results[0].status).toBe(STATUS.ERROR);
        });

        it("continues execution when haltOnFailure is false and condition throws", async () => {
            let thirdRan = false;

            const state = await CTGTest.init("continue on condition error")
                .skip("target", () => { throw new Error("condition failed"); })
                .stage("target", (state) => state.subject)
                .stage("after target", () => {
                    thirdRan = true;
                    return 99;
                })
                .start(1, { haltOnFailure: false });

            expect(thirdRan).toBe(true);
            expect(state.results).toHaveLength(2);
            expect(state.results[0].status).toBe(STATUS.ERROR);
            expect(state.results[1].status).toBe(STATUS.PASS);
        });
    });

    // ── 11. Pipeline-Local Skip Scope ─────────────────────────────────

    describe("skip scope is pipeline-local", () => {

        it("outer skip cannot target a step inside a chained sub-pipeline", async () => {
            const inner = CTGTest.init("inner")
                .stage("inner step", (s) => s.subject + 1);

            // "inner step" exists in the inner pipeline, not the outer.
            // The outer skip targets "inner step" which should fail validation
            // because the target doesn't exist in the outer pipeline's namespace.
            const pipeline = CTGTest.init("outer")
                .skip("inner step", () => true)
                .chain("sub", inner);

            await expect(pipeline.start(1)).rejects.toThrow();
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.type).toBe("INVALID_SKIP");
                expect(err.code).toBe(1004);
            }
        });

        it("inner skip cannot target a step in the outer pipeline", async () => {
            // "outer step" exists in the outer pipeline, not the inner.
            const inner = CTGTest.init("inner")
                .skip("outer step", () => true)
                .stage("inner stage", (s) => s.subject);

            const pipeline = CTGTest.init("outer")
                .stage("outer step", (s) => s.subject)
                .chain("sub", inner);

            // Inner pipeline validation should fail — "outer step" not found
            await expect(pipeline.start(1)).rejects.toThrow();
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.type).toBe("INVALID_SKIP");
                expect(err.code).toBe(1004);
            }
        });

        it("same label in outer and inner pipelines are independent namespaces", async () => {
            // Both pipelines have a step called "check", but they're separate.
            // Outer skip targets outer "check", inner "check" runs unaffected.
            const inner = CTGTest.init("inner")
                .assert("check", (s) => s.subject, equals(10));

            const state = await CTGTest.init("outer")
                .stage("setup", () => 10)
                .skip("check", () => true)
                .assert("check", (s) => s.subject, equals(10))
                .chain("sub", inner)
                .start(5, { haltOnFailure: false });

            // Outer "check" is skipped, inner "check" runs and passes
            const outerCheck = state.results.find(
                r => r.label.length === 1 && r.label[0] === "check"
            );
            const innerCheck = state.results.find(
                r => r.label.length === 2 && r.label[1] === "check"
            );
            expect(outerCheck.skipped).toBe(true);
            expect(innerCheck.skipped).toBe(false);
            expect(innerCheck.status).toBe(STATUS.PASS);
        });
    });
});
