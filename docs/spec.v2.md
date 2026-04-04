# ctg-js-test v2 — Specification

**Status:** Draft

---

## Motivation

v1 shipped CTGTest as a monolith — pipeline definition, execution, orchestration,
result collection, delivery, and config management all live on one class. This
worked for the initial implementation but created problems as the framework grew:

1. **Static result accumulator (`_results`)** — Global mutable state. Every
   `start()` call pushed to it regardless of context. When self-tests ran inner
   pipelines inside stages to verify error behavior, intentional failures leaked
   into the global accumulator and caused false exit-code failures.

2. **Step type ownership** — Step types are defined as static Sets on pipeline
   classes (`CTGTest.VALID_STEP_TYPES`, `CTGReactTest.STEP_TYPES`,
   `CTGBrowserTest.STEP_TYPES`). CTGTestStep — the value object that carries
   the type — has no knowledge of what types are valid. Naming is inconsistent
   across classes. The type field serves as both a label and an execution
   dispatch key, conflating two concerns.

3. **Reporting** — Result construction, error-to-result mapping, delivery, and
   formatting are spread across CTGTest, CTGTestResult, and formatter classes
   with no clear ownership boundary. Error handling methods on CTGTest are
   really result construction logic.

4. **Responsibility overload** — CTGTest is ~850 lines with ~40 methods spanning
   6 concerns: pipeline definition, config, validation, execution, error
   handling/recovery, and comparison.

5. **Naming collision** — `_snapshotSubject` (debug-mode subject state capture)
   shares the "snapshot" term with CTGReactTest's `snapshot` step type (DOM
   snapshot comparison). These are unrelated concepts.

---

## 1. Result Collection

Replaces `static _results` with caller-owned result collection.

### `start()` API

`start()` returns the final CTGTestState (see §5). The pipeline does not
publish results, choose output formats, or write to stdout. The caller
receives the state and decides what to do with it.

```javascript
const state = await CTGTest.init("my test")
    .assert("check", (state) => state.subject, 42)
    .start(5, config);

// Caller owns publication, formatting, delivery
const status = state.status; // aggregate status from results
collector.push({ name: state.name, status });
```

### Removed from v1

- `static _results` — removed entirely
- `collector` and `publishResult` config keys — not needed; the caller
  collects results from the returned state
- `setCliConfig` / `getCliConfig` — removed; config is passed directly to
  `start()`, no static singleton
- `_deliver` — removed from CTGTest; delivery is a caller concern
- `output`, `formatter` config keys — removed from CTGTest; formatting is
  a caller concern

### Runner Contract

The pipeline does not own formatting, delivery, or result publication. These
are caller concerns. A test suite script (the runner) receives state from
`start()` and handles output:

```javascript
// Test suite script
const state = await pipeline.start(subject, config);

// Format
const formatted = CTGTestConsoleFormatter.format(state);

// Deliver
process.stdout.write(formatted + "\n");

// Collect for exit code
collector.push({ name: state.name, status: state.status });
```

The formatter classes (`CTGTestConsoleFormatter`, `CTGTestJsonFormatter`,
`CTGTestJunitFormatter`) remain as utilities. They accept a CTGTestState
object (not the v1 report object) and return a formatted string. They are
not referenced by CTGTest — the caller imports and uses them directly.

### Exit Code Rule

A test suite script exits with code `1` if any pipeline's state has a status
of `"fail"` or `"error"`. All other statuses (`"pass"`, `"recovered"`,
`"skip"`) are non-failing. This is the canonical rule — scripts may be
stricter but not more lenient.

### Removed from v1

- `bin/ctg-test` — removed. The generic runner required static state
  (`_results`, `setCliConfig`) to bridge with test files it could not
  directly call. Each project writes its own test suite script instead.

---

## 2. Polymorphic Step Types

**Problem (v1):** Step types are string labels on a passive data object
(CTGTestStep). The pipeline class owns a static Set of valid types, validates
them in `_validateStepDefinitions`, and dispatches execution through a switch
statement in `_executeSteps`. This means:

- The step carries a type but has no knowledge of what types are valid.
- The type serves as both a label and a dispatch key — two concerns on one
  field.
- Adding a step type requires modifying the pipeline class: adding to the
  type set, adding a case to the switch, adding an `_execute*` method, and
  adding error handling methods for that type's result shape.
- Subclasses (CTGReactTest, CTGBrowserTest) must override `_executeSteps`
  and `_validateStepDefinitions` with larger switch statements.
- The relationship between a step type and what is actually being tested is
  not clear from the type alone.

**Specification:** Steps are polymorphic — each step type is a subclass of
CTGTestStep that carries its own execution and validation behavior.

```javascript
class CTGAssertStep extends CTGTestStep {
    validate() { ... }
    async execute(state) { ... }
}
```

