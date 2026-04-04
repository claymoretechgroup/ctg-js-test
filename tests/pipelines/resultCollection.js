// Result collection tests — §1 Result Collection, §3 Reporting
//
// Tests that start() returns CTGTestState, no static state exists,
// and the caller owns reporting/formatting.

import CTGTest from "../../src/CTGTest.js";
import CTGTestState from "../../src/CTGTestState.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── start() Returns State ───────────────────────────────────

    await test("result: start returns CTGTestState", async () => {
        const state = await CTGTest.init("returns state")
            .assert("check", (state) => state.subject, 5)
            .start(5);
        assert(state instanceof CTGTestState, "state is CTGTestState");
    });

    await test("result: returned state has results", async () => {
        const state = await CTGTest.init("has results")
            .assert("first", (state) => state.subject, 5)
            .assert("second", (state) => state.subject, 5)
            .start(5);
        assert(state.results.length === 2, "two results");
    });

    await test("result: returned state has status", async () => {
        const state = await CTGTest.init("has status")
            .assert("check", (state) => state.subject, 5)
            .start(5);
        assert(state.status === "pass", "status is pass");
    });

    await test("result: returned state has name", async () => {
        const state = await CTGTest.init("my pipeline name")
            .stage("noop", (state) => state)
            .start(null);
        assert(state.name === "my pipeline name", "name preserved");
    });

    // ── No Static State ─────────────────────────────────────────

    await test("result: CTGTest has no static _results", () => {
        assert(CTGTest._results === undefined, "no _results field");
    });

    await test("result: CTGTest has no setCliConfig", () => {
        assert(CTGTest.setCliConfig === undefined, "no setCliConfig");
    });

    await test("result: CTGTest has no getCliConfig", () => {
        assert(CTGTest.getCliConfig === undefined, "no getCliConfig");
    });

    // ── Removed Config Keys ────────────────────────────────────

    await test("result: output config key rejected", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { output: "console" });
        } catch {
            threw = true;
        }
        assert(threw, "output rejected");
    });

    await test("result: formatter config key rejected", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { formatter: null });
        } catch {
            threw = true;
        }
        assert(threw, "formatter rejected");
    });

    await test("result: collector config key rejected", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { collector: [] });
        } catch {
            threw = true;
        }
        assert(threw, "collector rejected");
    });

    await test("result: trace config key rejected", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { trace: true });
        } catch {
            threw = true;
        }
        assert(threw, "trace rejected");
    });

    await test("result: debug config key rejected", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { debug: true });
        } catch {
            threw = true;
        }
        assert(threw, "debug rejected");
    });

    await test("result: publishResult config key rejected", async () => {
        let threw = false;
        try {
            await CTGTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { publishResult: false });
        } catch {
            threw = true;
        }
        assert(threw, "publishResult rejected");
    });

    // ── No Delivery on Pipeline ─────────────────────────────────

    await test("result: start does not write to stdout", async () => {
        const origWrite = process.stdout.write;
        let written = false;
        process.stdout.write = () => { written = true; return true; };
        try {
            await CTGTest.init("silent")
                .assert("check", (state) => state.subject, 5)
                .start(5);
        } finally {
            process.stdout.write = origWrite;
        }
        assert(!written, "nothing written to stdout");
    });

    // ── Caller-Owned Collection ─────────────────────────────────

    await test("result: caller collects from returned state", async () => {
        const collector = [];

        const state1 = await CTGTest.init("first")
            .assert("check", (state) => state.subject, 5)
            .start(5);
        collector.push({ name: state1.name, status: state1.status });

        const state2 = await CTGTest.init("second")
            .assert("check", (state) => state.subject, 99)
            .start(5, { haltOnFailure: false });
        collector.push({ name: state2.name, status: state2.status });

        assert(collector.length === 2, "two entries");
        assert(collector[0].status === "pass", "first passed");
        assert(collector[1].status === "fail", "second failed");
    });

    // ── Inner Pipeline Does Not Pollute Caller ──────────────────

    await test("result: inner pipeline state is independent", async () => {
        const collector = [];

        const state = await CTGTest.init("outer")
            .stage("run inner", async (state) => {
                // Inner pipeline — its state is separate
                const innerState = await CTGTest.init("inner fixture")
                    .assert("bad", (s) => s.subject, 99)
                    .start(5, { haltOnFailure: false });
                // Caller decides whether to collect inner results
                state.subject = innerState.status;
                return state;
            })
            .assert("inner failed", (state) => state.subject, "fail")
            .start(null);

        collector.push({ name: state.name, status: state.status });

        assert(collector.length === 1, "only outer collected");
        assert(collector[0].status === "pass", "outer passed");
    });
}
