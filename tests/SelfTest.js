// Self-test for ctg-js-test — the framework tests itself
//
// Two-tier approach:
//   1. Bootstrap tests — use selfTest() helper with manual checks (no CTGTest assert logic)
//   2. Meta-tests — use CTGTest's own pipelines to validate CTGTest behavior
//
// Bootstrap gates meta-tests: if bootstrap fails, meta-tests are skipped.
// Run via: node tests/SelfTest.js

import CTGTest from "../src/CTGTest.js";
import CTGTestError from "../src/CTGTestError.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestStep from "../src/CTGTestStep.js";
import CTGTestConsoleFormatter from "../src/formatters/CTGTestConsoleFormatter.js";
import CTGTestJsonFormatter from "../src/formatters/CTGTestJsonFormatter.js";
import CTGTestJunitFormatter from "../src/formatters/CTGTestJunitFormatter.js";

process.stdout.write("=== ctg-js-test Self Test ===\n\n");

let allPassed = true;

async function selfTest(label, fn) {
    try {
        const result = await fn();
        if (result === true) {
            process.stdout.write(`  PASS  ${label}\n`);
        } else {
            process.stdout.write(`  FAIL  ${label}\n`);
            if (typeof result === "string") {
                process.stdout.write(`        ${result}\n`);
            }
            allPassed = false;
        }
    } catch (e) {
        process.stdout.write(`  ERROR ${label}\n`);
        process.stdout.write(`        ${e.constructor.name}: ${e.message}\n`);
        allPassed = false;
    }
}

// ── Basic Stage ──────────────────────────────────────────────

await selfTest("stage transforms subject", async () => {
    const r = await CTGTest.init("stage test")
        .stage("double", (x) => x * 2)
        .start(5, { output: "return-json" });
    return r.status === "pass";
});

await selfTest("stage chains transform subject sequentially", async () => {
    const r = await CTGTest.init("chain stages")
        .stage("add 1", (x) => x + 1)
        .stage("double", (x) => x * 2)
        .start(5, { output: "return-json" });
    return r.status === "pass" && r.total === 2;
});

// ── Basic Assert ─────────────────────────────────────────────

await selfTest("assert pass when values match", async () => {
    const r = await CTGTest.init("assert pass")
        .assert("equals 5", (x) => x, 5)
        .start(5, { output: "return-json" });
    return r.status === "pass"
        && r.steps[0].actual === 5
        && r.steps[0].expected === 5;
});

await selfTest("assert fail when values mismatch", async () => {
    const r = await CTGTest.init("assert fail")
        .assert("equals 10", (x) => x, 10)
        .start(5, { output: "return-json" });
    return r.status === "fail"
        && r.steps[0].actual === 5
        && r.steps[0].expected === 10
        && typeof r.steps[0].message === "string"
        && r.steps[0].message.length > 0;
});

await selfTest("assert does not mutate subject", async () => {
    const r = await CTGTest.init("assert no mutate")
        .assert("a", (x) => x, 5)
        .assert("b", (x) => x, 5)
        .start(5, { output: "return-json" });
    return r.status === "pass" && r.total === 2;
});

await selfTest("predicate style assert", async () => {
    const r = await CTGTest.init("predicate")
        .assert("is number", (x) => typeof x === "number", true)
        .start(42, { output: "return-json" });
    return r.status === "pass";
});

// ── Assert with Array Expected (direct comparison) ───────────

await selfTest("assert array expected does direct comparison", async () => {
    const r = await CTGTest.init("array direct")
        .assert("exact match", (x) => x, [1, 2, 3])
        .start([1, 2, 3], { output: "return-json" });
    return r.status === "pass";
});

await selfTest("assert array expected fails when not exact match", async () => {
    const r = await CTGTest.init("array direct fail")
        .assert("exact match", (x) => x, [1, 2, 3])
        .start(2, { output: "return-json" });
    return r.status === "fail";
});

await selfTest("empty array expected matches empty array actual", async () => {
    const r = await CTGTest.init("empty array")
        .assert("empty", (x) => x, [])
        .start([], { output: "return-json" });
    return r.status === "pass";
});

await selfTest("empty array expected fails for non-empty actual", async () => {
    const r = await CTGTest.init("empty array fail")
        .assert("empty", (x) => x, [])
        .start([1, 2], { output: "return-json" });
    return r.status === "fail";
});

// ── AssertAny ────────────────────────────────────────────────

await selfTest("assertAny pass when actual matches a candidate", async () => {
    const r = await CTGTest.init("assertAny pass")
        .assertAny("in set", (x) => x, [1, 2, 3])
        .start(2, { output: "return-json" });
    return r.status === "pass";
});

await selfTest("assertAny fail when actual matches no candidate", async () => {
    const r = await CTGTest.init("assertAny fail")
        .assertAny("not in set", (x) => x, [1, 2, 3])
        .start(99, { output: "return-json" });
    return r.status === "fail";
});

await selfTest("assertAny empty candidates always fails", async () => {
    const r = await CTGTest.init("assertAny empty")
        .assertAny("no candidates", (x) => x, [])
        .start(1, { output: "return-json" });
    return r.status === "fail"
        && r.steps[0].type === "assert-any"
        && typeof r.steps[0].message === "string"
        && r.steps[0].message.length > 0;
});

await selfTest("assertAny result has candidates field", async () => {
    const r = await CTGTest.init("assertAny shape")
        .assertAny("check", (x) => x, [1, 2, 3])
        .start(2, { output: "return-json" });
    return r.steps[0].type === "assert-any"
        && JSON.stringify(r.steps[0].candidates) === JSON.stringify([1, 2, 3])
        && r.steps[0].actual === 2;
});

await selfTest("assertAny does not mutate subject", async () => {
    const r = await CTGTest.init("assertAny no mutate")
        .assertAny("first", (x) => x, [5, 10])
        .assert("still 5", (x) => x, 5)
        .start(5, { output: "return-json" });
    return r.status === "pass" && r.total === 2;
});

await selfTest("assertAny interacts with stage", async () => {
    const r = await CTGTest.init("assertAny pipeline")
        .stage("double", (x) => x * 2)
        .assertAny("in set", (x) => x, [8, 10, 12])
        .start(5, { output: "return-json" });
    return r.status === "pass";
});

await selfTest("assertAny respects strict mode", async () => {
    const strict = await CTGTest.init("assertAny strict")
        .assertAny("type mismatch", (x) => x, ["1", "2"])
        .start(1, { output: "return-json" });
    const loose = await CTGTest.init("assertAny loose")
        .assertAny("type coerce", (x) => x, ["1", "2"])
        .start(1, { output: "return-json", strict: false });
    return strict.status === "fail" && loose.status === "pass";
});

// ── Stage + Assert Pipeline ──────────────────────────────────

await selfTest("stage then assert", async () => {
    const r = await CTGTest.init("pipeline")
        .stage("double", (x) => x * 2)
        .assert("is 10", (x) => x, 10)
        .start(5, { output: "return-json" });
    return r.status === "pass" && r.total === 2;
});

// ── Chain ────────────────────────────────────────────────────

await selfTest("chain composes test definitions", async () => {
    const sub = CTGTest.init("sub").assert("positive", (x) => x > 0, true);
    const r = await CTGTest.init("main")
        .stage("set", () => 42)
        .chain("verify", sub)
        .start(0, { output: "return-json" });
    return r.status === "pass" && r.steps[1].type === "chain";
});

await selfTest("chain mutations carry forward", async () => {
    const sub = CTGTest.init("sub").stage("add 10", (x) => x + 10);
    const r = await CTGTest.init("main")
        .stage("set 5", () => 5)
        .chain("add", sub)
        .assert("is 15", (x) => x, 15)
        .start(0, { output: "return-json" });
    return r.status === "pass";
});

await selfTest("chain name from chain() not init", async () => {
    const sub = CTGTest.init("internal").assert("ok", () => true, true);
    const r = await CTGTest.init("main")
        .chain("my label", sub)
        .start(1, { output: "return-json" });
    return r.steps[0].name === "my label";
});

// ── Skip ─────────────────────────────────────────────────────

await selfTest("skip unconditionally", async () => {
    const r = await CTGTest.init("skip")
        .stage("first", (x) => x + 1)
        .stage("skipped", (x) => x * 100)
        .assert("check", (x) => x, 2)
        .skip("skipped")
        .start(1, { output: "return-json" });
    return r.status === "pass" && r.steps[1].status === "skip" && r.skipped === 1;
});

