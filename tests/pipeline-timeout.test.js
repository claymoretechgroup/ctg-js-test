import { describe, it, expect } from "vitest";
import CTGTest from "../src/CTGTest.js";
import CTGTestPredicate from "../src/CTGTestPredicate.js";
import CTGTestPredicates from "../src/CTGTestPredicates.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md sections 2.5, 4.5, Appendix A — per-operation timeout enforcement
// realizes: Left to Language-Specific Specs > Execution envelope details

const { STATUS } = CTGTestResult;

// ── Helpers ────────────────────────────────────────────────────────

// :: INT -> Promise<VOID>
// Delays for the given number of milliseconds.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// :: *, (* -> BOOL) -> CTGTestPredicate
const predicate = (expected, fn) => CTGTestPredicate.init(expected, fn);

// :: * -> CTGTestPredicate
// Convenience: predicate that checks strict equality against expected.
const equals = (expected) => predicate(expected, (v) => v === expected);

// :: VOID -> CTGTestPredicate
// Always-true predicate for assert operations where we only care about timeout.
const alwaysTrue = () => predicate(true, () => true);

// Short timeout for all timeout tests — long enough that non-delayed operations
// complete, short enough that tests don't drag.
const SHORT_TIMEOUT = 50;

// Delay that exceeds SHORT_TIMEOUT.
const OVER_TIMEOUT = 100;

// Delay that fits within SHORT_TIMEOUT.
const UNDER_TIMEOUT = 10;

// ── Tests ──────────────────────────────────────────────────────────

