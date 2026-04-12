import { describe, it, expect } from "vitest";
import CTGTest from "../src/CTGTest.js";
import CTGTestState from "../src/CTGTestState.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md sections 2.5, 4.3, Appendix A — stage operation behavior
// realizes: Core Semantics > Procedures > STAGE
// realizes: Core Semantics > Procedures > START

const STATUS = CTGTestResult.STATUS;

describe("CTGTest stage operation", () => {

    describe("builder method", () => {

        it("returns the pipeline instance for chaining", () => {
            const pipeline = CTGTest.init("builder test");
            const result = pipeline.stage("step", (state) => state.subject);
            expect(result).toBe(pipeline);
        });

        it("supports chaining multiple stage calls", () => {
            const pipeline = CTGTest.init("chain test")
                .stage("first", (state) => state.subject + 1)
                .stage("second", (state) => state.subject + 2)
                .stage("third", (state) => state.subject + 3);
            expect(pipeline).toBeInstanceOf(CTGTest);
        });
    });

    describe("execution basics", () => {

        it("transforms the subject via handler return value", async () => {
            const state = await CTGTest.init("transform")
                .stage("double", (state) => state.subject * 2)
                .start(5);
            expect(state.subject).toBe(10);
        });

        it("runs multiple stages in sequence", async () => {
            const state = await CTGTest.init("sequence")
                .stage("add one", (state) => state.subject + 1)
                .stage("multiply by three", (state) => state.subject * 3)
                .start(2);
            // (2 + 1) * 3 = 9
            expect(state.subject).toBe(9);
        });

        it("supports async handlers", async () => {
            const state = await CTGTest.init("async stage")
                .stage("async double", async (state) => {
                    return state.subject * 2;
                })
                .start(7);
            expect(state.subject).toBe(14);
        });

        it("handler receives CTGTestState instance", async () => {
            let receivedState = null;
            await CTGTest.init("state check")
                .stage("capture", (state) => {
                    receivedState = state;
                    return state.subject;
                })
                .start(42);
            expect(receivedState).toBeInstanceOf(CTGTestState);
        });

        it("start returns a Promise that resolves to CTGTestState", async () => {
            const result = CTGTest.init("promise check")
                .stage("identity", (state) => state.subject)
                .start(1);
            expect(result).toBeInstanceOf(Promise);
            const state = await result;
            expect(state).toBeInstanceOf(CTGTestState);
        });
    });

    describe("result recording", () => {

        it("records a result with STATUS.PASS on success", async () => {
            const state = await CTGTest.init("pass result")
                .stage("do thing", (state) => state.subject + 1)
                .start(0);
            expect(state.results.length).toBe(1);
            expect(state.results[0].status).toBe(STATUS.PASS);
        });

        it("result label is an array with the step label", async () => {
            const state = await CTGTest.init("label check")
                .stage("my stage", (state) => state.subject)
                .start(1);
            expect(state.results[0].label).toEqual(["my stage"]);
        });

        it("computedValue is undefined for stage results", async () => {
            const state = await CTGTest.init("computed check")
                .stage("transform", (state) => state.subject + 1)
                .start(0);
            expect(state.results[0].computedValue).toBe(undefined);
        });

        it("expectedOutcome is undefined for stage results", async () => {
            const state = await CTGTest.init("expected check")
                .stage("transform", (state) => state.subject + 1)
                .start(0);
            expect(state.results[0].expectedOutcome).toBe(undefined);
        });

        it("error is undefined for passing stage results", async () => {
            const state = await CTGTest.init("error check")
                .stage("transform", (state) => state.subject)
                .start(1);
            expect(state.results[0].error).toBe(undefined);
        });

        it("records results for each stage in order", async () => {
            const state = await CTGTest.init("multi result")
                .stage("first", (state) => state.subject + 1)
                .stage("second", (state) => state.subject * 2)
                .start(0);
            expect(state.results.length).toBe(2);
            expect(state.results[0].label).toEqual(["first"]);
            expect(state.results[1].label).toEqual(["second"]);
        });

        it("result is a CTGTestResult instance", async () => {
            const state = await CTGTest.init("instance check")
                .stage("step", (state) => state.subject)
                .start(1);
            expect(state.results[0]).toBeInstanceOf(CTGTestResult);
        });
    });

    describe("error handling", () => {

        it("records STATUS.ERROR when handler throws", async () => {
            const state = await CTGTest.init("error stage")
                .stage("throws", () => {
                    throw new Error("stage failed");
                })
                .start(1);
            expect(state.results.length).toBe(1);
            expect(state.results[0].status).toBe(STATUS.ERROR);
        });

        it("populates error field with the caught exception", async () => {
            const thrown = new Error("kaboom");
            const state = await CTGTest.init("error capture")
                .stage("throws", () => { throw thrown; })
                .start(1);
            expect(state.results[0].error).toBe(thrown);
        });

        it("does not update subject when handler throws", async () => {
            const state = await CTGTest.init("no subject update")
                .stage("throws", () => {
                    throw new Error("no update");
                })
                .start(42);
            // Subject stays at initial value — handler threw before return
            expect(state.subject).toBe(42);
        });

        it("halts on error by default (haltOnFailure: true)", async () => {
            const state = await CTGTest.init("halt test")
                .stage("throws", () => { throw new Error("stop"); })
                .stage("never runs", (state) => state.subject + 1)
                .start(0);
            expect(state.results.length).toBe(1);
            expect(state.results[0].status).toBe(STATUS.ERROR);
        });

        it("continues after error when haltOnFailure is false", async () => {
            const state = await CTGTest.init("continue test")
                .stage("throws", () => { throw new Error("keep going"); })
                .stage("runs anyway", (state) => state.subject + 1)
                .start(0, { haltOnFailure: false });
            expect(state.results.length).toBe(2);
            expect(state.results[0].status).toBe(STATUS.ERROR);
            expect(state.results[1].status).toBe(STATUS.PASS);
        });

        it("error result label is correct for the failing stage", async () => {
            const state = await CTGTest.init("error label")
                .stage("bad stage", () => { throw new Error("oops"); })
                .start(1);
            expect(state.results[0].label).toEqual(["bad stage"]);
        });
    });

    describe("state threading", () => {

        it("subject updated between stages is visible to next stage", async () => {
            const observed = [];
            await CTGTest.init("threading")
                .stage("set to 10", () => 10)
                .stage("observe", (state) => {
                    observed.push(state.subject);
                    return state.subject;
                })
                .start(0);
            expect(observed[0]).toBe(10);
        });

        it("computed is reset to undefined before each operation", async () => {
            const computedValues = [];
            const state = await CTGTest.init("computed reset")
                .stage("first", (state) => {
                    computedValues.push(state.computed);
                    return state.subject;
                })
                .stage("second", (state) => {
                    computedValues.push(state.computed);
                    return state.subject;
                })
                .start(1);
            // computed should be undefined at the start of each operation
            expect(computedValues[0]).toBe(undefined);
            expect(computedValues[1]).toBe(undefined);
        });

        it("handler return value becomes the new subject", async () => {
            const state = await CTGTest.init("return value")
                .stage("replace", () => "new value")
                .start("old value");
            expect(state.subject).toBe("new value");
        });

        it("handler can return undefined as subject", async () => {
            const state = await CTGTest.init("undefined subject")
                .stage("clear", () => undefined)
                .start(42);
            expect(state.subject).toBe(undefined);
        });

        it("handler can return null as subject", async () => {
            const state = await CTGTest.init("null subject")
                .stage("nullify", () => null)
                .start(42);
            expect(state.subject).toBe(null);
        });
    });

    describe("input normalization", () => {

        it("wraps a raw value in CTGTestState", async () => {
            const state = await CTGTest.init("raw input")
                .stage("identity", (state) => state.subject)
                .start(42);
            expect(state).toBeInstanceOf(CTGTestState);
            expect(state.subject).toBe(42);
        });

        it("accepts a CTGTestState instance directly", async () => {
            const input = CTGTestState.init("original label", 99);
            const state = await CTGTest.init("direct state")
                .stage("identity", (state) => state.subject)
                .start(input);
            expect(state).toBe(input);
            expect(state.subject).toBe(99);
        });

        it("overwrites state label with pipeline label", async () => {
            const input = CTGTestState.init("original", 1);
            const state = await CTGTest.init("pipeline label")
                .stage("identity", (state) => state.subject)
                .start(input);
            expect(state.label).toBe("pipeline label");
        });

        it("overwrites label even when wrapping raw value", async () => {
            const state = await CTGTest.init("my pipeline")
                .stage("identity", (state) => state.subject)
                .start(1);
            expect(state.label).toBe("my pipeline");
        });

        it("accepts null as raw subject", async () => {
            const state = await CTGTest.init("null subject")
                .stage("identity", (state) => state.subject)
                .start(null);
            expect(state.subject).toBe(null);
        });

        it("accepts undefined as raw subject", async () => {
            const state = await CTGTest.init("undef subject")
                .stage("identity", (state) => state.subject)
                .start(undefined);
            expect(state.subject).toBe(undefined);
        });
    });

    describe("validation errors", () => {

        it("empty pipeline label throws INVALID_OPERATION", async () => {
            const pipeline = CTGTest.init("")
                .stage("step", (state) => state.subject);
            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.code).toBe(1000);
                expect(err.type).toBe("INVALID_OPERATION");
            }
        });

        it("whitespace-only pipeline label throws INVALID_OPERATION", async () => {
            const pipeline = CTGTest.init("   ")
                .stage("step", (state) => state.subject);
            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.code).toBe(1000);
            }
        });

        it("empty operation label throws INVALID_OPERATION", async () => {
            const pipeline = CTGTest.init("valid pipeline")
                .stage("", (state) => state.subject);
            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.code).toBe(1000);
            }
        });

        it("non-callable fn throws INVALID_OPERATION", async () => {
            const pipeline = CTGTest.init("valid pipeline")
                .stage("bad fn", "not a function");
            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.code).toBe(1000);
            }
        });

        it("null fn throws INVALID_OPERATION", async () => {
            const pipeline = CTGTest.init("valid pipeline")
                .stage("null fn", null);
            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.code).toBe(1000);
            }
        });

        it("duplicate labels throw INVALID_OPERATION", async () => {
            const pipeline = CTGTest.init("valid pipeline")
                .stage("same label", (state) => state.subject)
                .stage("same label", (state) => state.subject);
            await expect(pipeline.start(1)).rejects.toThrow(CTGTestError);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err.code).toBe(1000);
            }
        });

        it("validation happens in start, not at builder time", () => {
            // These should NOT throw — builder defers validation to start()
            expect(() => {
                CTGTest.init("")
                    .stage("", null)
                    .stage("", "not a function");
            }).not.toThrow();
        });

        it("validation error includes structured data for empty label", async () => {
            const pipeline = CTGTest.init("valid")
                .stage("", (state) => state.subject);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.data).toBeDefined();
                expect(err.data.label).toBe("");
            }
        });

        it("validation error includes structured data for non-callable fn", async () => {
            const pipeline = CTGTest.init("valid")
                .stage("bad", 42);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.data).toBeDefined();
                expect(err.data.got).toBe("number");
            }
        });

        it("validation error includes structured data for duplicate labels", async () => {
            const pipeline = CTGTest.init("valid")
                .stage("dup", (state) => state.subject)
                .stage("dup", (state) => state.subject);
            try {
                await pipeline.start(1);
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.data).toBeDefined();
                expect(err.data.label).toBe("dup");
            }
        });
    });
});