await selfTest("skip predicate false does not skip", async () => {
    const r = await CTGTest.init("cond skip")
        .stage("maybe", (x) => x)
        .skip("maybe", (x) => x > 10)
        .start(5, { output: "return-json" });
    return r.steps[0].status === "pass";
});

await selfTest("skip predicate true skips", async () => {
    const r = await CTGTest.init("cond skip true")
        .stage("maybe", (x) => x)
        .skip("maybe", (x) => x > 3)
        .start(5, { output: "return-json" });
    return r.steps[0].status === "skip";
});

await selfTest("skip predicate throws produces error with type-specific shape", async () => {
    const r = await CTGTest.init("skip throw")
        .stage("step", (x) => x)
        .skip("step", () => { throw new Error("predicate boom"); })
        .start(1, { output: "return-json" });
    const step = r.steps[0];
    return step.status === "error"
        && step.type === "stage"
        && step.exception !== null
        && step.exception.class === "Error"
        && step.exception.message === "predicate boom"
        && typeof step.duration_ms === "number"
        && step.duration_ms >= 0;
});

await selfTest("skip predicate throws on assert preserves assert shape", async () => {
    const r = await CTGTest.init("skip throw assert")
        .assert("check", (x) => x, 42)
        .skip("check", () => { throw new Error("pred fail"); })
        .start(1, { output: "return-json" });
    const step = r.steps[0];
    return step.status === "error"
        && step.type === "assert"
        && "actual" in step
        && "expected" in step
        && step.exception !== null;
});

await selfTest("skip predicate throws on assertAny preserves assertAny shape", async () => {
    const r = await CTGTest.init("skip throw assertAny")
        .assertAny("multi", (x) => x, [1, 2, 3])
        .skip("multi", () => { throw new Error("pred fail"); })
        .start(1, { output: "return-json" });
    const step = r.steps[0];
    return step.status === "error"
        && step.type === "assert-any"
        && "actual" in step
        && "candidates" in step
        && step.exception !== null
        && step.exception.class === "Error"
        && typeof step.duration_ms === "number"
        && step.duration_ms >= 0;
});

await selfTest("skip predicate throws on chain preserves chain shape", async () => {
    const sub = CTGTest.init("sub").assert("ok", () => true, true);
    const r = await CTGTest.init("skip throw chain")
        .chain("c", sub)
        .skip("c", () => { throw new Error("pred fail"); })
        .start(1, { output: "return-json" });
    const step = r.steps[0];
    return step.status === "error"
        && step.type === "chain"
        && "steps" in step
        && "total" in step
        && step.exception !== null
        && step.exception.class === "Error"
        && typeof step.duration_ms === "number"
        && step.duration_ms >= 0;
});

// ── Error Handling ───────────────────────────────────────────

await selfTest("stage error when fn throws", async () => {
    const r = await CTGTest.init("err")
        .stage("throws", () => { throw new RangeError("boom"); })
        .start(1, { output: "return-json" });
    return r.status === "error" && r.steps[0].exception.class === "RangeError";
});

await selfTest("stage recovery via error handler", async () => {
    const r = await CTGTest.init("recover")
        .stage("recovers", () => { throw new RangeError("boom"); }, () => "recovered")
        .assert("check", (x) => x, "recovered")
        .start(1, { output: "return-json" });
    return r.steps[0].status === "recovered" && r.steps[1].status === "pass";
});

await selfTest("handler throws produces caused_by", async () => {
    const r = await CTGTest.init("dual fail")
        .stage(
            "bad",
            () => { throw new RangeError("original"); },
            () => { throw new TypeError("handler failed"); }
        )
        .start(1, { output: "return-json" });
    return r.steps[0].status === "error"
        && r.steps[0].exception.class === "TypeError"
        && r.steps[0].exception.caused_by.class === "RangeError";
});

await selfTest("assert recovery with matching handler produces recovered", async () => {
    const r = await CTGTest.init("assert recover match")
        .assert("r", () => { throw new RangeError("boom"); }, 42, () => 42)
        .start(1, { output: "return-json" });
    return r.steps[0].status === "recovered";
});

await selfTest("assert recovery with non-matching handler produces fail", async () => {
    const r = await CTGTest.init("assert recover mismatch")
        .assert("r", () => { throw new RangeError("boom"); }, 42, () => 99)
        .start(1, { output: "return-json" });
    return r.steps[0].status === "fail";
});

// ── HaltOnFailure ────────────────────────────────────────────

await selfTest("halt stops at first fail", async () => {
    const r = await CTGTest.init("halt")
        .assert("fails", (x) => x, 999)
        .assert("never", (x) => x, 1)
        .start(1, { output: "return-json" });
    return r.total === 1;
});

await selfTest("no halt collects all", async () => {
    const r = await CTGTest.init("no halt")
        .assert("f1", (x) => x, 999)
        .assert("f2", (x) => x, 888)
        .start(1, { output: "return-json", haltOnFailure: false });
    return r.total === 2 && r.failed === 2;
});

await selfTest("no halt on recovered", async () => {
    const r = await CTGTest.init("no halt recovered")
        .stage("recovers", () => { throw new RangeError("boom"); }, () => "ok")
        .assert("runs", (x) => x, "ok")
        .start(1, { output: "return-json" });
    return r.total === 2 && r.steps[0].status === "recovered";
});

// ── Empty Pipeline ───────────────────────────────────────────

await selfTest("empty pipeline pass zero total", async () => {
    const r = await CTGTest.init("empty").start(null, { output: "return-json" });
    return r.status === "pass" && r.total === 0 && r.steps.length === 0;
});

// ── Strict vs Loose ──────────────────────────────────────────

await selfTest("strict fails on type mismatch", async () => {
    const r = await CTGTest.init("strict")
        .assert("type", (x) => x, "1")
        .start(1, { output: "return-json" });
    return r.status === "fail";
});

await selfTest("loose passes on type coercion", async () => {
    const r = await CTGTest.init("loose")
        .assert("type", (x) => x, "1")
        .start(1, { output: "return-json", strict: false });
    return r.status === "pass";
});

// ── Circular Reference Detection ─────────────────────────────

await selfTest("cyclic object compares successfully in strict mode", async () => {
    const a = { name: "a" };
    const b = { name: "b" };
    a.ref = b;
    b.ref = a;
    const r = await CTGTest.init("cyclic")
        .assert("cmp", (x) => x, a)
        .start(a, { output: "return-json" });
    // Strict mode delegates to util.isDeepStrictEqual which handles cycles correctly
    return r.status === "pass";
});

await selfTest("function in actual produces error", async () => {
    const r = await CTGTest.init("closure")
        .assert("cmp", (x) => x, "anything")
        .start(() => "hello", { output: "return-json" });
    return r.steps[0].status === "error"
        && r.steps[0].exception !== null
        && r.steps[0].exception.class === "CTGTestError";
});

// ── Map/Set Uncomparable ─────────────────────────────────────

await selfTest("Map in actual produces error", async () => {
    const r = await CTGTest.init("map")
        .assert("cmp", (x) => x, "anything")
        .start(new Map([["a", 1]]), { output: "return-json" });
    return r.steps[0].status === "error"
        && r.steps[0].exception !== null
        && r.steps[0].exception.class === "CTGTestError";
});

await selfTest("Set in actual produces error", async () => {
    const r = await CTGTest.init("set")
        .assert("cmp", (x) => x, "anything")
        .start(new Set([1, 2]), { output: "return-json" });
    return r.steps[0].status === "error"
        && r.steps[0].exception !== null
        && r.steps[0].exception.class === "CTGTestError";
});

await selfTest("Map in expected produces error", async () => {
    const r = await CTGTest.init("map expected")
        .assert("cmp", (x) => x, new Map([["a", 1]]))
        .start("anything", { output: "return-json" });
    return r.steps[0].status === "error"
        && r.steps[0].exception !== null
        && r.steps[0].exception.class === "CTGTestError";
});

await selfTest("Set in expected produces error", async () => {
    const r = await CTGTest.init("set expected")
        .assert("cmp", (x) => x, new Set([1, 2]))
        .start("anything", { output: "return-json" });
    return r.steps[0].status === "error"
        && r.steps[0].exception !== null
        && r.steps[0].exception.class === "CTGTestError";
});

// ── CTGTestError Validation ──────────────────────────────────

await selfTest("INVALID_STEP non-callable", async () => {
    try {
        await CTGTest.init("x").stage("bad", "nope").start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_STEP;
    }
});