### Pipeline Execution

The pipeline sequences steps and evaluates outcomes. Steps compute values.
The pipeline decides whether the outcome is correct (comparison), records
results on state, and controls flow (halt, skip).

```javascript
let state = initialState;
for (const step of steps) {
    state = await step.execute(state);
    // pipeline evaluates outcome: compare, record result, check halt
}
```

The switch statement in `_executeSteps` is eliminated. New step types do not
require modifying the pipeline class.

### Step Contract

Each step subclass implements:

| Method | Description |
|--------|-------------|
| `validate()` | Validates the step definition (e.g., fn is callable, expected is not a function). Throws `CTGTestError` on failure. |
| `execute(state)` | Computes a value against the state. Returns the state. Does not evaluate correctness — that is the pipeline's concern. |

Steps carry their own configuration (including error handlers) set at
construction time. `execute(state)` is the only execution contract.

The base CTGTestStep class defines the contract. Concrete step types implement
it.

### Separation of Concerns

- **Step** — computes a value against state, returns state
- **Pipeline** — sequences steps, evaluates outcomes (comparison), records
  results, controls flow (halt, skip)
- **State** — carries the subject, results, and config through the pipeline
- **Formatter/Reporter** — transforms the final state into output

Not every step produces a value to compare. A `stage` step transforms the
subject — no comparison. An `assert` step produces an actual value — the
pipeline compares it to the expected value. A `skip` step evaluates a
predicate — the pipeline uses it for flow control. Comparison is a pipeline
concern, not a step concern.

### Step-to-Pipeline Data Handoff

Steps communicate their computed values to the pipeline through the state
object. Each step type sets a well-known field on state that the pipeline
reads after execution:

- **stage** — updates `state.subject` with the transformed value
- **assert** — sets `state.actual` with the computed value; the pipeline
  compares `state.actual` against the step's `expected` value
- **assert-any** — same as assert; the pipeline compares against the
  step's candidate list
- **skip** — sets `state.skipTargets[targetName]` to the predicate result;
  the pipeline checks this before executing the named target step
- **chain** — the chained pipeline executes with the current `state.subject`.
  The outer pipeline merges the chained pipeline's results into
  `state.results` as a nested entry and updates `state.subject` with the
  chained pipeline's final subject. Outer config and prior results are
  preserved.

The pipeline reads these fields, evaluates the outcome, and records the
result on `state.results`. The step does not know whether it passed or
failed.

### Step Type Registration

Pipeline classes define which step types they support by providing builder
methods that construct the appropriate step subclass:

```javascript
// CTGTest provides: stage(), assert(), assertAny(), chain(), skip()
// CTGReactTest adds: render(), interact(), snapshot(), renderHook()
// CTGBrowserTest adds: navigate(), pageInteract(), screenshotAssert(), mock()
```

The builder methods are the registration mechanism — if a pipeline class has
a method for it, the step type is supported. No static Set of type strings
needed.

### Builder Callback Signatures

v1 callbacks receive the raw subject. v2 callbacks receive CTGTestState.
This is a breaking change from v1.

```javascript
// stage :: STRING, (CTGTestState -> CTGTestState), FUNCTION? -> this
// Callback transforms state. Returns state.
.stage("setup", (state) => { state.subject = state.subject * 2; return state; })

// assert :: STRING, (CTGTestState -> *), *, FUNCTION? -> this
// Callback computes an actual value from state. Pipeline compares to expected.
.assert("check", (state) => state.subject, 42)

// assertAny :: STRING, (CTGTestState -> *), [*], FUNCTION? -> this
// Same as assert, pipeline compares against candidate list.
.assertAny("check", (state) => state.subject, [41, 42, 43])

// chain :: STRING, CTGTest -> this
// No callback. Inlines the chained pipeline's steps.
.chain("sub-pipeline", otherPipeline)

// skip :: STRING, STRING, (CTGTestState -> BOOL)? -> this
// Predicate receives state. Returns true to skip target step.
.skip("skip check", "check", (state) => state.subject < 0)
```

The optional error handler parameter on `stage`, `assert`, and `assertAny`
receives the error, not the state. This is unchanged from v1.

### Composition

`chain` is the only composition step type. It inlines another pipeline's
steps, threading the subject through and nesting results. This is composition
with data flow — the output of one pipeline feeds into the next.

Running independent pipelines that don't share a subject (e.g., a test suite)
is not a step type concern. That is sequential execution managed by the test
suite script.

### Skip

Skip is a step type. It takes a predicate and a reference to a target step
by name. When it executes, it evaluates the predicate against the current
state and determines whether the target step should execute. The semantics
are the same as v1 — "skip this step if this condition is true" — but skip
participates in the pipeline as a step rather than being a separate directive
list.

#### Ordering and Targeting Rules

