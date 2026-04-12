import { describe, it, expect } from "vitest";
import CTGTestState from "../src/CTGTestState.js";

// Tests derived from spec.v2.2.md section 2.1 — CTGTestState
// realizes: Core Semantics > Primitives > STATE

describe("CTGTestState", () => {

    describe("constructor defaults", () => {

        it("subject defaults to undefined", () => {
            const state = new CTGTestState();
            expect(state.subject).toBe(undefined);
        });

        it("computed defaults to undefined", () => {
            const state = new CTGTestState();
            expect(state.computed).toBe(undefined);
        });

        it("results defaults to empty array", () => {
            const state = new CTGTestState();
            expect(state.results).toEqual([]);
        });

        it("label defaults to empty string", () => {
            const state = new CTGTestState();
            expect(state.label).toBe("");
        });
    });

    describe("constructor with arguments", () => {

        it("accepts subject via options object", () => {
            const state = new CTGTestState({ subject: 42 });
            expect(state.subject).toBe(42);
        });

        it("accepts label via options object", () => {
            const state = new CTGTestState({ label: "test pipeline" });
            expect(state.label).toBe("test pipeline");
        });

        it("accepts both subject and label", () => {
            const state = new CTGTestState({ subject: "hello", label: "my test" });
            expect(state.subject).toBe("hello");
            expect(state.label).toBe("my test");
        });

        it("ignores unknown keys in options", () => {
            const state = new CTGTestState({ subject: 1, unknown: "value" });
            expect(state.subject).toBe(1);
        });

        it("accepts null as subject", () => {
            const state = new CTGTestState({ subject: null });
            expect(state.subject).toBe(null);
        });

        it("accepts object as subject", () => {
            const obj = { a: 1, b: [2, 3] };
            const state = new CTGTestState({ subject: obj });
            expect(state.subject).toBe(obj);
        });

        it("accepts function as subject", () => {
            const fn = () => 42;
            const state = new CTGTestState({ subject: fn });
            expect(state.subject).toBe(fn);
        });
    });

    describe("label getter and setter", () => {

        it("get returns the label", () => {
            const state = new CTGTestState({ label: "pipeline A" });
            expect(state.label).toBe("pipeline A");
        });

        it("set overwrites the label", () => {
            const state = new CTGTestState({ label: "old" });
            state.label = "new";
            expect(state.label).toBe("new");
        });
    });

    describe("subject getter and setter", () => {

        it("get returns the subject", () => {
            const state = new CTGTestState({ subject: 10 });
            expect(state.subject).toBe(10);
        });

        it("set overwrites the subject", () => {
            const state = new CTGTestState({ subject: 10 });
            state.subject = 20;
            expect(state.subject).toBe(20);
        });

        it("set accepts any type", () => {
            const state = new CTGTestState();
            state.subject = "string";
            expect(state.subject).toBe("string");
            state.subject = [1, 2, 3];
            expect(state.subject).toEqual([1, 2, 3]);
            state.subject = null;
            expect(state.subject).toBe(null);
        });
    });

    describe("computed getter and setter", () => {

        it("get returns the computed value", () => {
            const state = new CTGTestState();
            expect(state.computed).toBe(undefined);
        });

        it("set deposits a computed value", () => {
            const state = new CTGTestState();
            state.computed = 99;
            expect(state.computed).toBe(99);
        });

        it("set accepts any type", () => {
            const state = new CTGTestState();
            state.computed = { key: "val" };
            expect(state.computed).toEqual({ key: "val" });
            state.computed = undefined;
            expect(state.computed).toBe(undefined);
        });
    });

    describe("results", () => {

        it("returns the results array", () => {
            const state = new CTGTestState();
            expect(Array.isArray(state.results)).toBe(true);
            expect(state.results.length).toBe(0);
        });

        it("results array is the same reference across reads", () => {
            const state = new CTGTestState();
            const a = state.results;
            const b = state.results;
            expect(a).toBe(b);
        });
    });

    describe("addResult", () => {

        it("appends a result to the results array", () => {
            const state = new CTGTestState();
            const mockResult = { label: ["step 1"], skipped: false, status: 0 };
            state.addResult(mockResult);
            expect(state.results.length).toBe(1);
            expect(state.results[0]).toBe(mockResult);
        });

        it("appends multiple results in order", () => {
            const state = new CTGTestState();
            const r1 = { label: ["a"], skipped: false, status: 0 };
            const r2 = { label: ["b"], skipped: false, status: 1 };
            const r3 = { label: ["c"], skipped: true, status: undefined };
            state.addResult(r1);
            state.addResult(r2);
            state.addResult(r3);
            expect(state.results.length).toBe(3);
            expect(state.results[0]).toBe(r1);
            expect(state.results[1]).toBe(r2);
            expect(state.results[2]).toBe(r3);
        });
    });

    describe("status getter", () => {

        // status is aggregate derived from results — tested more thoroughly
        // in result.test.js. Here we verify the getter exists and delegates.

        it("returns a status value for empty results", () => {
            const state = new CTGTestState();
            // Empty results should return PASS (0)
            expect(state.status).toBe(0);
        });
    });

    describe("init static factory", () => {

        it("creates a CTGTestState instance", () => {
            const state = CTGTestState.init("my pipeline", 42);
            expect(state).toBeInstanceOf(CTGTestState);
        });

        it("sets label from first argument", () => {
            const state = CTGTestState.init("pipeline label", 5);
            expect(state.label).toBe("pipeline label");
        });

        it("sets subject from second argument", () => {
            const state = CTGTestState.init("test", 100);
            expect(state.subject).toBe(100);
        });

        it("initializes computed to undefined", () => {
            const state = CTGTestState.init("test", 1);
            expect(state.computed).toBe(undefined);
        });

        it("initializes results to empty array", () => {
            const state = CTGTestState.init("test", 1);
            expect(state.results).toEqual([]);
        });
    });

    describe("domain extension", () => {

        it("subclass instances are accepted as CTGTestState", () => {
            class DomainState extends CTGTestState {
                constructor(opts = {}) {
                    super(opts);
                    this.page = opts.page || null;
                }
            }
            const state = new DomainState({ subject: "url", label: "browser test", page: {} });
            expect(state).toBeInstanceOf(CTGTestState);
            expect(state).toBeInstanceOf(DomainState);
            expect(state.subject).toBe("url");
            expect(state.page).toEqual({});
        });

        it("subclass preserves getter/setter behavior", () => {
            class DomainState extends CTGTestState {
                constructor(opts = {}) {
                    super(opts);
                    this.extra = "domain";
                }
            }
            const state = new DomainState({ subject: 1 });
            state.subject = 2;
            expect(state.subject).toBe(2);
            state.computed = "val";
            expect(state.computed).toBe("val");
            state.label = "new label";
            expect(state.label).toBe("new label");
        });
    });
});