await selfTest("INVALID_STEP empty name", async () => {
    try {
        await CTGTest.init("x").stage("  ", (x) => x).start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_STEP;
    }
});

await selfTest("INVALID_STEP duplicate name", async () => {
    try {
        await CTGTest.init("x").stage("s", (x) => x).stage("s", (x) => x).start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_STEP;
    }
});

await selfTest("INVALID_STEP empty test name", async () => {
    try {
        await CTGTest.init("  ").start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_STEP;
    }
});

await selfTest("INVALID_CHAIN non-CTGTest", async () => {
    try {
        await CTGTest.init("x").chain("c", "nope").start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_CHAIN;
    }
});

await selfTest("chain exceeding MAX_CHAIN_DEPTH throws INVALID_CHAIN", async () => {
    let inner = CTGTest.init("leaf").assert("ok", () => true, true);
    for (let i = 0; i < 65; i++) {
        const wrapper = CTGTest.init(`depth-${i}`).chain("nested", inner);
        inner = wrapper;
    }
    try {
        await inner.start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError
            && e.code === CTGTestError.ERROR_TYPES.INVALID_CHAIN;
    }
});

await selfTest("INVALID_CONFIG bad key", async () => {
    try {
        await CTGTest.init("x").start(1, { bogus: true });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_CONFIG;
    }
});