- Skip must appear before its target in the pipeline. A skip referencing a
  step that appears earlier or does not exist fails validation.
- A step may have at most one skip targeting it. Duplicate skip directives
  for the same target fail validation.
- Skip is scoped to the pipeline it is defined in. A skip cannot target a
  step inside a chained pipeline.
- If the predicate is null, the skip is unconditional.

### Downstream Subclasses

How CTGReactTest and CTGBrowserTest adapt to polymorphic steps is outside the
scope of this spec. This spec defines CTGTest, CTGTestStep, and the core step
types (`stage`, `assert`, `assert-any`, `chain`, `skip`).

---

## 3. Reporting

**Problem (v1):** Reporting is spread across three layers with no clear
ownership:

- **CTGTestResult** — static factory methods that construct result shapes
  (`stepResult`, `assertResult`, `chainResult`, `report`, `formatValue`,
  `formatException`). Pure data construction.
- **CTGTest error handling methods** — 6 methods that produce type-specific
  result objects. Tightly coupled to both step types and CTGTestResult shapes.
- **CTGTest `_deliver`** — takes a report and decides where it goes (console,
  return, JSON, JUnit) by selecting a formatter and writing to stdout.
- **Formatter classes** — `CTGTestConsoleFormatter`, `CTGTestJsonFormatter`,
  `CTGTestJunitFormatter` — render reports into output strings.

**Specification:** With the separation defined in §2, the pipeline evaluates
outcomes and records results on state. Result construction (via CTGTestResult
factories) is a pipeline concern — the pipeline knows what happened and
builds the appropriate result shape.

`_deliver` moves off CTGTest. The pipeline returns the final state. Delivery
(choosing a formatter, writing to stdout) is a caller concern — either the
test suite script or the bin process handles it. The pipeline does not know
about output modes or formatters.

### Result Flow

```
step.execute(state)
  → computes value, returns state

pipeline evaluates outcome
  → compares actual vs expected (for assert steps)
  → records result on state via CTGTestResult factories

pipeline.start(subject, config)
  → returns final state (containing all results)

caller (test suite script / bin process)
  → receives state
  → formats and delivers (console, JSON, JUnit, etc.)
  → publishes to collector if applicable
```

---

## 4. Responsibility Decomposition

With the design defined in §2 and §3, CTGTest's responsibilities are:

- **Pipeline definition** — builder methods (`stage`, `assert`, etc.) that
  construct step instances and append them to the step list
- **Sequencing** — `start()` loops over steps, calls `execute()`, threads
  state
- **Outcome evaluation** — comparison, error handling, result recording
- **Config** — `_resolveConfig`, `_validateConfig`

Steps own computation. The pipeline owns judgment (comparison, pass/fail),
flow control (halt, skip), and result recording. Formatters own delivery.
State is the shared data structure that flows through all of them.

---

## 5. Pipeline State

The pipeline threads a mutable state object through steps. Each step receives
the current state, operates on it, and returns it (potentially modified). One
object flows through the entire pipeline — no copies, no immutability.

### CTGTestState

A formal class that carries:
- The current subject
- Accumulated step results
- Config

`start()` normalizes the input — if the caller passes a raw value, it is
wrapped in a CTGTestState. If the caller passes a CTGTestState instance
(or subclass), it is used directly:

```javascript
// Raw value — wrapped in CTGTestState with value as subject
await test.start(5, config);

// State instance — used as-is
await test.start(new CTGBrowserTestState({ page, browser, context }), config);
```

Steps always receive a CTGTestState (or subclass). The pipeline does not
need to know which subclass — it calls `step.execute(state)` uniformly.

### Domain-Specific State

Domain-specific testing contexts extend CTGTestState:

- **CTGReactTestState** — adds screen, user, container, rerender
- **CTGBrowserTestState** — adds page, browser, context

These replace the current ReactContext and BrowserContext subject wrappers.
The state *is* the subject — domain-specific state classes add the fields
their steps need.

This is outside the scope of this spec (see §2, Downstream Subclasses) but
the base CTGTestState is designed to be extended.

After all steps execute, the state object contains everything needed to
produce a report. Formatters and reporters operate on the state directly.

### Debug and Observation

v1 uses `_snapshotSubject` (a deep-copy utility) to capture subject state
before each step in debug mode. This is expensive, conflates naming with
CTGReactTest's `snapshot` step type, and bakes observation into the pipeline.

With mutable state, observation becomes an optional concern. A step event
hook (e.g., `onStep`) could allow callers to observe state changes during
execution without the pipeline owning snapshot logic. This is a consideration
for future work — the hook mechanism should be designed based on actual use
cases rather than speculated upfront.

For v2, `_snapshotSubject` is removed. Debug mode is deferred until the
observation mechanism is designed.
