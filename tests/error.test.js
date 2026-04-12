import { describe, it, expect } from "vitest";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md section 2.6 — CTGTestError
// realizes: Error Semantics > The Framework Error Class
// realizes: Error Semantics > Canonical Error Types

// Complete canonical error type table from the spec
const CANONICAL_TYPES = {
    INVALID_OPERATION:      1000,
    INVALID_CHAIN:          1001,
    INVALID_CONFIG:         1002,
    INVALID_EXPECTED_OUTCOME: 1003,
    INVALID_SKIP:           1004,
    FORMATTER_ERROR:        2000,
    RUNNER_ERROR:           2001,
    CHAIN_DEPTH_EXCEEDED:   1100,
};

describe("CTGTestError", () => {

    describe("extends native Error", () => {

        it("is an instance of Error", () => {
            const err = new CTGTestError("INVALID_OPERATION");
            expect(err).toBeInstanceOf(Error);
        });

        it("is an instance of CTGTestError", () => {
            const err = new CTGTestError("INVALID_OPERATION");
            expect(err).toBeInstanceOf(CTGTestError);
        });

        it("has a stack trace", () => {
            const err = new CTGTestError("INVALID_OPERATION");
            expect(typeof err.stack).toBe("string");
            expect(err.stack.length).toBeGreaterThan(0);
        });
    });

    describe("constructor with type name (string)", () => {

        it("sets type from string argument", () => {
            const err = new CTGTestError("INVALID_OPERATION");
            expect(err.type).toBe("INVALID_OPERATION");
        });

        it("resolves code from type name", () => {
            const err = new CTGTestError("INVALID_OPERATION");
            expect(err.code).toBe(1000);
        });

        it("sets message from second argument", () => {
            const err = new CTGTestError("INVALID_OPERATION", "bad stage fn");
            expect(err.msg).toBe("bad stage fn");
        });

        it("defaults message to the type name when omitted", () => {
            const err = new CTGTestError("INVALID_OPERATION");
            expect(err.msg).toBe("INVALID_OPERATION");
        });

        it("sets data from third argument", () => {
            const payload = { detail: "extra info" };
            const err = new CTGTestError("INVALID_OPERATION", "msg", payload);
            expect(err.data).toBe(payload);
        });

        it("data defaults to undefined when not provided", () => {
            const err = new CTGTestError("INVALID_OPERATION", "msg");
            expect(err.data).toBe(undefined);
        });

        it("data defaults to undefined when only type is provided", () => {
            const err = new CTGTestError("INVALID_OPERATION");
            expect(err.data).toBe(undefined);
        });
    });

    describe("constructor with numeric code (integer)", () => {

        it("sets code from integer argument", () => {
            const err = new CTGTestError(1000);
            expect(err.code).toBe(1000);
        });

        it("resolves type from numeric code", () => {
            const err = new CTGTestError(1000);
            expect(err.type).toBe("INVALID_OPERATION");
        });

        it("sets message from second argument", () => {
            const err = new CTGTestError(1000, "bad stage fn");
            expect(err.msg).toBe("bad stage fn");
        });

        it("defaults message to the resolved type name when omitted", () => {
            const err = new CTGTestError(1000);
            expect(err.msg).toBe("INVALID_OPERATION");
        });

        it("sets data from third argument", () => {
            const payload = [1, 2, 3];
            const err = new CTGTestError(1000, "msg", payload);
            expect(err.data).toBe(payload);
        });

        it("data defaults to undefined when not provided", () => {
            const err = new CTGTestError(1000, "msg");
            expect(err.data).toBe(undefined);
        });
    });

    describe("bidirectional resolution — all canonical types", () => {

        for (const [name, code] of Object.entries(CANONICAL_TYPES)) {

            it(`${name} (${code}): construct by name resolves code`, () => {
                const err = new CTGTestError(name);
                expect(err.type).toBe(name);
                expect(err.code).toBe(code);
            });

            it(`${name} (${code}): construct by code resolves name`, () => {
                const err = new CTGTestError(code);
                expect(err.type).toBe(name);
                expect(err.code).toBe(code);
            });
        }
    });

    describe("properties are getters", () => {

        it("type is a string", () => {
            const err = new CTGTestError("INVALID_CONFIG");
            expect(typeof err.type).toBe("string");
        });

        it("code is an integer", () => {
            const err = new CTGTestError("INVALID_CONFIG");
            expect(typeof err.code).toBe("number");
            expect(Number.isInteger(err.code)).toBe(true);
        });

        it("msg is a string", () => {
            const err = new CTGTestError("INVALID_CONFIG", "bad key");
            expect(typeof err.msg).toBe("string");
        });

        it("data can be any type", () => {
            const err1 = new CTGTestError("INVALID_CONFIG", "msg", 42);
            expect(err1.data).toBe(42);

            const err2 = new CTGTestError("INVALID_CONFIG", "msg", "text");
            expect(err2.data).toBe("text");

            const arr = [1, 2];
            const err3 = new CTGTestError("INVALID_CONFIG", "msg", arr);
            expect(err3.data).toBe(arr);

            const err4 = new CTGTestError("INVALID_CONFIG", "msg", null);
            expect(err4.data).toBe(null);

            const err5 = new CTGTestError("INVALID_CONFIG", "msg", false);
            expect(err5.data).toBe(false);
        });
    });

    describe("native Error message property", () => {

        it("message property matches msg when provided", () => {
            const err = new CTGTestError("INVALID_OPERATION", "custom message");
            expect(err.message).toBe("custom message");
        });

        it("message property defaults to type name when msg omitted", () => {
            const err = new CTGTestError("INVALID_OPERATION");
            expect(err.message).toBe("INVALID_OPERATION");
        });
    });

    describe("static lookup", () => {

        it("string input returns the numeric code", () => {
            expect(CTGTestError.lookup("INVALID_OPERATION")).toBe(1000);
        });

        it("integer input returns the type name", () => {
            expect(CTGTestError.lookup(1000)).toBe("INVALID_OPERATION");
        });

        for (const [name, code] of Object.entries(CANONICAL_TYPES)) {

            it(`lookup("${name}") returns ${code}`, () => {
                expect(CTGTestError.lookup(name)).toBe(code);
            });

            it(`lookup(${code}) returns "${name}"`, () => {
                expect(CTGTestError.lookup(code)).toBe(name);
            });
        }

        it("throws TypeError for unknown string key", () => {
            expect(() => CTGTestError.lookup("NOT_A_TYPE")).toThrow(TypeError);
        });

        it("throws TypeError for unknown integer code", () => {
            expect(() => CTGTestError.lookup(9999)).toThrow(TypeError);
        });
    });

    describe("edge cases", () => {

        it("data can be explicitly set to undefined", () => {
            const err = new CTGTestError("INVALID_CHAIN", "msg", undefined);
            expect(err.data).toBe(undefined);
        });

        it("data can be set to 0", () => {
            const err = new CTGTestError("INVALID_CHAIN", "msg", 0);
            expect(err.data).toBe(0);
        });

        it("data can be set to empty string", () => {
            const err = new CTGTestError("INVALID_CHAIN", "msg", "");
            expect(err.data).toBe("");
        });

        it("message can be empty string", () => {
            const err = new CTGTestError("INVALID_CHAIN", "");
            expect(err.msg).toBe("");
        });

        it("CHAIN_DEPTH_EXCEEDED resolves bidirectionally like canonical types", () => {
            const byName = new CTGTestError("CHAIN_DEPTH_EXCEEDED");
            expect(byName.code).toBe(1100);

            const byCode = new CTGTestError(1100);
            expect(byCode.type).toBe("CHAIN_DEPTH_EXCEEDED");
        });

        it("can be thrown and caught", () => {
            expect(() => {
                throw new CTGTestError("RUNNER_ERROR", "runner failed");
            }).toThrow(CTGTestError);
        });

        it("caught error preserves all properties", () => {
            const data = { context: "test" };
            try {
                throw new CTGTestError("RUNNER_ERROR", "runner failed", data);
            } catch (err) {
                expect(err.type).toBe("RUNNER_ERROR");
                expect(err.code).toBe(2001);
                expect(err.msg).toBe("runner failed");
                expect(err.data).toBe(data);
            }
        });
    });
});