await selfTest("INVALID_CONFIG non-boolean for boolean key", async () => {
    try {
        await CTGTest.init("x").start(1, { strict: "yes" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_CONFIG;
    }
});

await selfTest("INVALID_CONFIG invalid output mode", async () => {
    try {
        await CTGTest.init("x").start(1, { output: "invalid" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_CONFIG;
    }
});

await selfTest("INVALID_CONFIG formatter not a constructor", async () => {
    try {
        await CTGTest.init("x")
            .assert("p", (x) => x, 1)
            .start(1, { formatter: 12345 });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_CONFIG;
    }
});

await selfTest("INVALID_CONFIG formatter without static format method", async () => {
    class BadFormatter {}
    try {
        await CTGTest.init("x")
            .assert("p", (x) => x, 1)
            .start(1, { formatter: BadFormatter });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_CONFIG;
    }
});

await selfTest("INVALID_EXPECTED callable expected", async () => {
    try {
        await CTGTest.init("x")
            .assert("a", (x) => x, (v) => v > 0)
            .start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_EXPECTED;
    }
});

await selfTest("INVALID_EXPECTED assertAny non-array expected", async () => {
    try {
        await CTGTest.init("x")
            .assertAny("a", (x) => x, "not an array")
            .start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_EXPECTED;
    }
});

await selfTest("INVALID_SKIP nonexistent target", async () => {
    try {
        await CTGTest.init("x").stage("r", (x) => x).skip("fake").start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_SKIP;
    }
});

await selfTest("INVALID_SKIP duplicate directive", async () => {
    try {
        await CTGTest.init("x").stage("t", (x) => x).skip("t").skip("t").start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_SKIP;
    }
});

await selfTest("INVALID_SKIP non-function predicate", async () => {
    try {
        await CTGTest.init("x").stage("t", (x) => x).skip("t", "not a function").start(1, { output: "return-json" });
        return "no throw";
    } catch (e) {
        return e instanceof CTGTestError && e.code === CTGTestError.ERROR_TYPES.INVALID_SKIP;
    }
});

// ── CTGTestError Lookup ──────────────────────────────────────

await selfTest("lookup string to int", async () =>
    CTGTestError.lookup("INVALID_STEP") === 1000
);

await selfTest("lookup int to string", async () =>
    CTGTestError.lookup(1000) === "INVALID_STEP"
);

await selfTest("lookup unknown string throws TypeError", async () => {
    try {
        CTGTestError.lookup("BOGUS");
        return "no throw";
    } catch (e) {
        return e instanceof TypeError;
    }
});

await selfTest("lookup unknown int throws TypeError", async () => {
    try {
        CTGTestError.lookup(9999);
        return "no throw";
    } catch (e) {
        return e instanceof TypeError;
    }
});

// ── CTGTestError Construction ────────────────────────────────

await selfTest("CTGTestError from string type", async () => {
    const e = new CTGTestError("INVALID_STEP", "bad step", { key: "val" });
    return e.type === "INVALID_STEP"
        && e.code === 1000
        && e.msg === "bad step"
        && e.data.key === "val"
        && e.name === "CTGTestError"
        && e.message === "bad step"
        && e instanceof Error;
});

await selfTest("CTGTestError from numeric code", async () => {
    const e = new CTGTestError(1001, "chain issue");
    return e.type === "INVALID_CHAIN"
        && e.code === 1001
        && e.msg === "chain issue";
});

await selfTest("CTGTestError defaults msg to type name", async () => {
    const e = new CTGTestError("FORMATTER_ERROR");
    return e.msg === "FORMATTER_ERROR"
        && e.data === null;
});

await selfTest("CTGTestError unknown type throws TypeError", async () => {
    try {
        new CTGTestError("BOGUS");
        return "no throw";
    } catch (e) {
        return e instanceof TypeError;
    }
});

// ── CTGTestStep Value Object ─────────────────────────────────

await selfTest("CTGTestStep stores and exposes all fields", async () => {
    const fn = (x) => x;
    const handler = (e) => null;
    const step = new CTGTestStep("assert", "check val", fn, 42, handler);
    return step.type === "assert"
        && step.name === "check val"
        && step.fn === fn
        && step.expected === 42
        && step.errorHandler === handler;
});

await selfTest("CTGTestStep defaults errorHandler to null", async () => {
    const step = new CTGTestStep("stage", "transform", (x) => x, null);
    return step.errorHandler === null;
});

// ── Output Modes ─────────────────────────────────────────────

await selfTest("return mode returns string", async () => {
    const r = await CTGTest.init("ret")
        .assert("p", (x) => x, 1)
        .start(1, { output: "return" });
    return typeof r === "string" && r.includes("ret");
});

await selfTest("return-json returns object", async () => {
    const r = await CTGTest.init("json")
        .assert("p", (x) => x, 1)
        .start(1, { output: "return-json" });
    return typeof r === "object" && r !== null && r.name === "json";
});

await selfTest("return-json with custom formatter returns object not string", async () => {
    const r = await CTGTest.init("custom fmt json")
        .assert("p", (x) => x, 1)
        .start(1, { output: "return-json", formatter: CTGTestJsonFormatter });
    return typeof r === "object" && r !== null && r.name === "custom fmt json" && r.status === "pass";
});

// ── Report Shape ─────────────────────────────────────────────

await selfTest("root has no type field", async () => {
    const r = await CTGTest.init("shape")
        .assert("p", (x) => x, 1)
        .start(1, { output: "return-json" });
    return !("type" in r) && "name" in r && "status" in r && "steps" in r;
});

await selfTest("report has all count fields", async () => {
    const r = await CTGTest.init("counts")
        .assert("p", (x) => x, 1)
        .start(1, { output: "return-json" });
    return "passed" in r && "failed" in r && "skipped" in r
        && "recovered" in r && "errored" in r && "total" in r
        && "duration_ms" in r;
});

// ── Level-Scoped Totals ──────────────────────────────────────

await selfTest("chain counts as one node in parent", async () => {
    const sub = CTGTest.init("s")
        .assert("a", () => true, true)
        .assert("b", () => true, true);
    const r = await CTGTest.init("m")
        .chain("g", sub)
        .assert("c", () => true, true)
        .start(1, { output: "return-json" });
    return r.total === 2 && r.steps[0].total === 2;
});

// ── Trace Config ─────────────────────────────────────────────

await selfTest("trace false omits trace", async () => {
    const r = await CTGTest.init("t")
        .stage("throws", () => { throw new RangeError("boom"); })
        .start(1, { output: "return-json", trace: false });
    return !("trace" in r.steps[0].exception);
});

await selfTest("trace true includes trace", async () => {
    const r = await CTGTest.init("t")
        .stage("throws", () => { throw new RangeError("boom"); })
        .start(1, { output: "return-json", trace: true });
    return "trace" in r.steps[0].exception;
});

// ── Severity Aggregation ─────────────────────────────────────

await selfTest("chain with only recovered = recovered status", async () => {
    const sub = CTGTest.init("s")
        .stage("r1", () => { throw new RangeError("a"); }, () => "ok")
        .stage("r2", () => { throw new RangeError("b"); }, () => "ok");
    const r = await CTGTest.init("m")
        .chain("all recovered", sub)
        .start(1, { output: "return-json", haltOnFailure: false });
    return r.steps[0].status === "recovered";
});

// ── init returns correct type ────────────────────────────────

await selfTest("init returns CTGTest instance", async () => {
    const test = CTGTest.init("test");
    return test instanceof CTGTest;
});

// ── CLI Config Static Methods ────────────────────────────────

await selfTest("setCliConfig/getCliConfig round-trip", async () => {
    const original = CTGTest.getCliConfig();
    CTGTest.setCliConfig({});
    const empty = CTGTest.getCliConfig();
    const config = { output: "json", haltOnFailure: false, strict: true, trace: true };
    CTGTest.setCliConfig(config);
    const retrieved = CTGTest.getCliConfig();
    CTGTest.setCliConfig({ output: "console" });
    const replaced = CTGTest.getCliConfig();
    CTGTest.setCliConfig(original);
    return JSON.stringify(empty) === "{}"
        && JSON.stringify(retrieved) === JSON.stringify(config)
        && JSON.stringify(replaced) === JSON.stringify({ output: "console" });
});

await selfTest("getCliConfig returns empty object when nothing set", async () => {
    const original = CTGTest.getCliConfig();
    CTGTest.setCliConfig({});
    const result = CTGTest.getCliConfig();
    CTGTest.setCliConfig(original);
    return typeof result === "object" && JSON.stringify(result) === "{}";
});

// ── Async Callables (JS-specific) ────────────────────────────

await selfTest("async stage fn is awaited", async () => {
    const r = await CTGTest.init("async stage")
        .stage("delayed", async (x) => {
            return x * 2;
        })
        .assert("is 10", (x) => x, 10)
        .start(5, { output: "return-json" });
    return r.status === "pass";
});

await selfTest("async assert fn is awaited", async () => {
    const r = await CTGTest.init("async assert")
        .assert("delayed check", async (x) => {
            return x;
        }, 42)
        .start(42, { output: "return-json" });
    return r.status === "pass";
});

await selfTest("async error handler is awaited", async () => {
    const r = await CTGTest.init("async handler")
        .stage(
            "throws",
            () => { throw new Error("boom"); },
            async (e) => "recovered-async"
        )
        .assert("check", (x) => x, "recovered-async")
        .start(1, { output: "return-json" });
    return r.steps[0].status === "recovered" && r.steps[1].status === "pass";
});

await selfTest("async skip predicate is awaited", async () => {
    const r = await CTGTest.init("async skip")
        .stage("maybe", (x) => x)
        .skip("maybe", async (x) => x > 3)
        .start(5, { output: "return-json" });
    return r.steps[0].status === "skip";
});

// ── Loose Comparison Edge Cases (JS-specific) ────────────────

await selfTest("loose: NaN equals NaN", async () => {
    const r = await CTGTest.init("nan loose")
        .assert("nan match", (x) => x, NaN)
        .start(NaN, { output: "return-json", strict: false });
    return r.status === "pass";
});

await selfTest("loose: -0 equals 0", async () => {
    const r = await CTGTest.init("neg zero loose")
        .assert("zero match", (x) => x, 0)
        .start(-0, { output: "return-json", strict: false });
    return r.status === "pass";
});

await selfTest("loose: BigInt equals number", async () => {
    const r = await CTGTest.init("bigint loose")
        .assert("bigint match", (x) => x, 42)
        .start(BigInt(42), { output: "return-json", strict: false });
    return r.status === "pass";
});

await selfTest("loose: Date compared via getTime", async () => {
    const d1 = new Date("2025-01-01T00:00:00Z");
    const d2 = new Date("2025-01-01T00:00:00Z");
    const r = await CTGTest.init("date loose")
        .assert("date match", (x) => x, d2)
        .start(d1, { output: "return-json", strict: false });
    return r.status === "pass";
});

await selfTest("loose: RegExp compared via toString", async () => {
    const r = await CTGTest.init("regex loose")
        .assert("regex match", (x) => x, /abc/gi)
        .start(/abc/gi, { output: "return-json", strict: false });
    return r.status === "pass";
});

await selfTest("loose: typed array element-by-element", async () => {
    const r = await CTGTest.init("typed array loose")
        .assert("typed match", (x) => x, new Uint8Array([1, 2, 3]))
        .start(new Uint8Array([1, 2, 3]), { output: "return-json", strict: false });
    return r.status === "pass";
});

await selfTest("loose: nested object with type coercion", async () => {
    const r = await CTGTest.init("nested loose")
        .assert("nested match", (x) => x, { a: "1", b: { c: "2" } })
        .start({ a: 1, b: { c: 2 } }, { output: "return-json", strict: false });
    return r.status === "pass";
});

await selfTest("loose: array index-by-index with length check", async () => {
    const pass = await CTGTest.init("array loose pass")
        .assert("match", (x) => x, ["1", "2"])
        .start([1, 2], { output: "return-json", strict: false });
    const fail = await CTGTest.init("array loose fail")
        .assert("length mismatch", (x) => x, [1, 2, 3])
        .start([1, 2], { output: "return-json", strict: false });
    return pass.status === "pass" && fail.status === "fail";
});

// ── Strict Comparison: NaN ───────────────────────────────────

await selfTest("strict: NaN equals NaN via isDeepStrictEqual", async () => {
    const r = await CTGTest.init("nan strict")
        .assert("nan match", (x) => x, NaN)
        .start(NaN, { output: "return-json" });
    // util.isDeepStrictEqual(NaN, NaN) returns true
    return r.status === "pass";
});

// ── formatValue (CTGTestResult) ──────────────────────────────

await selfTest("formatValue: null", async () =>
    CTGTestResult.formatValue(null) === "null"
);

await selfTest("formatValue: undefined", async () =>
    CTGTestResult.formatValue(undefined) === "null"
);

await selfTest("formatValue: boolean", async () =>
    CTGTestResult.formatValue(true) === "true"
    && CTGTestResult.formatValue(false) === "false"
);

await selfTest("formatValue: integer number", async () =>
    CTGTestResult.formatValue(42) === "42"
);

await selfTest("formatValue: float number", async () =>
    CTGTestResult.formatValue(3.14) === "3.14"
);

await selfTest("formatValue: NaN", async () =>
    CTGTestResult.formatValue(NaN) === "NaN"
);

await selfTest("formatValue: Infinity", async () =>
    CTGTestResult.formatValue(Infinity) === "Infinity"
    && CTGTestResult.formatValue(-Infinity) === "-Infinity"
);

await selfTest("formatValue: BigInt", async () =>
    CTGTestResult.formatValue(BigInt(42)) === "42n"
);

await selfTest("formatValue: string", async () =>
    CTGTestResult.formatValue("hello") === "'hello'"
);

await selfTest("formatValue: array", async () =>
    CTGTestResult.formatValue([1, 2, 3]) === "array(3)"
);

await selfTest("formatValue: Map", async () =>
    CTGTestResult.formatValue(new Map([["a", 1]])) === "Map(1)"
);

await selfTest("formatValue: Set", async () =>
    CTGTestResult.formatValue(new Set([1, 2, 3])) === "Set(3)"
);

await selfTest("formatValue: function", async () =>
    CTGTestResult.formatValue(() => {}) === "[Closure]"
);

await selfTest("formatValue: symbol", async () =>
    CTGTestResult.formatValue(Symbol("test")) === "symbol(test)"
);

await selfTest("formatValue: object", async () =>
    CTGTestResult.formatValue(new RangeError("x")) === "object(RangeError)"
);

await selfTest("formatValue: plain object", async () =>
    CTGTestResult.formatValue({ a: 1 }) === "object(Object)"
);

// ── formatException (CTGTestResult) ──────────────────────────

await selfTest("formatException basic structure", async () => {
    const err = new RangeError("test error");
    const result = CTGTestResult.formatException(err, false);
    return result.class === "RangeError"
        && result.message === "test error"
        && result.code === null
        && !("trace" in result)
        && !("caused_by" in result);
});

await selfTest("formatException with trace", async () => {
    const err = new Error("traced");
    const result = CTGTestResult.formatException(err, true);
    return "trace" in result && typeof result.trace === "string";
});

await selfTest("formatException with caused_by", async () => {
    const inner = CTGTestResult.formatException(new Error("inner"), false);
    const outer = CTGTestResult.formatException(new TypeError("outer"), false, inner);
    return outer.caused_by.class === "Error"
        && outer.caused_by.message === "inner";
});

await selfTest("formatException CTGTestError has numeric code", async () => {
    const err = new CTGTestError("INVALID_STEP", "bad step");
    const result = CTGTestResult.formatException(err, false);
    return result.code === 1000;
});

await selfTest("formatException Node.js error has string code", async () => {
    const err = new Error("no file");
    err.code = "ENOENT";
    const result = CTGTestResult.formatException(err, false);
    return result.code === "ENOENT";
});

await selfTest("formatException missing code is null not 0", async () => {
    const err = new Error("plain");
    const result = CTGTestResult.formatException(err, false);
    return result.code === null;
});

// ── Result Factory Methods (CTGTestResult) ───────────────────

await selfTest("stepResult produces correct shape", async () => {
    const r = CTGTestResult.stepResult("stage", "transform", "pass", 5, null, null);
    return r.type === "stage"
        && r.name === "transform"
        && r.status === "pass"
        && r.duration_ms === 5
        && r.message === null
        && r.exception === null;
});

await selfTest("assertResult produces correct shape", async () => {
    const r = CTGTestResult.assertResult("check", "pass", 3, 42, 42, null, null);
    return r.type === "assert"
        && r.name === "check"
        && r.actual === 42
        && r.expected === 42;
});

await selfTest("assertAnyResult produces correct shape", async () => {
    const r = CTGTestResult.assertAnyResult("multi", "fail", 2, 99, [1, 2, 3], "no match", null);
    return r.type === "assert-any"
        && r.actual === 99
        && JSON.stringify(r.candidates) === JSON.stringify([1, 2, 3]);
});

await selfTest("chainResult produces correct shape", async () => {
    const counts = { passed: 1, failed: 0, skipped: 0, recovered: 0, errored: 0, total: 1 };
    const steps = [CTGTestResult.stepResult("stage", "s", "pass", 1)];
    const r = CTGTestResult.chainResult("grp", "pass", 5, null, null, steps, counts);
    return r.type === "chain"
        && r.name === "grp"
        && r.passed === 1
        && r.total === 1
        && r.steps.length === 1;
});

await selfTest("report assembles root structure", async () => {
    const steps = [
        CTGTestResult.stepResult("stage", "a", "pass", 1),
        CTGTestResult.assertResult("b", "fail", 2, 1, 2, "mismatch"),
    ];
    const r = CTGTestResult.report("my test", steps);
    return r.name === "my test"
        && r.status === "fail"
        && r.passed === 1
        && r.failed === 1
        && r.total === 2
        && !("type" in r);
});

await selfTest("aggregateStatus returns highest severity", async () => {
    const steps = [
        { status: "pass" },
        { status: "recovered" },
        { status: "pass" },
    ];
    return CTGTestResult.aggregateStatus(steps) === "recovered";
});

await selfTest("aggregateStatus empty returns pass", async () =>
    CTGTestResult.aggregateStatus([]) === "pass"
);

await selfTest("countSteps counts by status", async () => {
    const steps = [
        { status: "pass" },
        { status: "fail" },
        { status: "pass" },
        { status: "skip" },
    ];
    const c = CTGTestResult.countSteps(steps);
    return c.passed === 2 && c.failed === 1 && c.skipped === 1
        && c.recovered === 0 && c.errored === 0 && c.total === 4;
});

await selfTest("sumDuration sums duration_ms", async () => {
    const steps = [{ duration_ms: 10 }, { duration_ms: 20 }, { duration_ms: 5 }];
    return CTGTestResult.sumDuration(steps) === 35;
});

await selfTest("chainMessage with failures", async () => {
    const msg = CTGTestResult.chainMessage(2, 1, 5);
    return typeof msg === "string" && msg.includes("2") && msg.includes("1") && msg.includes("5");
});

await selfTest("chainMessage null when no failures", async () =>
    CTGTestResult.chainMessage(0, 0, 3) === null
);

// ── Formatter Unit Tests ─────────────────────────────────────

await selfTest("ConsoleFormatter formats passing report", async () => {
    const report = CTGTestResult.report("console test", [
        CTGTestResult.stepResult("stage", "step1", "pass", 5),
        CTGTestResult.assertResult("assert1", "pass", 3, 42, 42),
    ]);
    const output = CTGTestConsoleFormatter.format(report);
    return typeof output === "string"
        && output.includes("console test")
        && output.includes("step1")
        && output.includes("assert1")
        && output.includes("PASS")
        && output.includes("2 passed");
});

await selfTest("ConsoleFormatter formats failing report", async () => {
    const report = CTGTestResult.report("fail test", [
        CTGTestResult.assertResult("bad", "fail", 1, "got", "want",
            "expected 'want' but got 'got'"),
    ]);
    const output = CTGTestConsoleFormatter.format(report);
    return output.includes("FAIL")
        && output.includes("bad")
        && output.includes("expected 'want' but got 'got'");
});

await selfTest("ConsoleFormatter formats chain with nested steps", async () => {
    const childSteps = [
        CTGTestResult.assertResult("inner", "pass", 1, true, true),
    ];
    const counts = CTGTestResult.countSteps(childSteps);
    const report = CTGTestResult.report("chain test", [
        CTGTestResult.chainResult("my chain", "pass", 2, null, null, childSteps, counts),
    ]);
    const output = CTGTestConsoleFormatter.format(report);
    return output.includes("[chain]")
        && output.includes("my chain")
        && output.includes("inner");
});

await selfTest("ConsoleFormatter formats skip and error", async () => {
    const report = CTGTestResult.report("mixed test", [
        CTGTestResult.stepResult("stage", "skipped", "skip", 0),
        CTGTestResult.stepResult("stage", "errored", "error", 1, "RangeError: boom"),
    ]);
    const output = CTGTestConsoleFormatter.format(report);
    return output.includes("SKIP")
        && output.includes("ERROR")
        && output.includes("1 skipped")
        && output.includes("1 errored");
});

await selfTest("ConsoleFormatter no trailing newline", async () => {
    const report = CTGTestResult.report("newline test", [
        CTGTestResult.stepResult("stage", "s", "pass", 1),
    ]);
    const output = CTGTestConsoleFormatter.format(report);
    return !output.endsWith("\n");
});

await selfTest("JsonFormatter produces valid JSON", async () => {
    const report = CTGTestResult.report("json test", [
        CTGTestResult.assertResult("a", "pass", 1, 1, 1),
    ]);
    const output = CTGTestJsonFormatter.format(report);
    const decoded = JSON.parse(output);
    return decoded.name === "json test"
        && decoded.status === "pass"
        && decoded.total === 1;
});

await selfTest("JsonFormatter includes step details", async () => {
    const report = CTGTestResult.report("detail", [
        CTGTestResult.assertResult("check", "fail", 2, "actual", "expected", "mismatch"),
    ]);
    const output = CTGTestJsonFormatter.format(report);
    const decoded = JSON.parse(output);
    return decoded.steps[0].status === "fail"
        && decoded.steps[0].actual === "actual"
        && decoded.steps[0].expected === "expected"
        && decoded.steps[0].message === "mismatch";
});

await selfTest("JsonFormatter handles BigInt via replacer", async () => {
    const report = CTGTestResult.report("bigint json", [
        CTGTestResult.assertResult("big", "pass", 1, BigInt(42), BigInt(42)),
    ]);
    const output = CTGTestJsonFormatter.format(report);
    const decoded = JSON.parse(output);
    return decoded.steps[0].actual === "42n"
        && decoded.steps[0].expected === "42n";
});

await selfTest("JsonFormatter no trailing newline", async () => {
    const report = CTGTestResult.report("nl", [
        CTGTestResult.stepResult("stage", "s", "pass", 1),
    ]);
    const output = CTGTestJsonFormatter.format(report);
    return !output.endsWith("\n");
});

await selfTest("JunitFormatter produces valid XML", async () => {
    const report = CTGTestResult.report("junit test", [
        CTGTestResult.assertResult("a", "pass", 1, 1, 1),
    ]);
    const output = CTGTestJunitFormatter.format(report);
    return output.includes("<?xml")
        && output.includes("<testsuite")
        && output.includes('name="junit test"')
        && output.includes("<testcase")
        && output.includes('name="a"');
});

await selfTest("JunitFormatter maps failure to failure element", async () => {
    const report = CTGTestResult.report("junit fail", [
        CTGTestResult.assertResult("bad", "fail", 1, "got", "want",
            "expected 'want' but got 'got'"),
    ]);
    const output = CTGTestJunitFormatter.format(report);
    return output.includes("<failure")
        && output.includes("expected &#39;want&#39; but got &#39;got&#39;");
});

await selfTest("JunitFormatter maps error to error element", async () => {
    const report = CTGTestResult.report("junit err", [
        CTGTestResult.stepResult("stage", "broken", "error", 1,
            "RangeError: boom",
            CTGTestResult.formatException(new RangeError("boom"), false)),
    ]);
    const output = CTGTestJunitFormatter.format(report);
    return output.includes("<error")
        && output.includes("RangeError: boom");
});

await selfTest("JunitFormatter maps skip to skipped element", async () => {
    const report = CTGTestResult.report("junit skip", [
        CTGTestResult.stepResult("stage", "skipped", "skip", 0),
    ]);
    const output = CTGTestJunitFormatter.format(report);
    return output.includes("<skipped");
});

await selfTest("JunitFormatter maps recovered to system-out", async () => {
    const report = CTGTestResult.report("junit recover", [
        CTGTestResult.stepResult("stage", "recovered", "recovered", 1,
            "error handler invoked, produced ok",
            CTGTestResult.formatException(new RangeError("original"), false)),
    ]);
    const output = CTGTestJunitFormatter.format(report);
    return output.includes("<system-out");
});

await selfTest("JunitFormatter handles chain as nested testsuite", async () => {
    const childSteps = [
        CTGTestResult.assertResult("inner", "pass", 1, true, true),
    ];
    const counts = CTGTestResult.countSteps(childSteps);
    const report = CTGTestResult.report("junit chain", [
        CTGTestResult.chainResult("sub", "pass", 2, null, null, childSteps, counts),
    ]);
    const output = CTGTestJunitFormatter.format(report);
    const matches = output.match(/<testsuite/g);
    return matches !== null && matches.length === 2
        && output.includes('name="sub"');
});

await selfTest("JunitFormatter includes trace when enabled", async () => {
    const report = CTGTestResult.report("junit trace", [
        CTGTestResult.stepResult("stage", "broken", "error", 1,
            "RangeError: boom",
            CTGTestResult.formatException(new RangeError("boom"), true)),
    ]);
    const output = CTGTestJunitFormatter.format(report, { trace: true });
    return output.includes("at ");
});

await selfTest("JunitFormatter no trailing newline", async () => {
    const report = CTGTestResult.report("nl", [
        CTGTestResult.stepResult("stage", "s", "pass", 1),
    ]);
    const output = CTGTestJunitFormatter.format(report);
    return !output.endsWith("\n");
});

// ── Custom Formatter ─────────────────────────────────────────

await selfTest("custom formatter via config produces output", async () => {
    const r = await CTGTest.init("custom fmt")
        .assert("p", (x) => x, 1)
        .start(1, { output: "return", formatter: CTGTestJsonFormatter });
    const decoded = JSON.parse(r);
    return decoded.name === "custom fmt" && decoded.status === "pass";
});

// ── FORMATTER_ERROR wrapping ─────────────────────────────────

await selfTest("FORMATTER_ERROR constructable with data", async () => {
    const e = new CTGTestError("FORMATTER_ERROR", "test wrap", { key: "val" });
    return e.type === "FORMATTER_ERROR"
        && e.code === 2000
        && e.msg === "test wrap"
        && e.data.key === "val";
});

// ── Debug Config ─────────────────────────────────────────────

await selfTest("debug false (default) omits subject from results", async () => {
    const r = await CTGTest.init("no debug")
        .stage("double", (x) => x * 2)
        .assert("is 10", (x) => x, 10)
        .start(5, { output: "return-json" });
    return !("subject" in r.steps[0])
        && !("subject" in r.steps[1]);
});

await selfTest("debug true adds subject snapshot to stage results", async () => {
    const r = await CTGTest.init("debug stage")
        .stage("double", (x) => x * 2)
        .start(5, { output: "return-json", debug: true });
    return "subject" in r.steps[0]
        && r.steps[0].subject === 5;
});

await selfTest("debug true adds subject snapshot to assert results", async () => {
    const r = await CTGTest.init("debug assert")
        .stage("double", (x) => x * 2)
        .assert("is 10", (x) => x, 10)
        .start(5, { output: "return-json", debug: true });
    return "subject" in r.steps[1]
        && r.steps[1].subject === 10;
});

await selfTest("debug true shows subject before transformation (not after)", async () => {
    const r = await CTGTest.init("debug before")
        .stage("double", (x) => x * 2)
        .stage("add 1", (x) => x + 1)
        .start(5, { output: "return-json", debug: true });
    return r.steps[0].subject === 5
        && r.steps[1].subject === 10;
});

await selfTest("debug handles closures gracefully", async () => {
    const r = await CTGTest.init("debug closure")
        .stage("identity", (x) => x)
        .start(() => "hello", { output: "return-json", debug: true });
    return r.steps[0].subject === "[Closure]";
});

await selfTest("debug handles cyclic objects gracefully", async () => {
    const a = { name: "a" };
    const b = { name: "b" };
    a.ref = b;
    b.ref = a;
    const r = await CTGTest.init("debug cyclic")
        .stage("identity", (x) => x)
        .start(a, { output: "return-json", debug: true, haltOnFailure: false });
    const snap = r.steps[0].subject;
    return typeof snap === "object"
        && snap.__class === "Object"
        && typeof snap.ref === "object"
        && snap.ref.ref === "[Circular: Object]";
});

await selfTest("debug snapshots arrays of scalars correctly", async () => {
    const r = await CTGTest.init("debug array")
        .stage("identity", (x) => x)
        .start([1, "hello", true, null], { output: "return-json", debug: true });
    const snap = r.steps[0].subject;
    return Array.isArray(snap)
        && snap[0] === 1
        && snap[1] === "hello"
        && snap[2] === true
        && snap[3] === null;
});

await selfTest("debug snapshots nested arrays with closures", async () => {
    const r = await CTGTest.init("debug nested")
        .stage("identity", (x) => x)
        .start({ a: 1, fn: () => "x", b: [2, 3] }, { output: "return-json", debug: true });
    const snap = r.steps[0].subject;
    return snap.a === 1
        && snap.fn === "[Closure]"
        && JSON.stringify(snap.b) === JSON.stringify([2, 3]);
});

await selfTest("debug works with chains", async () => {
    const sub = CTGTest.init("sub")
        .stage("add 10", (x) => x + 10);
    const r = await CTGTest.init("debug chain")
        .stage("set 5", () => 5)
        .chain("inner", sub)
        .start(0, { output: "return-json", debug: true });
    return "subject" in r.steps[1]
        && r.steps[1].subject === 5;
});

await selfTest("debug snapshot BigInt converts to string with n suffix", async () => {
    const r = await CTGTest.init("debug bigint")
        .stage("identity", (x) => x)
        .start(BigInt(42), { output: "return-json", debug: true });
    return r.steps[0].subject === "42n";
});

await selfTest("debug snapshot Symbol skipped as key", async () => {
    const sym = Symbol("hidden");
    const obj = { visible: 1 };
    obj[sym] = "secret";
    const r = await CTGTest.init("debug symbol key")
        .stage("identity", (x) => x)
        .start(obj, { output: "return-json", debug: true });
    const snap = r.steps[0].subject;
    return snap.visible === 1
        && !Object.values(snap).includes("secret");
});

await selfTest("debug snapshot non-enumerable properties skipped", async () => {
    const obj = { visible: 1 };
    Object.defineProperty(obj, "hidden", { value: 2, enumerable: false });
    const r = await CTGTest.init("debug non-enum")
        .stage("identity", (x) => x)
        .start(obj, { output: "return-json", debug: true });
    const snap = r.steps[0].subject;
    return snap.visible === 1 && !("hidden" in snap);
});

await selfTest("debug snapshot getter properties skipped", async () => {
    const obj = { visible: 1 };
    Object.defineProperty(obj, "computed", {
        get() { throw new Error("side effect!"); },
        enumerable: true,
    });
    const r = await CTGTest.init("debug getter")
        .stage("identity", (x) => x)
        .start(obj, { output: "return-json", debug: true });
    const snap = r.steps[0].subject;
    return snap.visible === 1 && !("computed" in snap);
});

await selfTest("debug snapshot WeakMap as string", async () => {
    const r = await CTGTest.init("debug weakmap")
        .stage("identity", (x) => x)
        .start(new WeakMap(), { output: "return-json", debug: true });
    return r.steps[0].subject === "[WeakMap]";
});

await selfTest("debug snapshot Promise as string", async () => {
    const r = await CTGTest.init("debug promise")
        .stage("identity", (x) => x)
        .start(Promise.resolve(42), { output: "return-json", debug: true });
    return r.steps[0].subject === "[Promise]";
});

await selfTest("debug snapshot max depth truncates", async () => {
    // Build deeply nested object
    let obj = { val: "leaf" };
    for (let i = 0; i < 150; i++) {
        obj = { nested: obj };
    }
    const r = await CTGTest.init("debug deep")
        .stage("identity", (x) => x)
        .start(obj, { output: "return-json", debug: true });
    // Somewhere in the snapshot, truncation should appear
    const json = JSON.stringify(r.steps[0].subject);
    return json.includes("[Truncated: max depth]");
});

// ── Skipped Step Result Shapes ───────────────────────────────

await selfTest("skipped stage has stepResult shape", async () => {
    const r = await CTGTest.init("skip shape stage")
        .stage("s", (x) => x)
        .skip("s")
        .start(1, { output: "return-json" });
    const step = r.steps[0];
    return step.type === "stage"
        && step.status === "skip"
        && step.duration_ms === 0
        && step.message === null
        && step.exception === null;
});

await selfTest("skipped assert has assertResult shape with null actual", async () => {
    const r = await CTGTest.init("skip shape assert")
        .assert("a", (x) => x, 42)
        .skip("a")
        .start(1, { output: "return-json" });
    const step = r.steps[0];
    return step.type === "assert"
        && step.status === "skip"
        && step.actual === null
        && step.expected === 42;
});

await selfTest("skipped assertAny has assertAnyResult shape with null actual", async () => {
    const r = await CTGTest.init("skip shape assertAny")
        .assertAny("a", (x) => x, [1, 2, 3])
        .skip("a")
        .start(1, { output: "return-json" });
    const step = r.steps[0];
    return step.type === "assert-any"
        && step.status === "skip"
        && step.actual === null
        && JSON.stringify(step.candidates) === JSON.stringify([1, 2, 3]);
});

await selfTest("skipped chain has chainResult shape with empty steps", async () => {
    const sub = CTGTest.init("sub").assert("ok", () => true, true);
    const r = await CTGTest.init("skip shape chain")
        .chain("c", sub)
        .skip("c")
        .start(1, { output: "return-json" });
    const step = r.steps[0];
    return step.type === "chain"
        && step.status === "skip"
        && step.steps.length === 0
        && step.total === 0;
});

// ── Bootstrap Summary ────────────────────────────────────────

process.stdout.write("\n");
if (!allPassed) {
    process.stdout.write("Some bootstrap tests FAILED. Skipping meta-tests.\n");
    process.exit(1);
}
process.stdout.write("All bootstrap tests passed.\n");

// ══════════════════════════════════════════════════════════════
// META-TESTS: CTGTest validates itself through its own pipelines
// ══════════════════════════════════════════════════════════════
//
// These tests use CTGTest pipelines to verify CTGTest behavior.
// The bootstrap tests above are independent of CTGTest's assert
// logic — they use selfTest() with manual comparisons. The meta-
// tests below exercise the framework's own comparison, pipeline
// threading, and report generation by running CTGTest pipelines
// and inspecting their reports. If bootstrap passes but meta-tests
// fail, there is an inconsistency in the framework.

process.stdout.write("\n=== ctg-js-test Meta-Tests (self-validation) ===\n\n");

let metaPassed = true;
let metaTotal = 0;
let metaFailed = 0;

async function metaTest(label, test, subject, expectStatus = "pass") {
    metaTotal++;
    try {
        const r = await test.start(subject, { output: "return-json" });
        if (typeof r !== "object" || r === null) {
            process.stdout.write(`  FAIL  ${label}\n`);
            process.stdout.write(`        expected object report, got ${typeof r}\n`);
            metaPassed = false;
            metaFailed++;
            return;
        }
        if (r.status === expectStatus) {
            process.stdout.write(`  PASS  ${label}\n`);
        } else {
            process.stdout.write(`  FAIL  ${label}\n`);
            process.stdout.write(`        expected status '${expectStatus}', got '${r.status}'\n`);
            metaPassed = false;
            metaFailed++;
        }
    } catch (e) {
        process.stdout.write(`  ERROR ${label}\n`);
        process.stdout.write(`        ${e.constructor.name}: ${e.message}\n`);
        metaPassed = false;
        metaFailed++;
    }
}

// ── Meta: Stage transforms subject ───────────────────────────

await metaTest(
    "meta: stage transforms subject",
    CTGTest.init("meta stage")
        .stage("double", (x) => x * 2)
        .assert("is 10", (x) => x, 10),
    5
);

// ── Meta: Multiple stages chain sequentially ─────────────────

await metaTest(
    "meta: stages chain sequentially",
    CTGTest.init("meta chain stages")
        .stage("add 1", (x) => x + 1)
        .stage("triple", (x) => x * 3)
        .assert("is 18", (x) => x, 18),
    5
);

// ── Meta: Assert compares correctly (pass) ───────────────────

await metaTest(
    "meta: assert pass on match",
    CTGTest.init("meta assert pass")
        .assert("equals 42", (x) => x, 42),
    42
);

// ── Meta: Assert compares correctly (fail) ───────────────────

await metaTest(
    "meta: assert fail on mismatch",
    CTGTest.init("meta assert fail")
        .assert("equals 99", (x) => x, 99),
    1,
    "fail"
);

// ── Meta: Assert fail report detail ──────────────────────────

metaTotal++;
try {
    const failReport = await CTGTest.init("meta fail detail")
        .assert("wrong value", (x) => x, 99)
        .start(1, { output: "return-json" });

    const failCheck = await CTGTest.init("meta fail detail check")
        .assert("step type is assert", (r) => r.steps[0].type, "assert")
        .assert("step status is fail", (r) => r.steps[0].status, "fail")
        .assert("actual is 1", (r) => r.steps[0].actual, 1)
        .assert("expected is 99", (r) => r.steps[0].expected, 99)
        .assert("message is string", (r) => typeof r.steps[0].message, "string")
        .assert("message is non-empty", (r) => r.steps[0].message.length > 0, true)
        .assert("has duration_ms", (r) => typeof r.steps[0].duration_ms, "number")
        .start(failReport, { output: "return-json" });

    if (failCheck.status === "pass") {
        process.stdout.write("  PASS  meta: assert fail report detail\n");
    } else {
        process.stdout.write("  FAIL  meta: assert fail report detail\n");
        for (const step of failCheck.steps) {
            if (step.status !== "pass") {
                process.stdout.write(`        step '${step.name}': ${step.message}\n`);
            }
        }
        metaPassed = false;
        metaFailed++;
    }
} catch (e) {
    process.stdout.write("  ERROR meta: assert fail report detail\n");
    process.stdout.write(`        ${e.constructor.name}: ${e.message}\n`);
    metaPassed = false;
    metaFailed++;
}

// ── Meta: Assert does not mutate subject ─────────────────────

await metaTest(
    "meta: assert does not mutate subject",
    CTGTest.init("meta assert no mutate")
        .assert("first check", (x) => x, 7)
        .assert("second check", (x) => x, 7),
    7
);

// ── Meta: AssertAny matches candidate ────────────────────────

await metaTest(
    "meta: assertAny matches candidate",
    CTGTest.init("meta assertAny pass")
        .assertAny("in set", (x) => x, [10, 20, 30]),
    20
);

// ── Meta: AssertAny fails when no candidate matches ──────────

await metaTest(
    "meta: assertAny fails on no match",
    CTGTest.init("meta assertAny fail")
        .assertAny("not in set", (x) => x, [10, 20, 30]),
    99,
    "fail"
);

// ── Meta: Error recovery via stage handler ───────────────────

await metaTest(
    "meta: error recovery produces recovered status",
    CTGTest.init("meta recover")
        .stage(
            "throws then recovers",
            () => { throw new RangeError("boom"); },
            () => "recovered-value"
        )
        .assert("check recovered", (x) => x, "recovered-value"),
    1,
    "recovered"
);

// ── Meta: Error recovery report detail ───────────────────────

metaTotal++;
try {
    const recoverReport = await CTGTest.init("meta recover detail")
        .stage(
            "throws then recovers",
            () => { throw new RangeError("boom"); },
            () => "recovered-value"
        )
        .start(1, { output: "return-json", trace: false });

    const recoverCheck = await CTGTest.init("meta recover detail check")
        .assert("step type is stage", (r) => r.steps[0].type, "stage")
        .assert("step status is recovered", (r) => r.steps[0].status, "recovered")
        .assert("has exception map", (r) => r.steps[0].exception !== null, true)
        .assert("exception class is RangeError", (r) => r.steps[0].exception.class, "RangeError")
        .assert("exception message is boom", (r) => r.steps[0].exception.message, "boom")
        .assert("exception code is null", (r) => r.steps[0].exception.code, null)
        .assert("has duration_ms", (r) => typeof r.steps[0].duration_ms, "number")
        .start(recoverReport, { output: "return-json" });

    if (recoverCheck.status === "pass") {
        process.stdout.write("  PASS  meta: error recovery report detail\n");
    } else {
        process.stdout.write("  FAIL  meta: error recovery report detail\n");
        for (const step of recoverCheck.steps) {
            if (step.status !== "pass") {
                process.stdout.write(`        step '${step.name}': ${step.message}\n`);
            }
        }
        metaPassed = false;
        metaFailed++;
    }
} catch (e) {
    process.stdout.write("  ERROR meta: error recovery report detail\n");
    process.stdout.write(`        ${e.constructor.name}: ${e.message}\n`);
    metaPassed = false;
    metaFailed++;
}

// ── Meta: Chain composition ──────────────────────────────────

await metaTest(
    "meta: chain composition works",
    CTGTest.init("meta chain outer")
        .stage("set base", () => 10)
        .chain("inner pipeline", CTGTest.init("meta chain inner")
            .stage("add 5", (x) => x + 5)
            .assert("is 15", (x) => x, 15)),
    0
);

// ── Meta: Chain mutations carry forward ──────────────────────

await metaTest(
    "meta: chain mutations carry forward",
    CTGTest.init("meta chain carry")
        .stage("set 100", () => 100)
        .chain("modify", CTGTest.init("sub")
            .stage("halve", (x) => Math.trunc(x / 2)))
        .assert("is 50", (x) => x, 50),
    0
);

// ── Meta: Chain report detail ────────────────────────────────

metaTotal++;
try {
    const chainReport = await CTGTest.init("meta chain detail")
        .stage("set base", () => 10)
        .chain("inner", CTGTest.init("sub")
            .assert("is 10", (x) => x, 10))
        .start(0, { output: "return-json" });

    const chainCheck = await CTGTest.init("meta chain detail check")
        .assert("chain step type", (r) => r.steps[1].type, "chain")
        .assert("chain step name", (r) => r.steps[1].name, "inner")
        .assert("chain has nested steps", (r) => Array.isArray(r.steps[1].steps), true)
        .assert("chain nested count", (r) => r.steps[1].steps.length, 1)
        .assert("chain total", (r) => r.steps[1].total, 1)
        .assert("chain passed", (r) => r.steps[1].passed, 1)
        .assert("chain has duration_ms", (r) => typeof r.steps[1].duration_ms, "number")
        .assert("parent total is 2", (r) => r.total, 2)
        .start(chainReport, { output: "return-json" });

    if (chainCheck.status === "pass") {
        process.stdout.write("  PASS  meta: chain report detail\n");
    } else {
        process.stdout.write("  FAIL  meta: chain report detail\n");
        for (const step of chainCheck.steps) {
            if (step.status !== "pass") {
                process.stdout.write(`        step '${step.name}': ${step.message}\n`);
            }
        }
        metaPassed = false;
        metaFailed++;
    }
} catch (e) {
    process.stdout.write("  ERROR meta: chain report detail\n");
    process.stdout.write(`        ${e.constructor.name}: ${e.message}\n`);
    metaPassed = false;
    metaFailed++;
}

// ── Meta: Stage then assertAny pipeline ──────────────────────

await metaTest(
    "meta: stage then assertAny pipeline",
    CTGTest.init("meta stage assertAny")
        .stage("square", (x) => x * x)
        .assertAny("in squares", (x) => x, [1, 4, 9, 16, 25]),
    4
);

// ── Meta: Strict mode rejects type mismatch ──────────────────

await metaTest(
    "meta: strict comparison rejects type mismatch",
    CTGTest.init("meta strict")
        .assert("type mismatch", (x) => x, "1"),
    1,
    "fail"
);

// ── Meta: Report shape validation ────────────────────────────

metaTotal++;
try {
    const innerReport = await CTGTest.init("meta shape inner")
        .stage("transform", (x) => x + 1)
        .assert("check", (x) => x, 6)
        .start(5, { output: "return-json" });

    const shapeTest = await CTGTest.init("meta report shape")
        .assert("has name", (r) => "name" in r, true)
        .assert("has status", (r) => "status" in r, true)
        .assert("has steps", (r) => "steps" in r, true)
        .assert("has no type at root", (r) => "type" in r, false)
        .assert("has total", (r) => "total" in r, true)
        .assert("has passed count", (r) => "passed" in r, true)
        .assert("name matches", (r) => r.name, "meta shape inner")
        .assert("status is pass", (r) => r.status, "pass")
        .assert("total is 2", (r) => r.total, 2)
        .start(innerReport, { output: "return-json" });

    if (shapeTest.status === "pass") {
        process.stdout.write("  PASS  meta: report shape validation\n");
    } else {
        process.stdout.write("  FAIL  meta: report shape validation\n");
        for (const step of shapeTest.steps) {
            if (step.status !== "pass") {
                process.stdout.write(`        step '${step.name}': ${step.message}\n`);
            }
        }
        metaPassed = false;
        metaFailed++;
    }
} catch (e) {
    process.stdout.write("  ERROR meta: report shape validation\n");
    process.stdout.write(`        ${e.constructor.name}: ${e.message}\n`);
    metaPassed = false;
    metaFailed++;
}

// ── Meta: haltOnFailure false collects all steps ─────────────

metaTotal++;
try {
    const noHaltReport = await CTGTest.init("meta no halt")
        .assert("f1", (x) => x, 999)
        .assert("f2", (x) => x, 888)
        .start(1, { output: "return-json", haltOnFailure: false });

    const noHaltCheck = await CTGTest.init("meta no halt check")
        .assert("total is 2", (r) => r.total, 2)
        .assert("failed is 2", (r) => r.failed, 2)
        .assert("status is fail", (r) => r.status, "fail")
        .assert("step 0 type is assert", (r) => r.steps[0].type, "assert")
        .assert("step 0 status is fail", (r) => r.steps[0].status, "fail")
        .assert("step 0 has actual", (r) => r.steps[0].actual, 1)
        .assert("step 0 has expected", (r) => r.steps[0].expected, 999)
        .assert("step 1 type is assert", (r) => r.steps[1].type, "assert")
        .assert("step 1 status is fail", (r) => r.steps[1].status, "fail")
        .assert("step 1 has actual", (r) => r.steps[1].actual, 1)
        .assert("step 1 has expected", (r) => r.steps[1].expected, 888)
        .start(noHaltReport, { output: "return-json" });

    if (noHaltCheck.status === "pass") {
        process.stdout.write("  PASS  meta: haltOnFailure false collects all\n");
    } else {
        process.stdout.write("  FAIL  meta: haltOnFailure false collects all\n");
        for (const step of noHaltCheck.steps) {
            if (step.status !== "pass") {
                process.stdout.write(`        step '${step.name}': ${step.message}\n`);
            }
        }
        metaPassed = false;
        metaFailed++;
    }
} catch (e) {
    process.stdout.write("  ERROR meta: haltOnFailure false collects all\n");
    process.stdout.write(`        ${e.constructor.name}: ${e.message}\n`);
    metaPassed = false;
    metaFailed++;
}

// ── Meta: Async pipeline works end-to-end ────────────────────

await metaTest(
    "meta: async stage and assert",
    CTGTest.init("meta async")
        .stage("async double", async (x) => x * 2)
        .assert("is 10", async (x) => x, 10),
    5
);

// ── Meta Summary ─────────────────────────────────────────────

const metaPassedCount = metaTotal - metaFailed;
process.stdout.write("\n");
process.stdout.write(`Meta-tests: ${metaPassedCount}/${metaTotal} passed.\n`);

if (!metaPassed) {
    process.stdout.write("Some meta-tests FAILED — framework inconsistency detected.\n");
    process.exit(1);
}
process.stdout.write("All meta-tests passed.\n");

// ── Final Summary ────────────────────────────────────────────

process.stdout.write("\n=== All tests passed (bootstrap + meta) ===\n");
process.exit(0);
