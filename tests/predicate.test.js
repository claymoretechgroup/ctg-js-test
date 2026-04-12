import { describe, it, expect } from "vitest";
import CTGTestPredicate from "../src/CTGTestPredicate.js";

// Tests derived from spec.v2.2.md section 2.3 — CTGTestPredicate
// realizes: Core Semantics > Primitives > PREDICATE

describe("CTGTestPredicate", () => {

    describe("init() static factory", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicate.init(42, (v) => v === 42);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("accepts any value as expectedOutcome and a function as evaluate", () => {
            const fn = (v) => v > 0;
            const pred = CTGTestPredicate.init("hello", fn);
            expect(pred.expectedOutcome).toBe("hello");
            expect(pred.evaluate).toBe(fn);
        });
    });

    describe("expectedOutcome getter", () => {

        it("returns a number", () => {
            const pred = CTGTestPredicate.init(42, () => true);
            expect(pred.expectedOutcome).toBe(42);
        });

        it("returns a string", () => {
            const pred = CTGTestPredicate.init("expected", () => true);
            expect(pred.expectedOutcome).toBe("expected");
        });

        it("returns a boolean", () => {
            const pred = CTGTestPredicate.init(true, () => true);
            expect(pred.expectedOutcome).toBe(true);
        });

        it("returns null", () => {
            const pred = CTGTestPredicate.init(null, () => true);
            expect(pred.expectedOutcome).toBe(null);
        });

        it("returns undefined", () => {
            const pred = CTGTestPredicate.init(undefined, () => true);
            expect(pred.expectedOutcome).toBe(undefined);
        });

        it("returns an object", () => {
            const obj = { a: 1, b: 2 };
            const pred = CTGTestPredicate.init(obj, () => true);
            expect(pred.expectedOutcome).toBe(obj);
        });

        it("returns an array", () => {
            const arr = [1, 2, 3];
            const pred = CTGTestPredicate.init(arr, () => true);
            expect(pred.expectedOutcome).toBe(arr);
        });

        it("returns zero", () => {
            const pred = CTGTestPredicate.init(0, () => true);
            expect(pred.expectedOutcome).toBe(0);
        });

        it("returns empty string", () => {
            const pred = CTGTestPredicate.init("", () => true);
            expect(pred.expectedOutcome).toBe("");
        });
    });

    describe("evaluate getter", () => {

        it("returns the function that was passed to init", () => {
            const fn = (v) => v === 10;
            const pred = CTGTestPredicate.init(10, fn);
            expect(pred.evaluate).toBe(fn);
        });

        it("returned function is callable", () => {
            const pred = CTGTestPredicate.init(5, (v) => v === 5);
            expect(typeof pred.evaluate).toBe("function");
        });
    });

    describe("evaluate function behavior", () => {

        it("returns true when computed value matches", () => {
            const pred = CTGTestPredicate.init(42, (v) => v === 42);
            expect(pred.evaluate(42)).toBe(true);
        });

        it("returns false when computed value does not match", () => {
            const pred = CTGTestPredicate.init(42, (v) => v === 42);
            expect(pred.evaluate(99)).toBe(false);
        });

        it("works with string comparison", () => {
            const pred = CTGTestPredicate.init("hello", (v) => v === "hello");
            expect(pred.evaluate("hello")).toBe(true);
            expect(pred.evaluate("world")).toBe(false);
        });

        it("works with boolean comparison", () => {
            const pred = CTGTestPredicate.init(true, (v) => v === true);
            expect(pred.evaluate(true)).toBe(true);
            expect(pred.evaluate(false)).toBe(false);
        });

        it("works with range check", () => {
            const pred = CTGTestPredicate.init("0-10", (v) => v >= 0 && v <= 10);
            expect(pred.evaluate(5)).toBe(true);
            expect(pred.evaluate(11)).toBe(false);
        });

        it("works with null check", () => {
            const pred = CTGTestPredicate.init(null, (v) => v === null);
            expect(pred.evaluate(null)).toBe(true);
            expect(pred.evaluate(undefined)).toBe(false);
        });

        it("works with type check", () => {
            const pred = CTGTestPredicate.init("string", (v) => typeof v === "string");
            expect(pred.evaluate("test")).toBe(true);
            expect(pred.evaluate(123)).toBe(false);
        });
    });

    describe("instanceof validation", () => {

        it("instance passes instanceof check", () => {
            const pred = CTGTestPredicate.init(1, (v) => v === 1);
            expect(pred instanceof CTGTestPredicate).toBe(true);
        });

        it("plain object fails instanceof check", () => {
            const fake = { expectedOutcome: 1, evaluate: (v) => v === 1 };
            expect(fake instanceof CTGTestPredicate).toBe(false);
        });

        it("null fails instanceof check", () => {
            expect(null instanceof CTGTestPredicate).toBe(false);
        });

        it("function fails instanceof check", () => {
            const fn = (v) => v === 1;
            expect(fn instanceof CTGTestPredicate).toBe(false);
        });

        it("number fails instanceof check", () => {
            expect((42) instanceof CTGTestPredicate).toBe(false);
        });
    });

    describe("subclass support", () => {

        it("subclass instance is instanceof CTGTestPredicate", () => {
            class DomainPredicate extends CTGTestPredicate {
                static init(expectedOutcome, evaluate) {
                    return new this(expectedOutcome, evaluate);
                }
            }
            const sub = DomainPredicate.init(1, (v) => v === 1);
            expect(sub).toBeInstanceOf(CTGTestPredicate);
        });

        it("subclass instance is instanceof its own class", () => {
            class DomainPredicate extends CTGTestPredicate {
                static init(expectedOutcome, evaluate) {
                    return new this(expectedOutcome, evaluate);
                }
            }
            const sub = DomainPredicate.init(1, (v) => v === 1);
            expect(sub).toBeInstanceOf(DomainPredicate);
        });

        it("base class instance is not instanceof subclass", () => {
            class DomainPredicate extends CTGTestPredicate {
                static init(expectedOutcome, evaluate) {
                    return new this(expectedOutcome, evaluate);
                }
            }
            const base = CTGTestPredicate.init(1, (v) => v === 1);
            expect(base).not.toBeInstanceOf(DomainPredicate);
        });
    });
});
