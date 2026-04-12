import { describe, it, expect } from "vitest";
import CTGTestPredicates from "../src/CTGTestPredicates.js";
import CTGTestPredicate from "../src/CTGTestPredicate.js";

// Tests derived from spec.v2.2.md section 2.4 — CTGTestPredicates
// realizes: Core Concepts > 4. Assert Is the Only Correctness Primitive
// realizes: Left to Language-Specific Specs > Convenience builders

describe("CTGTestPredicates", () => {

    // ── equals ──────────────────────────────────────────────────────

    describe("equals", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.equals(42);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the expected value", () => {
            const pred = CTGTestPredicates.equals(42);
            expect(pred.expectedOutcome).toBe(42);
        });

        it("evaluate returns true for deep-strict-equal primitives", () => {
            const pred = CTGTestPredicates.equals(42);
            expect(pred.evaluate(42)).toBe(true);
        });

        it("evaluate returns false for non-equal primitives", () => {
            const pred = CTGTestPredicates.equals(42);
            expect(pred.evaluate(43)).toBe(false);
        });

        it("evaluate returns true for deep-strict-equal objects", () => {
            const pred = CTGTestPredicates.equals({ a: 1, b: [2, 3] });
            expect(pred.evaluate({ a: 1, b: [2, 3] })).toBe(true);
        });

        it("evaluate returns false for structurally different objects", () => {
            const pred = CTGTestPredicates.equals({ a: 1 });
            expect(pred.evaluate({ a: 2 })).toBe(false);
        });

        it("evaluate returns true for deep-strict-equal arrays", () => {
            const pred = CTGTestPredicates.equals([1, 2, 3]);
            expect(pred.evaluate([1, 2, 3])).toBe(true);
        });

        it("evaluate returns false when array order differs", () => {
            const pred = CTGTestPredicates.equals([1, 2, 3]);
            expect(pred.evaluate([3, 2, 1])).toBe(false);
        });

        it("evaluate handles null", () => {
            const pred = CTGTestPredicates.equals(null);
            expect(pred.evaluate(null)).toBe(true);
            expect(pred.evaluate(undefined)).toBe(false);
        });

        it("evaluate handles undefined", () => {
            const pred = CTGTestPredicates.equals(undefined);
            expect(pred.evaluate(undefined)).toBe(true);
            expect(pred.evaluate(null)).toBe(false);
        });

        it("evaluate handles empty string", () => {
            const pred = CTGTestPredicates.equals("");
            expect(pred.evaluate("")).toBe(true);
            expect(pred.evaluate("a")).toBe(false);
        });

        it("does not coerce types", () => {
            const pred = CTGTestPredicates.equals(0);
            expect(pred.evaluate(false)).toBe(false);
            expect(pred.evaluate("")).toBe(false);
            expect(pred.evaluate(null)).toBe(false);
        });
    });

    // ── notEquals ───────────────────────────────────────────────────

    describe("notEquals", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.notEquals(42);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the expected value", () => {
            const pred = CTGTestPredicates.notEquals(42);
            expect(pred.expectedOutcome).toBe(42);
        });

        it("evaluate returns true for non-equal values", () => {
            const pred = CTGTestPredicates.notEquals(42);
            expect(pred.evaluate(43)).toBe(true);
        });

        it("evaluate returns false for deep-strict-equal values", () => {
            const pred = CTGTestPredicates.notEquals(42);
            expect(pred.evaluate(42)).toBe(false);
        });

        it("evaluate returns true for structurally different objects", () => {
            const pred = CTGTestPredicates.notEquals({ a: 1 });
            expect(pred.evaluate({ a: 2 })).toBe(true);
        });

        it("evaluate returns false for deep-strict-equal objects", () => {
            const pred = CTGTestPredicates.notEquals({ a: 1 });
            expect(pred.evaluate({ a: 1 })).toBe(false);
        });

        it("null and undefined are not equal", () => {
            const pred = CTGTestPredicates.notEquals(null);
            expect(pred.evaluate(undefined)).toBe(true);
        });
    });

    // ── isVoid ──────────────────────────────────────────────────────

    describe("isVoid", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is undefined", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred.expectedOutcome).toBe(undefined);
        });

        it("evaluate returns true for null", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred.evaluate(null)).toBe(true);
        });

        it("evaluate returns true for undefined", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred.evaluate(undefined)).toBe(true);
        });

        it("evaluate returns false for zero", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred.evaluate(0)).toBe(false);
        });

        it("evaluate returns false for empty string", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred.evaluate("")).toBe(false);
        });

        it("evaluate returns false for false", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred.evaluate(false)).toBe(false);
        });

        it("evaluate returns false for NaN", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred.evaluate(NaN)).toBe(false);
        });

        it("evaluate returns false for an object", () => {
            const pred = CTGTestPredicates.isVoid();
            expect(pred.evaluate({})).toBe(false);
        });
    });

    // ── isNotVoid ───────────────────────────────────────────────────

    describe("isNotVoid", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.isNotVoid();
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("evaluate returns false for null", () => {
            const pred = CTGTestPredicates.isNotVoid();
            expect(pred.evaluate(null)).toBe(false);
        });

        it("evaluate returns false for undefined", () => {
            const pred = CTGTestPredicates.isNotVoid();
            expect(pred.evaluate(undefined)).toBe(false);
        });

        it("evaluate returns true for zero", () => {
            const pred = CTGTestPredicates.isNotVoid();
            expect(pred.evaluate(0)).toBe(true);
        });

        it("evaluate returns true for empty string", () => {
            const pred = CTGTestPredicates.isNotVoid();
            expect(pred.evaluate("")).toBe(true);
        });

        it("evaluate returns true for false", () => {
            const pred = CTGTestPredicates.isNotVoid();
            expect(pred.evaluate(false)).toBe(true);
        });

        it("evaluate returns true for an object", () => {
            const pred = CTGTestPredicates.isNotVoid();
            expect(pred.evaluate({})).toBe(true);
        });
    });

    // ── isTruthy ────────────────────────────────────────────────────

    describe("isTruthy", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.isTruthy();
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("evaluate returns true for truthy values", () => {
            const pred = CTGTestPredicates.isTruthy();
            expect(pred.evaluate(1)).toBe(true);
            expect(pred.evaluate("hello")).toBe(true);
            expect(pred.evaluate(true)).toBe(true);
            expect(pred.evaluate([])).toBe(true);
            expect(pred.evaluate({})).toBe(true);
        });

        it("evaluate returns false for falsy values", () => {
            const pred = CTGTestPredicates.isTruthy();
            expect(pred.evaluate(0)).toBe(false);
            expect(pred.evaluate("")).toBe(false);
            expect(pred.evaluate(false)).toBe(false);
            expect(pred.evaluate(null)).toBe(false);
            expect(pred.evaluate(undefined)).toBe(false);
            expect(pred.evaluate(NaN)).toBe(false);
        });
    });

    // ── isFalsy ─────────────────────────────────────────────────────

    describe("isFalsy", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.isFalsy();
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("evaluate returns true for falsy values", () => {
            const pred = CTGTestPredicates.isFalsy();
            expect(pred.evaluate(0)).toBe(true);
            expect(pred.evaluate("")).toBe(true);
            expect(pred.evaluate(false)).toBe(true);
            expect(pred.evaluate(null)).toBe(true);
            expect(pred.evaluate(undefined)).toBe(true);
            expect(pred.evaluate(NaN)).toBe(true);
        });

        it("evaluate returns false for truthy values", () => {
            const pred = CTGTestPredicates.isFalsy();
            expect(pred.evaluate(1)).toBe(false);
            expect(pred.evaluate("hello")).toBe(false);
            expect(pred.evaluate(true)).toBe(false);
            expect(pred.evaluate([])).toBe(false);
            expect(pred.evaluate({})).toBe(false);
        });
    });

    // ── isTrue ──────────────────────────────────────────────────────

    describe("isTrue", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.isTrue();
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("evaluate returns true for true", () => {
            const pred = CTGTestPredicates.isTrue();
            expect(pred.evaluate(true)).toBe(true);
        });

        it("evaluate returns false for false", () => {
            const pred = CTGTestPredicates.isTrue();
            expect(pred.evaluate(false)).toBe(false);
        });

        it("evaluate returns false for truthy non-boolean values", () => {
            const pred = CTGTestPredicates.isTrue();
            expect(pred.evaluate(1)).toBe(false);
            expect(pred.evaluate("true")).toBe(false);
            expect(pred.evaluate([])).toBe(false);
            expect(pred.evaluate({})).toBe(false);
        });

        it("evaluate returns false for null", () => {
            const pred = CTGTestPredicates.isTrue();
            expect(pred.evaluate(null)).toBe(false);
        });

        it("evaluate returns false for undefined", () => {
            const pred = CTGTestPredicates.isTrue();
            expect(pred.evaluate(undefined)).toBe(false);
        });
    });

    // ── isFalse ─────────────────────────────────────────────────────

    describe("isFalse", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.isFalse();
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("evaluate returns true for false", () => {
            const pred = CTGTestPredicates.isFalse();
            expect(pred.evaluate(false)).toBe(true);
        });

        it("evaluate returns false for true", () => {
            const pred = CTGTestPredicates.isFalse();
            expect(pred.evaluate(true)).toBe(false);
        });

        it("evaluate returns false for falsy non-boolean values", () => {
            const pred = CTGTestPredicates.isFalse();
            expect(pred.evaluate(0)).toBe(false);
            expect(pred.evaluate("")).toBe(false);
            expect(pred.evaluate(null)).toBe(false);
            expect(pred.evaluate(undefined)).toBe(false);
            expect(pred.evaluate(NaN)).toBe(false);
        });
    });

    // ── isInstanceOf ────────────────────────────────────────────────

    describe("isInstanceOf", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.isInstanceOf(Array);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the constructor", () => {
            const pred = CTGTestPredicates.isInstanceOf(Array);
            expect(pred.expectedOutcome).toBe(Array);
        });

        it("evaluate returns true for matching instance", () => {
            const pred = CTGTestPredicates.isInstanceOf(Array);
            expect(pred.evaluate([1, 2])).toBe(true);
        });

        it("evaluate returns false for non-matching instance", () => {
            const pred = CTGTestPredicates.isInstanceOf(Array);
            expect(pred.evaluate("not an array")).toBe(false);
        });

        it("evaluate works with custom classes", () => {
            class Foo {}
            class Bar extends Foo {}
            const pred = CTGTestPredicates.isInstanceOf(Foo);
            expect(pred.evaluate(new Foo())).toBe(true);
            expect(pred.evaluate(new Bar())).toBe(true);
        });

        it("evaluate returns false for null", () => {
            const pred = CTGTestPredicates.isInstanceOf(Object);
            expect(pred.evaluate(null)).toBe(false);
        });

        it("evaluate returns false for undefined", () => {
            const pred = CTGTestPredicates.isInstanceOf(Object);
            expect(pred.evaluate(undefined)).toBe(false);
        });

        it("evaluate works with Error", () => {
            const pred = CTGTestPredicates.isInstanceOf(Error);
            expect(pred.evaluate(new Error("test"))).toBe(true);
            expect(pred.evaluate(new TypeError("test"))).toBe(true);
            expect(pred.evaluate({})).toBe(false);
        });
    });

    // ── isType ──────────────────────────────────────────────────────

    describe("isType", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.isType("string");
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the type string", () => {
            const pred = CTGTestPredicates.isType("number");
            expect(pred.expectedOutcome).toBe("number");
        });

        it("evaluate returns true for matching typeof", () => {
            expect(CTGTestPredicates.isType("string").evaluate("hello")).toBe(true);
            expect(CTGTestPredicates.isType("number").evaluate(42)).toBe(true);
            expect(CTGTestPredicates.isType("boolean").evaluate(true)).toBe(true);
            expect(CTGTestPredicates.isType("object").evaluate({})).toBe(true);
            expect(CTGTestPredicates.isType("function").evaluate(() => {})).toBe(true);
            expect(CTGTestPredicates.isType("undefined").evaluate(undefined)).toBe(true);
        });

        it("evaluate returns false for non-matching typeof", () => {
            const pred = CTGTestPredicates.isType("string");
            expect(pred.evaluate(42)).toBe(false);
            expect(pred.evaluate(null)).toBe(false);
            expect(pred.evaluate(undefined)).toBe(false);
        });

        it("null has typeof object", () => {
            const pred = CTGTestPredicates.isType("object");
            expect(pred.evaluate(null)).toBe(true);
        });

        it("array has typeof object", () => {
            const pred = CTGTestPredicates.isType("object");
            expect(pred.evaluate([])).toBe(true);
        });
    });

    // ── greaterThan ─────────────────────────────────────────────────

    describe("greaterThan", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.greaterThan(5);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the expected value", () => {
            const pred = CTGTestPredicates.greaterThan(5);
            expect(pred.expectedOutcome).toBe(5);
        });

        it("evaluate returns true when value is greater", () => {
            const pred = CTGTestPredicates.greaterThan(5);
            expect(pred.evaluate(6)).toBe(true);
            expect(pred.evaluate(100)).toBe(true);
        });

        it("evaluate returns false when value is equal", () => {
            const pred = CTGTestPredicates.greaterThan(5);
            expect(pred.evaluate(5)).toBe(false);
        });

        it("evaluate returns false when value is less", () => {
            const pred = CTGTestPredicates.greaterThan(5);
            expect(pred.evaluate(4)).toBe(false);
            expect(pred.evaluate(-1)).toBe(false);
        });

        it("works with negative numbers", () => {
            const pred = CTGTestPredicates.greaterThan(-3);
            expect(pred.evaluate(-2)).toBe(true);
            expect(pred.evaluate(-3)).toBe(false);
            expect(pred.evaluate(-4)).toBe(false);
        });

        it("works with zero", () => {
            const pred = CTGTestPredicates.greaterThan(0);
            expect(pred.evaluate(1)).toBe(true);
            expect(pred.evaluate(0)).toBe(false);
            expect(pred.evaluate(-1)).toBe(false);
        });
    });

    // ── lessThan ────────────────────────────────────────────────────

    describe("lessThan", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.lessThan(5);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the expected value", () => {
            const pred = CTGTestPredicates.lessThan(5);
            expect(pred.expectedOutcome).toBe(5);
        });

        it("evaluate returns true when value is less", () => {
            const pred = CTGTestPredicates.lessThan(5);
            expect(pred.evaluate(4)).toBe(true);
            expect(pred.evaluate(-100)).toBe(true);
        });

        it("evaluate returns false when value is equal", () => {
            const pred = CTGTestPredicates.lessThan(5);
            expect(pred.evaluate(5)).toBe(false);
        });

        it("evaluate returns false when value is greater", () => {
            const pred = CTGTestPredicates.lessThan(5);
            expect(pred.evaluate(6)).toBe(false);
            expect(pred.evaluate(100)).toBe(false);
        });

        it("works with negative numbers", () => {
            const pred = CTGTestPredicates.lessThan(-3);
            expect(pred.evaluate(-4)).toBe(true);
            expect(pred.evaluate(-3)).toBe(false);
            expect(pred.evaluate(-2)).toBe(false);
        });
    });

    // ── contains ────────────────────────────────────────────────────

    describe("contains", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.contains("world");
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the expected substring", () => {
            const pred = CTGTestPredicates.contains("world");
            expect(pred.expectedOutcome).toBe("world");
        });

        it("evaluate returns true when string includes substring", () => {
            const pred = CTGTestPredicates.contains("world");
            expect(pred.evaluate("hello world")).toBe(true);
        });

        it("evaluate returns false when string does not include substring", () => {
            const pred = CTGTestPredicates.contains("world");
            expect(pred.evaluate("hello")).toBe(false);
        });

        it("evaluate returns true for exact match", () => {
            const pred = CTGTestPredicates.contains("hello");
            expect(pred.evaluate("hello")).toBe(true);
        });

        it("evaluate returns true for empty substring", () => {
            const pred = CTGTestPredicates.contains("");
            expect(pred.evaluate("anything")).toBe(true);
        });

        it("evaluate returns true for empty string containing empty substring", () => {
            const pred = CTGTestPredicates.contains("");
            expect(pred.evaluate("")).toBe(true);
        });

        it("evaluate returns false for non-string values", () => {
            const pred = CTGTestPredicates.contains("1");
            expect(pred.evaluate(1)).toBe(false);
            expect(pred.evaluate(null)).toBe(false);
            expect(pred.evaluate(undefined)).toBe(false);
            expect(pred.evaluate([1])).toBe(false);
        });
    });

    // ── matchesPattern ──────────────────────────────────────────────

    describe("matchesPattern", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.matchesPattern(/abc/);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the regex pattern", () => {
            const pattern = /^hello/;
            const pred = CTGTestPredicates.matchesPattern(pattern);
            expect(pred.expectedOutcome).toBe(pattern);
        });

        it("evaluate returns true when value matches regex", () => {
            const pred = CTGTestPredicates.matchesPattern(/^hello/);
            expect(pred.evaluate("hello world")).toBe(true);
        });

        it("evaluate returns false when value does not match regex", () => {
            const pred = CTGTestPredicates.matchesPattern(/^hello/);
            expect(pred.evaluate("world hello")).toBe(false);
        });

        it("evaluate works with flags", () => {
            const pred = CTGTestPredicates.matchesPattern(/hello/i);
            expect(pred.evaluate("HELLO")).toBe(true);
        });

        it("evaluate works with complex patterns", () => {
            const pred = CTGTestPredicates.matchesPattern(/^\d{3}-\d{4}$/);
            expect(pred.evaluate("123-4567")).toBe(true);
            expect(pred.evaluate("12-4567")).toBe(false);
            expect(pred.evaluate("abc-defg")).toBe(false);
        });

        it("evaluate handles empty string", () => {
            const pred = CTGTestPredicates.matchesPattern(/.+/);
            expect(pred.evaluate("")).toBe(false);
        });
    });

    // ── hasLength ───────────────────────────────────────────────────

    describe("hasLength", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.hasLength(3);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the expected length", () => {
            const pred = CTGTestPredicates.hasLength(3);
            expect(pred.expectedOutcome).toBe(3);
        });

        it("evaluate returns true for array with matching length", () => {
            const pred = CTGTestPredicates.hasLength(3);
            expect(pred.evaluate([1, 2, 3])).toBe(true);
        });

        it("evaluate returns false for array with different length", () => {
            const pred = CTGTestPredicates.hasLength(3);
            expect(pred.evaluate([1, 2])).toBe(false);
            expect(pred.evaluate([1, 2, 3, 4])).toBe(false);
        });

        it("evaluate returns true for empty array with length zero", () => {
            const pred = CTGTestPredicates.hasLength(0);
            expect(pred.evaluate([])).toBe(true);
        });

        it("evaluate works with strings", () => {
            const pred = CTGTestPredicates.hasLength(5);
            expect(pred.evaluate("hello")).toBe(true);
            expect(pred.evaluate("hi")).toBe(false);
        });

        it("evaluate works with empty string", () => {
            const pred = CTGTestPredicates.hasLength(0);
            expect(pred.evaluate("")).toBe(true);
        });
    });

    // ── anyOf ───────────────────────────────────────────────────────

    describe("anyOf", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.anyOf([1, 2, 3]);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the candidates array", () => {
            const candidates = [1, 2, 3];
            const pred = CTGTestPredicates.anyOf(candidates);
            expect(pred.expectedOutcome).toBe(candidates);
        });

        it("evaluate returns true when value deep-equals any candidate", () => {
            const pred = CTGTestPredicates.anyOf([1, 2, 3]);
            expect(pred.evaluate(1)).toBe(true);
            expect(pred.evaluate(2)).toBe(true);
            expect(pred.evaluate(3)).toBe(true);
        });

        it("evaluate returns false when value matches no candidate", () => {
            const pred = CTGTestPredicates.anyOf([1, 2, 3]);
            expect(pred.evaluate(4)).toBe(false);
            expect(pred.evaluate("1")).toBe(false);
        });

        it("evaluate uses deep-strict-equality for objects", () => {
            const pred = CTGTestPredicates.anyOf([{ a: 1 }, { b: 2 }]);
            expect(pred.evaluate({ a: 1 })).toBe(true);
            expect(pred.evaluate({ b: 2 })).toBe(true);
            expect(pred.evaluate({ a: 2 })).toBe(false);
        });

        it("evaluate returns false for empty candidates", () => {
            const pred = CTGTestPredicates.anyOf([]);
            expect(pred.evaluate(1)).toBe(false);
            expect(pred.evaluate(null)).toBe(false);
        });

        it("evaluate handles null and undefined candidates", () => {
            const pred = CTGTestPredicates.anyOf([null, undefined]);
            expect(pred.evaluate(null)).toBe(true);
            expect(pred.evaluate(undefined)).toBe(true);
            expect(pred.evaluate(0)).toBe(false);
        });
    });

    // ── satisfies ───────────────────────────────────────────────────

    describe("satisfies", () => {

        it("returns a CTGTestPredicate instance", () => {
            const pred = CTGTestPredicates.satisfies(v => v > 0);
            expect(pred).toBeInstanceOf(CTGTestPredicate);
        });

        it("expectedOutcome is the wildcard string", () => {
            const pred = CTGTestPredicates.satisfies(v => v > 0);
            expect(pred.expectedOutcome).toBe("*");
        });

        it("evaluate delegates to the provided function", () => {
            const pred = CTGTestPredicates.satisfies(v => v > 0);
            expect(pred.evaluate(1)).toBe(true);
            expect(pred.evaluate(0)).toBe(false);
            expect(pred.evaluate(-1)).toBe(false);
        });

        it("evaluate works with complex predicates", () => {
            const pred = CTGTestPredicates.satisfies(v =>
                Array.isArray(v) && v.length > 0 && v.every(x => typeof x === "number")
            );
            expect(pred.evaluate([1, 2, 3])).toBe(true);
            expect(pred.evaluate([])).toBe(false);
            expect(pred.evaluate([1, "a"])).toBe(false);
            expect(pred.evaluate("not array")).toBe(false);
        });

        it("evaluate passes the exact value to the function", () => {
            const obj = { a: 1 };
            let received;
            const pred = CTGTestPredicates.satisfies(v => {
                received = v;
                return true;
            });
            pred.evaluate(obj);
            expect(received).toBe(obj);
        });

        it("evaluate can check for null specifically", () => {
            const pred = CTGTestPredicates.satisfies(v => v === null);
            expect(pred.evaluate(null)).toBe(true);
            expect(pred.evaluate(undefined)).toBe(false);
        });

        it("evaluate can check for undefined specifically", () => {
            const pred = CTGTestPredicates.satisfies(v => v === undefined);
            expect(pred.evaluate(undefined)).toBe(true);
            expect(pred.evaluate(null)).toBe(false);
        });
    });
});
