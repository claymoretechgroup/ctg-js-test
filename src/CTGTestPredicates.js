import { isDeepStrictEqual } from "node:util"; // Deep strict equality comparison
import CTGTestPredicate from "./CTGTestPredicate.js"; // Predicate type

// Convenience predicate builders. Each static method returns a CTGTestPredicate
// instance. These are the extension surface for new comparison modes — the
// pipeline never changes; new comparison behavior is a new predicate.
export default class CTGTestPredicates {

    /**
     *
     * Static Methods
     *
     */

    // :: * -> ctgTestPredicate
    // Deep-strict-equality via node:util isDeepStrictEqual.
    static equals(expected) {
        return CTGTestPredicate.init(
            expected,
            (value) => isDeepStrictEqual(value, expected)
        );
    }

    // :: * -> ctgTestPredicate
    // Deep-strict-inequality.
    static notEquals(expected) {
        return CTGTestPredicate.init(
            expected,
            (value) => !isDeepStrictEqual(value, expected)
        );
    }

    // :: VOID -> ctgTestPredicate
    // Value is VOID (null or undefined).
    static isVoid() {
        return CTGTestPredicate.init(
            undefined,
            (value) => value === null || value === undefined
        );
    }

    // :: VOID -> ctgTestPredicate
    // Value is not VOID (not null and not undefined).
    static isNotVoid() {
        return CTGTestPredicate.init(
            undefined,
            (value) => value !== null && value !== undefined
        );
    }

    // :: VOID -> ctgTestPredicate
    // Value is truthy.
    static isTruthy() {
        return CTGTestPredicate.init(
            true,
            (value) => !!value
        );
    }

    // :: VOID -> ctgTestPredicate
    // Value is falsy.
    static isFalsy() {
        return CTGTestPredicate.init(
            false,
            (value) => !value
        );
    }

    // :: VOID -> ctgTestPredicate
    // Value === true.
    static isTrue() {
        return CTGTestPredicate.init(
            true,
            (value) => value === true
        );
    }

    // :: VOID -> ctgTestPredicate
    // Value === false.
    static isFalse() {
        return CTGTestPredicate.init(
            false,
            (value) => value === false
        );
    }

    // :: (* -> *) -> ctgTestPredicate
    // Value is an instance of the given constructor function.
    static isInstanceOf(constructor) {
        return CTGTestPredicate.init(
            constructor,
            (value) => value instanceof constructor
        );
    }

    // :: STRING -> ctgTestPredicate
    // typeof value === type.
    static isType(type) {
        return CTGTestPredicate.init(
            type,
            (value) => typeof value === type
        );
    }

    // :: * -> ctgTestPredicate
    // Value > expected.
    static greaterThan(expected) {
        return CTGTestPredicate.init(
            expected,
            (value) => value > expected
        );
    }

    // :: * -> ctgTestPredicate
    // Value < expected.
    static lessThan(expected) {
        return CTGTestPredicate.init(
            expected,
            (value) => value < expected
        );
    }

    // :: STRING -> ctgTestPredicate
    // String value includes the expected substring.
    static contains(expected) {
        return CTGTestPredicate.init(
            expected,
            (value) => typeof value === "string" && value.includes(expected)
        );
    }

    // :: RegExp -> ctgTestPredicate
    // Value matches the given regex.
    // NOTE: Resets lastIndex before each test to avoid stateful regex bugs
    // with g/y flags that would cause alternating true/false on repeated calls.
    static matchesPattern(pattern) {
        return CTGTestPredicate.init(
            pattern,
            (value) => { pattern.lastIndex = 0; return pattern.test(value); }
        );
    }

    // :: INT -> ctgTestPredicate
    // Array, string, or iterable has the expected length/size.
    // Checks .length first (arrays, strings), then .size (Map, Set),
    // then counts via iteration for custom iterables.
    static hasLength(expected) {
        return CTGTestPredicate.init(
            expected,
            (value) => {
                if (value == null) return false;
                if (typeof value.length === "number") return value.length === expected;
                if (typeof value.size === "number") return value.size === expected;
                if (typeof value[Symbol.iterator] === "function") {
                    let count = 0;
                    for (const _ of value) count++;
                    return count === expected;
                }
                return false;
            }
        );
    }

    // :: [*] -> ctgTestPredicate
    // Computed value deep-equals any candidate.
    static anyOf(candidates) {
        return CTGTestPredicate.init(
            candidates,
            (value) => candidates.some(c => isDeepStrictEqual(value, c))
        );
    }

    // :: (* -> BOOL) -> ctgTestPredicate
    // Custom predicate from a function. expectedOutcome is "*".
    static satisfies(fn) {
        return CTGTestPredicate.init(
            "*",
            fn
        );
    }
}
