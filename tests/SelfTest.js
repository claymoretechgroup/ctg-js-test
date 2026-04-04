// ctg-js-test v2 Self Test
//
// Test suite script that both tests the framework AND demonstrates
// the v2 runner contract from §1:
//
// 1. Run pipelines via start(), receive CTGTestState
// 2. Format output with formatter utilities
// 3. Collect results in a caller-owned collector
// 4. Exit code based on canonical rule: fail/error = 1, else 0
//
// The bootstrap harness (test/assert helpers) tests lower-level
// contracts that can't use the framework to test itself. The runner
// section at the bottom exercises the full v2 contract.
//
// Run: node tests/SelfTest.js

import CTGTestConsoleFormatter from "../src/formatters/CTGTestConsoleFormatter.js";

// ── Pipeline Categories ─────────────────────────────────────────

import runState from "./pipelines/state.js";
import runStepContract from "./pipelines/stepContract.js";
import runStageStep from "./pipelines/stageStep.js";
import runAssertStep from "./pipelines/assertStep.js";
import runAssertAnyStep from "./pipelines/assertAnyStep.js";
import runChainStep from "./pipelines/chainStep.js";
import runSkipStep from "./pipelines/skipStep.js";
import runPipelineExecution from "./pipelines/pipelineExecution.js";
import runResultCollection from "./pipelines/resultCollection.js";
import runRunnerContract from "./pipelines/runnerContract.js";

// ── Bootstrap Harness ───────────────────────────────────────────
// Simple test/assert helpers for testing contracts that can't use
// the framework to test itself (e.g., CTGTestState, CTGTestStep base).

let allPassed = true;
let totalTests = 0;
let totalPassed = 0;

async function test(label, fn) {
    totalTests++;
    try {
        await fn();
        totalPassed++;
        process.stdout.write(`  PASS  ${label}\n`);
    } catch (err) {
        allPassed = false;
        process.stdout.write(`  FAIL  ${label}\n`);
        process.stdout.write(`        ${err.message}\n`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

const harness = { test, assert };

// ── Run Bootstrap Tests ─────────────────────────────────────────

process.stdout.write("=== ctg-js-test v2 Self Test ===\n\n");

process.stdout.write("── CTGTestState ──\n");
await runState(harness);

process.stdout.write("\n── Step Contract ──\n");
await runStepContract(harness);

process.stdout.write("\n── Stage Step ──\n");
await runStageStep(harness);

process.stdout.write("\n── Assert Step ──\n");
await runAssertStep(harness);

process.stdout.write("\n── AssertAny Step ──\n");
await runAssertAnyStep(harness);

process.stdout.write("\n── Chain Step ──\n");
await runChainStep(harness);

process.stdout.write("\n── Skip Step ──\n");
await runSkipStep(harness);

process.stdout.write("\n── Pipeline Execution ──\n");
await runPipelineExecution(harness);

process.stdout.write("\n── Result Collection ──\n");
await runResultCollection(harness);

process.stdout.write("\n── Runner Contract ──\n");
await runRunnerContract(harness);

// ── Runner Contract: Collect, Format, Exit ──────────────────────
// This section IS the runner contract — it uses the framework's own
// pipelines to demonstrate caller-owned collection, formatting, and
// exit code logic.

import CTGTest from "../src/CTGTest.js";

const collector = [];

// Run a passing pipeline
const passState = await CTGTest.init("runner: passing pipeline")
    .assert("check", (state) => state.subject, 42)
    .start(42);

// Format with formatter utility
const formatted = CTGTestConsoleFormatter.format(passState);
process.stdout.write("\n── Runner Contract Demo ──\n");
process.stdout.write(formatted + "\n");

// Collect
collector.push({ name: passState.name, status: passState.status });

// Run a pipeline with recovery (should not cause exit 1)
const recoveredState = await CTGTest.init("runner: recovered pipeline")
    .stage("recover", () => { throw new Error("boom"); },
        (err) => err.message)
    .start(null);
collector.push({ name: recoveredState.name, status: recoveredState.status });

// ── Exit Code ───────────────────────────────────────────────────
// Canonical rule: fail/error = exit 1, everything else = exit 0.
// Check both bootstrap results and collector.

const collectorFailed = collector.some(
    (r) => r.status === "fail" || r.status === "error"
);

process.stdout.write(`\n=== Bootstrap: ${totalPassed}/${totalTests} passed ===\n`);
process.stdout.write(`=== Collector: ${collector.length} pipelines, ${collectorFailed ? "FAILED" : "all clear"} ===\n`);
process.exit(allPassed && !collectorFailed ? 0 : 1);