describe("CTGTest timeout enforcement", () => {

    // ── 1. Operation completes within timeout ──────────────────────

    describe("operation completes within timeout", () => {

        it("stage that finishes in time produces PASS", async () => {
            const state = await CTGTest.init("within timeout")
                .stage("fast stage", async (state) => {
                    await delay(UNDER_TIMEOUT);
                    return state.subject + 1;
                })
                .start(10, { timeout: SHORT_TIMEOUT });

            expect(state.subject).toBe(11);
            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.PASS);
        });

        it("assert that finishes in time produces PASS when predicate passes", async () => {
            const state = await CTGTest.init("within timeout")
                .assert("fast assert", async (state) => {
                    await delay(UNDER_TIMEOUT);
                    return state.subject;
                }, equals(42))
                .start(42, { timeout: SHORT_TIMEOUT });

            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.PASS);
        });
    });

    // ── 2. Operation exceeds timeout ───────────────────────────────

    describe("operation exceeds timeout", () => {

        it("stage that exceeds timeout produces ERROR result", async () => {
            const state = await CTGTest.init("timeout exceeded")
                .stage("slow stage", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return state.subject + 1;
                })
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.ERROR);
        });

        it("error message mentions timeout and operation label", async () => {
            const state = await CTGTest.init("timeout message")
                .stage("slow op", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return state.subject;
                })
                .start(1, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            const result = state.results[0];
            expect(result.status).toBe(STATUS.ERROR);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toContain("timed out");
            expect(result.error.message).toContain(`${SHORT_TIMEOUT}ms`);
        });

        it("timed-out stage return value is NOT applied to subject", async () => {
            const state = await CTGTest.init("no apply")
                .stage("slow stage", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return 999;
                })
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.subject).toBe(10);
        });

        it("timed-out assert return value is NOT applied to computed", async () => {
            const state = await CTGTest.init("no apply")
                .assert("slow assert", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return 999;
                }, alwaysTrue())
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            // computed should remain undefined (pre-operation reset value)
            expect(state.computed).toBeUndefined();
        });
    });

    // ── 3. Slot rollback on timeout ────────────────────────────────

    describe("slot rollback on timeout", () => {

        it("state.subject restored to pre-operation value after stage timeout", async () => {
            const state = await CTGTest.init("rollback subject")
                .stage("setup", (state) => 42)
                .stage("slow stage", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return 999;
                })
                .start(0, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            // setup sets subject to 42, slow stage times out — subject restored to 42
            expect(state.subject).toBe(42);
        });

        it("state.computed restored to pre-operation value after assert timeout", async () => {
            // computed is reset to undefined before each operation per spec,
            // so pre-operation snapshot of computed is undefined
            const state = await CTGTest.init("rollback computed")
                .assert("slow assert", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return 999;
                }, alwaysTrue())
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.computed).toBeUndefined();
        });

        it("subject from earlier stage preserved through later stage timeout", async () => {
            const state = await CTGTest.init("rollback preserves earlier")
                .stage("first", (state) => "established")
                .stage("second", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return "overwritten";
                })
                .start(undefined, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.subject).toBe("established");
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.results[1].status).toBe(STATUS.ERROR);
        });
    });

    // ── 4. No slot rollback on regular throw ───────────────────────

    describe("no slot rollback on regular handler error", () => {

        it("handler throw does not restore subject — slot was never deposited", async () => {
            const state = await CTGTest.init("throw no rollback")
                .stage("setup", (state) => 42)
                .stage("throws", (state) => {
                    throw new Error("handler error");
                })
                .start(0, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            // Subject remains 42 — not because of rollback, but because the
            // framework writes to subject AFTER the handler returns. The handler
            // threw, so the deposit never happened.
            expect(state.subject).toBe(42);
            expect(state.results[1].status).toBe(STATUS.ERROR);
            expect(state.results[1].error.message).toBe("handler error");
        });

        it("handler throw on assert does not restore computed", async () => {
            const state = await CTGTest.init("throw no rollback assert")
                .assert("throws", (state) => {
                    throw new Error("assert handler error");
                }, alwaysTrue())
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            // computed was reset to undefined before the operation, handler threw,
            // deposit never happened — computed stays undefined
            expect(state.computed).toBeUndefined();
            expect(state.results[0].status).toBe(STATUS.ERROR);
        });
    });

    // ── 5. timeout: 0 disables enforcement ─────────────────────────

    describe("timeout: 0 disables enforcement", () => {

        it("slow stage succeeds when timeout is disabled", async () => {
            const state = await CTGTest.init("no timeout")
                .stage("slow but ok", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return state.subject + 1;
                })
                .start(10, { timeout: 0 });

            expect(state.subject).toBe(11);
            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.PASS);
        });

        it("slow assert succeeds when timeout is disabled", async () => {
            const state = await CTGTest.init("no timeout assert")
                .assert("slow but ok", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return state.subject;
                }, equals(10))
                .start(10, { timeout: 0 });

            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.PASS);
        });
    });

    // ── 6. haltOnFailure after timeout ─────────────────────────────

    describe("haltOnFailure after timeout", () => {

        it("haltOnFailure: true stops pipeline after timeout ERROR", async () => {
            const state = await CTGTest.init("halt on timeout")
                .stage("slow", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return 999;
                })
                .stage("never reached", (state) => state.subject + 1)
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: true });

            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.ERROR);
            // Second stage never ran
            expect(state.subject).toBe(10);
        });

        it("haltOnFailure: false continues pipeline after timeout ERROR", async () => {
            const state = await CTGTest.init("continue on timeout")
                .stage("slow", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return 999;
                })
                .stage("runs anyway", (state) => state.subject + 1)
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.results).toHaveLength(2);
            expect(state.results[0].status).toBe(STATUS.ERROR);
            expect(state.results[1].status).toBe(STATUS.PASS);
            // Subject rolled back to 10 after timeout, then second stage adds 1
            expect(state.subject).toBe(11);
        });
    });

    // ── 7. Timeout on stage vs assert ──────────────────────────────

    describe("timeout applies to stages and asserts individually", () => {

        it("stage timeout produces ERROR with no subject change", async () => {
            const state = await CTGTest.init("stage timeout")
                .stage("slow", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return "new value";
                })
                .start("original", { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.subject).toBe("original");
            expect(state.results[0].status).toBe(STATUS.ERROR);
        });

        it("assert timeout produces ERROR with no computed change", async () => {
            const state = await CTGTest.init("assert timeout")
                .assert("slow", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return "computed value";
                }, alwaysTrue())
                .start("original", { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.computed).toBeUndefined();
            expect(state.results[0].status).toBe(STATUS.ERROR);
            // Subject untouched — asserts don't write to subject
            expect(state.subject).toBe("original");
        });

        it("timeout is per-operation, not cumulative across operations", async () => {
            // Each operation gets its own timeout window. Two operations that
            // each take less than the timeout should both pass, even if their
            // combined time exceeds the timeout.
            const state = await CTGTest.init("per-operation")
                .stage("first", async (state) => {
                    await delay(UNDER_TIMEOUT);
                    return state.subject + 1;
                })
                .stage("second", async (state) => {
                    await delay(UNDER_TIMEOUT);
                    return state.subject + 1;
                })
                .start(0, { timeout: SHORT_TIMEOUT });

            expect(state.results).toHaveLength(2);
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.results[1].status).toBe(STATUS.PASS);
            expect(state.subject).toBe(2);
        });
    });

    // ── 8. Multiple operations with timeout ────────────────────────

    describe("multiple operations with timeout", () => {

        it("first times out, second runs with haltOnFailure: false", async () => {
            const state = await CTGTest.init("multi timeout")
                .stage("slow first", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return 999;
                })
                .stage("fast second", (state) => state.subject + 5)
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.results).toHaveLength(2);
            expect(state.results[0].status).toBe(STATUS.ERROR);
            expect(state.results[1].status).toBe(STATUS.PASS);
            // Subject rolled back to 10 after first timeout, then +5
            expect(state.subject).toBe(15);
        });

        it("second operation times out, first result preserved", async () => {
            const state = await CTGTest.init("second timeout")
                .stage("fast first", (state) => state.subject + 1)
                .stage("slow second", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return 999;
                })
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.results).toHaveLength(2);
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.results[1].status).toBe(STATUS.ERROR);
            // First stage set subject to 11, second timed out — rollback to 11
            expect(state.subject).toBe(11);
        });

        it("mix of stage and assert timeouts with haltOnFailure: false", async () => {
            const state = await CTGTest.init("mixed timeouts")
                .stage("fast stage", (state) => state.subject * 2)
                .assert("slow assert", async (state) => {
                    await delay(OVER_TIMEOUT);
                    return state.subject;
                }, equals(20))
                .stage("fast follow-up", (state) => state.subject + 1)
                .start(10, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            expect(state.results).toHaveLength(3);
            expect(state.results[0].status).toBe(STATUS.PASS);   // fast stage
            expect(state.results[1].status).toBe(STATUS.ERROR);   // slow assert timed out
            expect(state.results[2].status).toBe(STATUS.PASS);    // fast follow-up
            // stage: 10 * 2 = 20, assert timed out (no effect), follow-up: 20 + 1 = 21
            expect(state.subject).toBe(21);
        });
    });

    // ── 9. Timeout Inside Chained Sub-Pipelines ───────────────────────

    describe("timeout inside chained sub-pipelines", () => {

        it("per-operation timeout applies to operations inside a chain", async () => {
            const inner = CTGTest.init("inner")
                .stage("slow inner", async () => { await delay(OVER_TIMEOUT); return 999; });

            const state = await CTGTest.init("outer")
                .stage("setup", () => 1)
                .chain("sub", inner)
                .start(0, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            // setup passes, slow inner times out
            expect(state.results).toHaveLength(2);
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.results[1].status).toBe(STATUS.ERROR);
            // chain label prepended
            expect(state.results[1].label).toEqual(["sub", "slow inner"]);
        });

        it("timeout rollback restores state inside chain", async () => {
            const inner = CTGTest.init("inner")
                .stage("slow", async () => { await delay(OVER_TIMEOUT); return 999; });

            const state = await CTGTest.init("outer")
                .stage("set subject", () => 42)
                .chain("sub", inner)
                .stage("after chain", (s) => s.subject + 1)
                .start(0, { timeout: SHORT_TIMEOUT, haltOnFailure: false });

            // subject should be 42 (set by first stage), not 999 (rolled back),
            // then 43 from after-chain stage
            expect(state.subject).toBe(43);
        });

        it("fast operation inside chain succeeds within timeout", async () => {
            const inner = CTGTest.init("inner")
                .stage("fast", () => 100);

            const state = await CTGTest.init("outer")
                .chain("sub", inner)
                .start(0, { timeout: SHORT_TIMEOUT });

            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.PASS);
            expect(state.subject).toBe(100);
        });

        it("timeout in nested chain halts outer pipeline with haltOnFailure", async () => {
            const inner = CTGTest.init("inner")
                .stage("slow", async () => { await delay(OVER_TIMEOUT); return 999; });

            let afterRan = false;
            const state = await CTGTest.init("outer")
                .chain("sub", inner)
                .stage("after", () => { afterRan = true; return 1; })
                .start(0, { timeout: SHORT_TIMEOUT, haltOnFailure: true });

            expect(afterRan).toBe(false);
            expect(state.results).toHaveLength(1);
            expect(state.results[0].status).toBe(STATUS.ERROR);
        });
    });
});
