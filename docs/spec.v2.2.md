# ctg-js-test v2.2 — Language-Specific Specification

**Realizes:** `test-design-doc.v2.2.md` (language-agnostic design document)
**Supersedes:** `spec.v2.md`
**Target:** JavaScript (ES modules, Node.js)
**Code Style:** `ctg-project-proc/code-styles/js-code-style.md`

---

## 1. Realization Map

| Design Doc Primitive | JS Realization | Notes |
|---|---|---|
| `STATE` | `CTGTestState` | Mutable state with `subject`, `computed`, `results` |
| `PREDICATE` | `CTGTestPredicate` | Object with `expectedOutcome` and `evaluate()` |
| `PIPELINE` | `CTGTest` | Pipeline builder and executor; stores operations internally |
| `RESULT` | `CTGTestResult` | Value object; fields match design doc exactly |
| `STATUS` | `CTGTestResult.STATUS` | Frozen object: integer codes with string label lookup |
| `FRAMEWORK_ERROR` | `CTGTestError` | Extends `Error`; typed codes, bidirectional lookup |
| `CONFIG` | Plain object | `{ haltOnFailure: BOOL, timeout: INT }` — no class needed |
| `ERROR` (primitive) | `Error` | JavaScript's native error type |
| `VOID` (primitive) | `undefined` | JavaScript's native absence-of-value |
| `FORMATTER` | `CTGTestConsoleFormatter`, `CTGTestJsonFormatter` | Static `format(state)` methods |

**No STEP row.** The design doc removes STEP as a primitive type. The
pipeline stores operations internally — how it represents them is an
implementation concern. There is no public `CTGTestStep` class.

> **Judgment Call — CONFIG as plain object, not a class:** CONFIG has
> exactly two keys with stable defaults and no behavior. A class would
> add ceremony without value. The pipeline validates the object and
> rejects unknown keys.

> **Judgment Call — STATUS as frozen object with integer codes:**
> JavaScript lacks native enums. A frozen object with integer values
> (`Object.freeze({ PASS: 0, FAIL: 1, ERROR: 2 })`) provides stable
> identifiers decoupled from display labels. Comparison is always by
> integer (`result.status === STATUS.PASS`). A separate
> `STATUS_LABELS` map provides string labels for formatters. This
> decoupling means display labels can change without breaking
> comparisons.

> **Judgment Call — STEP removed from realization map:** The design
> doc says: "PIPELINE stores the operations registered via its builder
> methods internally. How the pipeline represents those operations —
> closures, tagged records, parallel arrays, or any other structure —
> is an implementation concern." There is no public CTGTestStep class.
> No external code creates, inspects, or extends individual operation
> representations.

---

## 2. Public Surface

### 2.1 CTGTestState

```
realizes: Core Semantics > Primitives > STATE
```

```
CTGTestState :: { subject: *, label: STRING }? => {
    subject:  *,
    computed: * | VOID,
    results:  [CTGTestResult],
    label:    STRING
}
```

#### Constructor

```
// CONSTRUCTOR :: { subject: *, label: STRING }? -> this
```

Accepts an optional object with `subject` and `label`. Fields not
provided are initialized to empty/unset values:

- `subject` — the value under test. Default `undefined`.
- `computed` — the value produced by the most recent assert
  operation's callable, deposited here for the pipeline to read.
  Default `undefined`. Reset before each operation executes.
- `results` — ordered array of `CTGTestResult` instances. Default `[]`.
- `label` — pipeline label, set by `start()`. Default `""`.

#### Properties

```
// GETTER :: VOID -> STRING
get label

// GETTER :: VOID -> *
get subject

// :: * -> VOID
set subject

// GETTER :: VOID -> *
get computed

// :: * -> VOID
set computed

// GETTER :: VOID -> [CTGTestResult]
get results

// GETTER :: VOID -> INT
// Aggregate status derived from results. Not stored — computed on access.
get status
```

#### Instance Methods

```
// :: CTGTestResult -> VOID
// Appends a result to the results array.
addResult(result)
```

#### Static Factory

```
// Static Factory Method :: STRING, * -> ctgTestState
static init(label, subject)
```

#### Domain Extension

`CTGTestState` is designed to be extended by domain-specific testing
contexts (e.g., a React test state adds `screen`, `user`, `container`;
a browser test state adds `page`, `browser`, `context`). `start()`
accepts any `CTGTestState` subclass instance directly — if the caller
passes a `CTGTestState` (or subclass), it is used as-is; if the
caller passes a raw value, it is wrapped in a new `CTGTestState`.

> **Judgment Call — `label` not `name`:** The design doc uses `label`
> throughout for pipeline and step identification. The v2.0
> implementation used `name`. This spec follows the design doc. This
> is a breaking change from v2.0.

> **Judgment Call — `addResult` takes CTGTestResult, not plain
> object:** v2.0 pushed plain objects to the results array. v2.2
> uses typed `CTGTestResult` instances. This enforces structural
> correctness.

> **Judgment Call — pipeline label on STATE:** The design doc's
> formatter contract is `STATE -> OUTPUT`, meaning formatters receive
> only STATE. The reference formatter output starts with the pipeline
> label. To satisfy the contract without passing the pipeline alongside
> state, STATE carries the pipeline label. `start()` sets it. This
> keeps the `STATE -> OUTPUT` contract pure.

---

### 2.2 CTGTestResult

```
realizes: Core Semantics > Primitives > RESULT
```

```
CTGTestResult :: {
    label:           [STRING],
    skipped:         BOOL,
    status:          INT | VOID,
    computedValue:   * | VOID,
    expectedOutcome: * | VOID,
    error:           Error | VOID
}
```

Result objects are `CTGTestResult` instances constructed by static
factory methods. The constructor is not part of the public API —
results are created by the framework only.

#### Fields

| Field | Type | VOID when | Populated when |
|---|---|---|---|
| `label` | `[STRING]` | never — always present | always |
| `skipped` | `BOOL` | n/a | always |
| `status` | `INT \| VOID` | `undefined` when `skipped === true` | when operation ran |
| `computedValue` | `* \| VOID` | `undefined` for stage results and skipped results | assert results |
| `expectedOutcome` | `* \| VOID` | `undefined` for stage results and skipped results | assert results |
| `error` | `Error \| VOID` | `undefined` unless status is ERROR | ERROR status |

#### STATUS Constants

```javascript
CTGTestResult.STATUS = Object.freeze({
    PASS:  0,
    FAIL:  1,
    ERROR: 2
});

CTGTestResult.STATUS_LABELS = Object.freeze({
    0: "pass",
    1: "fail",
    2: "error"
});

CTGTestResult.SEVERITY = Object.freeze({
    2: 3,  // ERROR — worst
    1: 2,  // FAIL
    0: 1   // PASS
});
```

Comparison is always by integer (`result.status === STATUS.PASS`).
Formatters use `STATUS_LABELS[status]` for display. `SEVERITY` is
used by `aggregateStatus` to determine the worst status across
results.

```
// :: INT -> STRING
// Resolves a status code to its display label.
static statusLabel(code)
```

#### Static Factory Methods

```
// Static Factory Method :: [STRING], INT, Error? -> ctgTestResult
// Creates a stage result (PASS or ERROR).
static stageResult(label, status, error?)

// Static Factory Method :: [STRING], INT, *, *, Error? -> ctgTestResult
// Creates an assert result (PASS, FAIL, or ERROR).
static assertResult(label, status, computedValue, expectedOutcome, error?)

// Static Factory Method :: [STRING] -> ctgTestResult
// Creates a skipped result (any operation type).
static skippedResult(label)
```

#### Utility Methods

```
// :: [CTGTestResult] -> INT
// Worst status from results: ERROR > FAIL > PASS. Empty list returns STATUS.PASS.
static aggregateStatus(results)

// :: [CTGTestResult] -> { passed: INT, failed: INT, errored: INT, skipped: INT, total: INT }
static countResults(results)

// :: [CTGTestResult] -> INT
static sumDuration(results)

// :: * -> STRING
// Human-readable serialization of any value.
static formatValue(value)

// :: Error, BOOL, OBJECT? -> OBJECT
// Structured serialization of an exception.
static formatException(exception, includeTrace, causedBy?)
```

> **Judgment Call — no `type` field:** The design doc's RESULT has no
> `type` field (no `"stage"`, `"assert"`, etc.). v2.0 had `type`; v2.2
> drops it. A result's meaning is determined by which fields are
> populated (stage results have `undefined` for `computedValue`/
> `expectedOutcome`; assert results have them populated).

> **Judgment Call — no `durationMs` field:** The design doc RESULT has
> no duration field. v2.0 had `durationMs`. v2.2 drops it from the
> core result. If an implementation wants timing, it can be added as
> an extension field on a result subclass, but it is not part of the
> canonical result shape.

> **Judgment Call — no `message` field:** The design doc RESULT has no
> message field. Diagnostic information lives in the `error` field
> (which carries the full `Error` instance). Formatters extract
> messages from `error.message` and `error.stack` per host-language
> convention.

> **Judgment Call — CTGTestResult as a class, not plain objects:**
> v2.0 used plain objects for results. Using a class with factory
> methods enforces the six-field structure and prevents ad-hoc field
> additions. The fields are read-only after construction.

---

### 2.3 CTGTestPredicate

```
realizes: Core Semantics > Primitives > PREDICATE
```

```
CTGTestPredicate :: expectedOutcome : *, evaluate : (* -> BOOL) => {
    expectedOutcome: *,
    evaluate:        * -> BOOL
}
```

A predicate carries an expected outcome (for diagnostics) and an
evaluation function. Assert operations receive a predicate instance —
not a raw value. The pipeline calls `predicate.evaluate(state.computed)`
after the assert operation deposits its computed value on state.

#### Constructor

```
// CONSTRUCTOR :: *, (* -> BOOL) -> this
```

Private. Use `init()`.

- `expectedOutcome` — the value the predicate is checking against.
  Stored for diagnostic purposes — formatters display it in failure
  messages.
- `evaluate` — a function that receives the computed value and returns
  `true` (PASS) or `false` (FAIL).

#### Properties

```
// GETTER :: VOID -> *
get expectedOutcome

// GETTER :: VOID -> (* -> BOOL)
get evaluate
```

#### Static Factory

```
// Static Factory Method :: *, (* -> BOOL) -> ctgTestPredicate
static init(expectedOutcome, evaluate)
```

#### Validation

Passing a non-`CTGTestPredicate` instance as the third argument to
`assert()` throws `INVALID_EXPECTED_OUTCOME` (code 1003). This
catches the most dangerous case — passing a bare callable — which
would be ambiguous with a predicate and is almost always a programmer
error. Raw values are not coerced or auto-wrapped.

> **Judgment Call — class, not plain object:** `instanceof` validation
> (for `INVALID_EXPECTED_OUTCOME`) requires a class or constructor.
> The class also provides a natural home for the `init` factory. Not
> `final` — domain extensions may subclass for richer predicate types.

---

### 2.4 CTGTestPredicates (Convenience Builders)

```
realizes: Core Concepts > 4. Assert Is the Only Correctness Primitive
realizes: Left to Language-Specific Specs > Convenience builders
```

A separate class with static factory methods. Each builder constructs
a `CTGTestPredicate` instance with an appropriate `expectedOutcome`
and `evaluate` function.

```
// :: * -> ctgTestPredicate
// Deep-strict-equality via node:util isDeepStrictEqual.
static equals(expected)

// :: * -> ctgTestPredicate
// Deep-strict-inequality.
static notEquals(expected)

// :: VOID -> ctgTestPredicate
// Value is VOID (null or undefined).
static isVoid()

// :: VOID -> ctgTestPredicate
// Value is not VOID (not null and not undefined).
static isNotVoid()

// :: VOID -> ctgTestPredicate
// Value is truthy.
static isTruthy()

// :: VOID -> ctgTestPredicate
// Value is falsy.
static isFalsy()

// :: VOID -> ctgTestPredicate
// Value === true.
static isTrue()

// :: VOID -> ctgTestPredicate
// Value === false.
static isFalse()

// :: (* -> *) -> ctgTestPredicate
// Value is an instance of the given constructor function.
static isInstanceOf(constructor)

// :: STRING -> ctgTestPredicate
// typeof value === type.
static isType(type)

// :: * -> ctgTestPredicate
// Value > expected.
static greaterThan(expected)

// :: * -> ctgTestPredicate
// Value < expected.
static lessThan(expected)

// :: STRING -> ctgTestPredicate
// String value includes the expected substring.
static contains(expected)

// :: RegExp -> ctgTestPredicate
// Value matches the given regex.
static matchesPattern(pattern)

// :: INT -> ctgTestPredicate
// Array or iterable has the expected length.
static hasLength(expected)

// :: [*] -> ctgTestPredicate
// Computed value deep-equals any candidate.
static anyOf(candidates)

// :: (* -> BOOL) -> ctgTestPredicate
// Custom predicate from a function. expectedOutcome is "*".
static satisfies(fn)
```

**Example implementations:**

```javascript
static equals(expected) {
    return CTGTestPredicate.init(
        expected,
        (value) => isDeepStrictEqual(value, expected)
    );
}

static isVoid() {
    return CTGTestPredicate.init(
        undefined,
        (value) => value === null || value === undefined
    );
}

static contains(expected) {
    return CTGTestPredicate.init(
        expected,
        (value) => typeof value === "string" && value.includes(expected)
    );
}

static anyOf(candidates) {
    return CTGTestPredicate.init(
        candidates,
        (value) => candidates.some(c => isDeepStrictEqual(value, c))
    );
}

static satisfies(fn) {
    return CTGTestPredicate.init(
        "*",
        fn
    );
}
```

> **Judgment Call — separate class, not methods on CTGTestPredicate:**
> Follows the PHP pattern. `CTGTestPredicate` is the type;
> `CTGTestPredicates` (plural) is the convenience builder library.
> Keeps the primitive type clean and the convenience surface
> independently extensible.

> **Judgment Call — `isVoid` not `isNull`:** JavaScript has both
> `null` and `undefined`. The design doc maps VOID to the host
> language's absence-of-value. In JS, both `null` and `undefined`
> represent absence. `isVoid` checks both, aligning with the design
> doc's VOID concept rather than JS-specific null/undefined
> distinctions. Users who need to distinguish use
> `satisfies(v => v === null)` or `satisfies(v => v === undefined)`.

> **Judgment Call — `anyOf` replaces `assertAny`:** v2.0 had
> `assertAny()` as a pipeline builder method and `AssertAnyStep` as a
> step subclass. With predicates, "match any of several" is a
> predicate concern. `CTGTestPredicates.anyOf([a, b, c])` replaces
> `.assertAny("name", fn, [a, b, c])`.

> **Judgment Call — `equals` uses `isDeepStrictEqual`:** The PHP spec
> uses `===` (strict identity). JavaScript's `===` does not handle
> deep object comparison. `node:util.isDeepStrictEqual` is the
> standard library equivalent of PHP's `===` for structured values.

> **Judgment Call — `satisfies` uses `"*"` as expectedOutcome:**
> When a user provides an arbitrary function, the expected outcome is
> unconstrained. `"*"` is the notation for "any type" per the code
> style guide, signaling to formatters that the predicate accepts any
> value that satisfies the function.

---

### 2.5 CTGTest (Pipeline)

```
realizes: Core Semantics > Primitives > PIPELINE
realizes: Core Semantics > Procedures > STAGE, ASSERT, CHAIN, SKIP, START
```

```
CTGTest :: label : STRING => {
    label:      STRING,
    operations: [INTERNAL]   // private — not exposed
}
```

#### Constructor and Factory

```
// CONSTRUCTOR :: STRING -> this
// Private — use init().
constructor(label)

// Static Factory Method :: STRING -> ctgTest
static init(label)
```

`label` is trimmed on construction. Empty label after trimming is
rejected during validation in `start()`.

#### Properties

```
// GETTER :: VOID -> STRING
get label
```

**No `getSteps()` or `getOperations()`.** The operation list is
internal. No external code creates, inspects, or extends individual
operation representations.

#### Builder Methods (Fluent)

All builder methods return `this` for chaining. Arguments that require
validation are not type-checked at the call site — validation is
deferred to `start()` so that all errors surface as canonical
framework errors, not native `TypeError`s.

```
// :: STRING:label, (CTGTestState -> *:subject) -> this
// Appends a stage operation. The handler returns the new subject value.
// realizes: Core Semantics > Procedures > STAGE
stage(label, fn)

// :: STRING:label, (CTGTestState -> *:computed), CTGTestPredicate -> this
// Appends an assert operation. The handler returns the computed value.
// The pipeline deposits it on state.computed, then calls predicate.evaluate().
// realizes: Core Semantics > Procedures > ASSERT
assert(label, fn, predicate)

// :: STRING:label, CTGTest -> this
// Appends a chain operation. Runs the sub-pipeline against the same state.
// realizes: Core Semantics > Procedures > CHAIN
chain(label, pipeline)

// :: STRING:targetLabel, (CTGTestState -> BOOL)? -> this
// Appends a skip directive. Gates the target operation by label.
// realizes: Core Semantics > Procedures > SKIP
skip(targetLabel, condition?)
```

> **Judgment Call — stage handler returns value, not state:** The
> design doc specifies `STAGE :: STRING:label, (STATE -> *:subject)`.
> The handler receives state and returns a value. The framework writes
> the return value to `state.subject`. v2.0 had the handler receive
> and return the entire state object. This spec follows the design
> doc. Rationale: the handler transforms the subject, it shouldn't
> need to know about or manipulate the full state. The PHP spec makes
> the same choice.

> **Judgment Call — no error handler parameter:** The design doc does
> not define error handlers. The PHP spec does not have them. v2.0 had
> optional error handlers on stage and assert. v2.2 drops them. If a
> user needs error recovery, they wrap the callable in a try/catch
> inside the closure itself. This simplifies the pipeline's execution
> logic, eliminates the RECOVERED status, and aligns with the design
> doc and the PHP implementation.

> **Judgment Call — skip has no label of its own:** The design doc
> signature is `SKIP :: STRING:targetLabel, (STATE -> BOOL):condition?`.
> A skip is identified by the target it gates, not by its own label.
> v2.0 had `skip(name, targetName, condition)` — v2.2 drops the first
> argument. The PHP spec makes the same choice.

> **Judgment Call — no `compare()` method on CTGTest:** The design doc
> lists "Pipeline-level compare hook" as an anti-pattern. v2.0 had a
> `compare()` method used internally for deep equality. v2.2 moves all
> comparison into predicates. `CTGTestPredicates.equals` uses
> `isDeepStrictEqual` directly — no pipeline method involved. This
> resolves SQ-1 from the previous draft.

#### start()

```
realizes: Core Semantics > Procedures > START
```

```
// :: CTGTestState | * :subject, OBJECT?:config -> PROMISE(CTGTestState)
async start(subject, config?)
```

Executes the pipeline:

1. **Resolve config** — merge caller config with defaults.
2. **Validate config** — reject unknown keys, wrong types,
   out-of-range values. Throw `INVALID_CONFIG`.
3. **Validate pipeline** — walk the operation list, validate all
   operations. Throw appropriate canonical errors.
4. **Normalize input** — if `subject` is a `CTGTestState` (or
   subclass), use it directly and overwrite `state.label` with
   `this.label`; otherwise wrap in
   `CTGTestState.init(this.label, subject)`.
5. **Build skip map** — collect all skip directives into a lookup map
   keyed by target label.
6. **Execute operations** — for each non-skip operation in order:
   - Reset `state.computed` to `undefined`.
   - Check skip map. If targeted, evaluate condition against current
     state. If skip fires (condition true or unconditional), record
     `skippedResult` and continue. If condition throws, record ERROR
     result for the target and respect `haltOnFailure`.
   - Execute the operation within timeout enforcement.
   - Pipeline evaluates outcome and records result.
   - If `haltOnFailure` and result status is `STATUS.FAIL` or
     `STATUS.ERROR`, stop.
7. **Return** the final `CTGTestState`.

#### Outcome Evaluation

After each operation executes, the pipeline evaluates the outcome:

1. **Stage** — handler returned a value. Pipeline wrote it to
   `state.subject`. Record `STATUS.PASS`. If the handler threw,
   record `STATUS.ERROR`.
2. **Assert** — handler returned a value. Pipeline wrote it to
   `state.computed`. Call `predicate.evaluate(state.computed)`.
   `true` → `STATUS.PASS`, `false` → `STATUS.FAIL`. If the handler
   or the predicate threw, record `STATUS.ERROR`.
3. **Chain** — the sub-pipeline's operations run against the same
   state object. The chain's label is added to the label prefix, so
   all results produced by the sub-pipeline's operations have the
   chain label prepended to their label arrays. The sub-pipeline
   does not call `start()` — the internal executor runs the
   sub-pipeline's operations directly against the shared state.
   A chain that executes normally does not produce its own result
   entry. A chain that is skipped receives a `skippedResult`.

#### Config

```
realizes: Core Semantics > Procedures > CONFIG
```

```javascript
static DEFAULT_CONFIG = {
    haltOnFailure: true,
    timeout: 5000
};
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `haltOnFailure` | BOOL | `true` | Stop after first `FAIL` or `ERROR` |
| `timeout` | INT | `5000` | Per-operation timeout in ms. `0` disables. |

**Validation rules:**
- Unknown keys throw `INVALID_CONFIG`.
- `haltOnFailure` must be a boolean; wrong type throws `INVALID_CONFIG`.
- `timeout` must be a non-negative finite number; non-number, `NaN`,
  `Infinity`, or negative values throw `INVALID_CONFIG`. Fractional
  values are truncated via `Math.trunc`.

#### Chain Depth Limit

```javascript
static MAX_CHAIN_DEPTH = 64;
```

Optional structural enforcement per the design doc. When chain nesting
exceeds this depth, the framework throws `CHAIN_DEPTH_EXCEEDED` (code
1100) — outside the canonical range, as required by the design doc.

---

### 2.6 CTGTestError

```
realizes: Error Semantics > The Framework Error Class
realizes: Error Semantics > Canonical Error Types
```

```
CTGTestError :: STRING | INT :typeOrCode, STRING?:message, *?:data => Error {
    type:    STRING,
    code:    INT,
    message: STRING,
    data:    * | VOID
}
```

Extends native `Error`. Constructor accepts a type name (string) or
numeric code (integer) as the first argument. The type and code are
resolved bidirectionally.

#### Properties

```
// GETTER :: VOID -> STRING
get type

// GETTER :: VOID -> INT
get code

// GETTER :: VOID -> STRING
get msg

// GETTER :: VOID -> * | VOID
get data
```

#### Canonical Error Types

| Name | Code | Meaning |
|------|------|---------|
| `INVALID_OPERATION` | 1000 | Malformed operation: empty label, non-callable fn, duplicate label |
| `INVALID_CHAIN` | 1001 | Chain target is not a `CTGTest` instance |
| `INVALID_CONFIG` | 1002 | Unknown config key, wrong type, out-of-range value |
| `INVALID_EXPECTED_OUTCOME` | 1003 | Assert predicate argument is not a `CTGTestPredicate` instance |
| `INVALID_SKIP` | 1004 | Skip target missing, duplicate skip, non-callable condition |
| `FORMATTER_ERROR` | 2000 | Formatter failed while consuming state |
| `RUNNER_ERROR` | 2001 | Reserved for caller-written runner scripts |

**Structural enforcement errors** (non-canonical, implementation-defined):

| Name | Code | Meaning |
|------|------|---------|
| `CHAIN_DEPTH_EXCEEDED` | 1100 | Chain nesting exceeded `MAX_CHAIN_DEPTH` |

#### Bidirectional Lookup

```
// :: STRING | INT -> INT | STRING
// String input returns code; integer input returns type name.
// Throws TypeError for unknown types or codes.
static lookup(key)
```

> **Judgment Call — `INVALID_OPERATION` not `INVALID_STEP`:** With
> STEP removed as a primitive, the canonical name is
> `INVALID_OPERATION`. Code stays 1000. This aligns with the PHP spec.

> **Judgment Call — `data` as any type:** The design doc says the data
> field's "shape is not prescribed." Using `*` is faithful.

---

### 2.7 Formatters

```
realizes: Format Semantics > The Formatter Contract
```

#### CTGTestConsoleFormatter

```
// :: CTGTestState -> STRING
static format(state)
```

Human-readable text output. The label array is joined with ` > ` for
display (a formatter concern, not a semantic one).

**Output format:**

```
Pipeline: {pipeline_label}

  [PASS]    load cart
  [PASS]    validate payment > check card
  [PASS]    validate payment > verify auth
  [FAIL]    complete order
              computed: 'pending'
              expected: 'complete'
  [ERROR]   finalize
              error: Error: Connection refused
  [SKIPPED] optional cleanup

---
3 passed, 1 failed, 1 skipped, 1 errored (6 total)
Result: FAIL
```

**Format rules:**

1. First line: `Pipeline: {label}` from `state.label`.
2. Blank line.
3. One line per result, indented 2 spaces:
   - Status in brackets: `[PASS]`, `[FAIL]`, `[ERROR]`, `[SKIPPED]`
   - Padded to 10 chars
   - Label path joined with ` > `
4. For FAIL results, two indented detail lines:
   - `computed: {formatted_value}`
   - `expected: {formatted_value}`
5. For ERROR results, one indented detail line:
   - `error: {error_class}: {error_message}`
6. For SKIPPED results, no detail lines.
7. Blank line, `---` separator.
8. Summary line: `{n} passed, {n} failed, {n} skipped, {n} errored ({total} total)`
9. Result line: `Result: {worst_status}`

No trailing newline — the caller appends it.

#### CTGTestJsonFormatter

```
// :: CTGTestState -> STRING
static format(state)
```

Pretty-printed JSON serialization of the state. BigInt values
serialized with `n` suffix. No trailing newline.

> **Judgment Call — no config parameter on formatters:** The design
> doc says the formatter receives STATE only. Formatter-specific
> configuration is the formatter's own concern — it can accept those
> via its own constructor or factory, not through the framework.

> **Judgment Call — `>` as label separator:** The design doc says
> "labels themselves may contain any characters; the framework never
> joins them at the semantic level." The formatter joins them for
> display. ` > ` is visually clear and unlikely to collide with label
> content. Aligns with the PHP spec's choice.

> **Judgment Call — renamed output format:** v2.0's console formatter
> used dot-padded alignment with step type tags. v2.2 uses bracket
> status tags and `computed`/`expected` detail lines aligned with the
> PHP formatter. This produces consistent output across language
> implementations.

---

## 3. Method Signatures (Complete)

All signatures use HM-like notation per the JS code style guide.

### CTGTestState

```
// CONSTRUCTOR :: { subject: *, label: STRING }? -> this
// GETTER :: VOID -> STRING                      label
// GETTER :: VOID -> *                           subject
// SETTER :: * -> VOID                           subject
// GETTER :: VOID -> *                           computed
// SETTER :: * -> VOID                           computed
// GETTER :: VOID -> [CTGTestResult]             results
// :: CTGTestResult -> VOID                      addResult(result)
// GETTER :: VOID -> INT                          status
// Static Factory Method :: STRING, * -> ctgTestState   init(label, subject)
```

### CTGTestResult

```
// CONSTRUCTOR :: [STRING], BOOL, INT?, *, *, Error? -> this
//   (private — use factory methods)
// Static Factory Method :: [STRING], INT, Error? -> ctgTestResult
//   stageResult(label, status, error?)
// Static Factory Method :: [STRING], INT, *, *, Error? -> ctgTestResult
//   assertResult(label, status, computedValue, expectedOutcome, error?)
// Static Factory Method :: [STRING] -> ctgTestResult
//   skippedResult(label)
// :: [CTGTestResult] -> INT                      aggregateStatus(results)
// :: [CTGTestResult] -> OBJECT                  countResults(results)
// :: * -> STRING                                formatValue(value)
// :: Error, BOOL, OBJECT? -> OBJECT             formatException(exception, includeTrace, causedBy?)
```

### CTGTestPredicate

```
// CONSTRUCTOR :: *, (* -> BOOL) -> this
//   (private — use init)
// GETTER :: VOID -> *                           expectedOutcome
// GETTER :: VOID -> (* -> BOOL)                 evaluate
// Static Factory Method :: *, (* -> BOOL) -> ctgTestPredicate
//   init(expectedOutcome, evaluate)
```

### CTGTestPredicates

```
// :: * -> ctgTestPredicate                      equals(expected)
// :: * -> ctgTestPredicate                      notEquals(expected)
// :: VOID -> ctgTestPredicate                   isVoid()
// :: VOID -> ctgTestPredicate                   isNotVoid()
// :: VOID -> ctgTestPredicate                   isTruthy()
// :: VOID -> ctgTestPredicate                   isFalsy()
// :: VOID -> ctgTestPredicate                   isTrue()
// :: VOID -> ctgTestPredicate                   isFalse()
// :: (* -> *) -> ctgTestPredicate               isInstanceOf(constructor)
// :: STRING -> ctgTestPredicate                  isType(type)
// :: * -> ctgTestPredicate                      greaterThan(expected)
// :: * -> ctgTestPredicate                      lessThan(expected)
// :: STRING -> ctgTestPredicate                  contains(expected)
// :: RegExp -> ctgTestPredicate                  matchesPattern(pattern)
// :: INT -> ctgTestPredicate                    hasLength(expected)
// :: [*] -> ctgTestPredicate                    anyOf(candidates)
// :: (* -> BOOL) -> ctgTestPredicate            satisfies(fn)
```

### CTGTest

```
// CONSTRUCTOR :: STRING -> this
//   (private — use init)
// :: STRING, (CTGTestState -> *) -> this                        stage(label, fn)
// :: STRING, (CTGTestState -> *), CTGTestPredicate -> this      assert(label, fn, predicate)
// :: STRING, CTGTest -> this                                    chain(label, pipeline)
// :: STRING, (CTGTestState -> BOOL)? -> this                    skip(targetLabel, condition?)
// :: CTGTestState | *, OBJECT? -> PROMISE(CTGTestState)         start(subject, config?)
// GETTER :: VOID -> STRING                                      label
// Static Factory Method :: STRING -> ctgTest                    init(label)
```

### CTGTestError

```
// CONSTRUCTOR :: STRING | INT, STRING?, *? -> this
// GETTER :: VOID -> STRING                      type
// GETTER :: VOID -> INT                         code
// GETTER :: VOID -> STRING                      msg
// GETTER :: VOID -> * | VOID                    data
// :: STRING | INT -> INT | STRING               lookup(key)
```

### Formatters

```
// :: CTGTestState -> STRING                     CTGTestConsoleFormatter.format(state)
// :: CTGTestState -> STRING                     CTGTestJsonFormatter.format(state)
```

---

## 4. Resolution of Deferred Decisions

### 4.1 Concrete Class Hierarchies

```
realizes: Left to Language-Specific Specs > Concrete class hierarchies
```

- `CTGTestState` — concrete class. Domain extensions subclass to add
  fields.
- `CTGTestPredicate` — concrete class. Domain extensions may subclass
  for custom predicate types.
- `CTGTestResult` — concrete class. Domain extensions may subclass to
  add fields, but must preserve the six canonical fields.
- `CTGTest` — concrete class. Domain extensions subclass to add
  builder methods (e.g., `navigate()`, `query()`).
- `CTGTestError` — concrete class extending `Error`.

**No CTGTestStep class.** Operations are stored internally by the
pipeline.

### 4.2 Constructor Shapes and Factory Methods

```
realizes: Left to Language-Specific Specs > Constructor shapes, factory methods
```

Public entry points are static factory methods named `init()`.
`CTGTestResult` uses named factory methods (`stageResult`,
`assertResult`, `skippedResult`) because the construction shape
varies by result kind.

Exception: `CTGTestError` has a usable constructor because exceptions
are commonly instantiated with `throw new CTGTestError(...)`.

### 4.3 Validation Rule Implementations

```
realizes: Left to Language-Specific Specs > Validation rule implementations
realizes: Error Semantics > When Framework Errors Are Thrown
```

All validation runs inside `start()`, before any operation executes.
Two-phase process:

**Phase 1 — Config validation:**

| Condition | Error | Data |
|---|---|---|
| Unknown config key | `INVALID_CONFIG` (1002) | `{ key }` |
| `haltOnFailure` not boolean | `INVALID_CONFIG` (1002) | `{ key: "haltOnFailure", value, expected: "boolean" }` |
| `timeout` not number or non-finite | `INVALID_CONFIG` (1002) | `{ key: "timeout", value, expected: "non-negative integer" }` |
| `timeout` negative | `INVALID_CONFIG` (1002) | `{ key: "timeout", value, constraint: ">= 0" }` |

**Phase 2 — Pipeline validation:**

| Condition | Error | Data |
|---|---|---|
| Pipeline label empty after trim | `INVALID_OPERATION` (1000) | `{ label: "" }` |
| Operation label empty after trim | `INVALID_OPERATION` (1000) | `{ label: "", operationIndex }` |
| Duplicate operation label | `INVALID_OPERATION` (1000) | `{ label, firstIndex, duplicateIndex }` |
| Stage/assert fn not a function | `INVALID_OPERATION` (1000) | `{ label, got: typeof fn }` |
| Assert predicate not CTGTestPredicate | `INVALID_EXPECTED_OUTCOME` (1003) | `{ label, got: typeof predicate }` |
| Assert predicate is a bare function | `INVALID_EXPECTED_OUTCOME` (1003) | `{ label, got: "function", hint: "Use CTGTestPredicate.init() or CTGTestPredicates" }` |
| Chain target not CTGTest | `INVALID_CHAIN` (1001) | `{ label, got: typeof target }` |
| Skip target label empty | `INVALID_SKIP` (1004) | `{ targetLabel: "" }` |
| Skip target not found | `INVALID_SKIP` (1004) | `{ targetLabel, available: [...labels] }` |
| Duplicate skip for same target | `INVALID_SKIP` (1004) | `{ targetLabel }` |
| Skip condition not null/function | `INVALID_SKIP` (1004) | `{ targetLabel, got: typeof condition }` |
| Chain depth exceeds limit | `CHAIN_DEPTH_EXCEEDED` (1100) | `{ label, depth, max: MAX_CHAIN_DEPTH }` |

> **Judgment Call — all validation deferred to `start()`:** Builder
> methods do not type-check arguments. All validation happens during
> pipeline validation in `start()`, which throws canonical framework
> errors with structured data. This ensures the design doc's error
> codes are always used, not native `TypeError`s.

> **Judgment Call — no skip ordering constraint:** The pipeline has
> the complete operation list before execution begins. Skip directives
> are collected into a lookup map keyed by target label. During
> execution, when the pipeline reaches an operation, it checks the map
> and evaluates the skip condition against current state. A skip
> directive can appear at any position in the builder sequence. The
> only constraints are: target must exist, no duplicate skips, and the
> condition must be callable. This aligns with the PHP spec.

> **Judgment Call — label uniqueness excludes skips:** Skips have no
> labels of their own. Label uniqueness is enforced across stages,
> asserts, and chains only. Skips are identified by their target.

### 4.4 Config Validation Details

```
realizes: Left to Language-Specific Specs > Config object validation details
```

| Key | Type | Default | Valid Range |
|-----|------|---------|-------------|
| `haltOnFailure` | `boolean` | `true` | `true` or `false` |
| `timeout` | `number` (integer) | `5000` | `>= 0` (0 disables timeout) |

- Unknown keys throw `INVALID_CONFIG`.
- Wrong-typed values throw `INVALID_CONFIG`.
- Negative timeout throws `INVALID_CONFIG`.
- Empty object `{}` is valid and uses all defaults.
- Omitting config entirely is valid and uses all defaults.

### 4.5 Execution Envelope — Timeout

```
realizes: Left to Language-Specific Specs > Execution envelope details
```

**Cancellation model: cooperative, Promise.race-based.**

JavaScript is single-threaded with an async event loop. The timeout
mechanism uses `Promise.race` with `setTimeout`:

1. Before each operation executes, if timeout > 0, race the
   operation's execution against a timer.
2. If the timer wins, the operation's return value is NOT applied to
   state — `state.subject` and `state.computed` remain unchanged from
   before the operation ran. A result with `status: STATUS.ERROR` and
   a framework-generated `Error("Operation '{label}' timed out after
   {timeout}ms")` is recorded.
3. The timer is cleared after the operation completes (or after
   timeout fires).

**Slot rollback scope — timeout only:**

The pipeline snapshots `state.subject` and `state.computed` before
each operation executes. If the operation exceeds its timeout, the
slots are restored to their pre-operation values. This rollback
applies **only on timeout**, not on regular handler errors. When a
handler throws normally, the slot deposit hasn't happened yet (the
framework writes to the slot *after* the handler returns), so no
rollback is needed.

This guarantee does NOT extend to:
- Extension-defined state fields (fields added by CTGTestState
  subclasses)
- External side effects (network calls, file writes, etc.)
- Mutations to mutable objects the handler may have performed before
  timeout fired

Extensions that need rollback protection for their own state fields
must implement their own mechanism.

**Timeout value of 0:** Disables timeout enforcement entirely.

> **Judgment Call — Promise.race is the JS idiom:** Unlike PHP's
> `pcntl_alarm`, JavaScript's `Promise.race` works at millisecond
> granularity and is the standard pattern for async timeout. The user's
> code is not forcibly terminated (cooperative cancellation), but the
> timed-out return value is not applied to state.

### 4.6 Asynchronous Realization

```
realizes: Left to Language-Specific Specs > Synchronous vs asynchronous realization
```

JavaScript is asynchronous. `start()` returns a `Promise`. All
operation handlers may be sync or async — the framework awaits each
one. Promise resolution on state fields (`state.subject`,
`state.computed`) happens after each operation executes, within the
timeout and error handling scope.

### 4.7 Host-Language Ergonomics

```
realizes: Left to Language-Specific Specs > Host-language ergonomics
```

- **Fluent builder:** `stage()`, `assert()`, `chain()`, `skip()`
  return `this`.
- **Arrow functions:** `(state) => state.subject * 2` is the
  idiomatic handler shape.
- **ES module default exports:** Each class is a default export from
  its module.
- **`_` prefix for private fields:** Per the JS code style guide.
- **`#` prefix for truly private methods** where appropriate.

### 4.8 Module Structure / File Layout

```
realizes: Left to Language-Specific Specs > Module structure
```

```
src/
    CTGTest.js                    # Pipeline builder/executor
    CTGTestState.js               # State carrier
    CTGTestResult.js              # Result value object + utilities
    CTGTestPredicate.js           # Predicate type
    CTGTestPredicates.js          # Convenience predicate builders
    CTGTestError.js               # Framework error class
    formatters/
        CTGTestConsoleFormatter.js    # Reference text formatter
        CTGTestJsonFormatter.js       # JSON formatter
index.js                          # Package entry point
```

**No `CTGTestStep.js`. No `steps/` directory.** Operations are stored
internally by CTGTest.

### 4.9 Conformance Verification

```
realizes: Left to Language-Specific Specs > Conformance verification
```

Tests are written using Vitest as an independent oracle. The framework
runs pipelines and returns STATE; Vitest asserts against the STATE
object using its own proven assertion infrastructure. This avoids the
bootstrapping problem of self-testing (where a bug in result recording
would be invisible to tests that use the same result recording
machinery).

Vitest is a dev-only dependency. It does not ship with the library —
zero production dependencies are preserved.

Each design doc requirement maps to one or more Vitest test methods.
Test files live at `tests/` and follow the pattern `tests/*.test.js`:

```
tests/
    state.test.js
    predicate.test.js
    predicates.test.js
    result.test.js
    pipeline-stage.test.js
    pipeline-assert.test.js
    pipeline-chain.test.js
    pipeline-skip.test.js
    pipeline-config.test.js
    pipeline-timeout.test.js
    error.test.js
    console-formatter.test.js
    json-formatter.test.js
```

**Running tests:**

```bash
npx vitest run
```

**Test pattern:** Each test method creates a pipeline, runs it via
`start()`, and uses Vitest assertions (`expect`, `toBe`, `toEqual`,
etc.) to verify the returned `CTGTestState` — its results, statuses,
computed values, expected outcomes, and error fields.

> **Judgment Call — Vitest as independent oracle:** Same rationale as
> PHPUnit for the PHP spec. Vitest provides an independent assertion
> infrastructure so that a bug in `CTGTestResult` or `CTGTestState`
> would be caught by Vitest's own `expect()`, not masked by the
> framework under test. Vitest is a dev-only dependency, preserving
> zero production dependencies.

---

## 5. Anti-Pattern Enforcement

```
realizes: Constraints > Anti-Patterns
```

| Anti-Pattern | Enforcement in v2.2 |
|---|---|
| Static result accumulator | Not provided. `CTGTestState` is instance-scoped. No static results anywhere. |
| Static config singleton | Not provided. No `setCliConfig`/`getCliConfig`. Config passed to `start()` only. |
| `collector` / `publishResult` config keys | Not provided. CONFIG accepts only `haltOnFailure` and `timeout`. Unknown keys throw `INVALID_CONFIG`. |
| `output` / `formatter` config keys | Not provided. Not in CONFIG. |
| Pipeline-owned delivery (stdout) | Not provided. `start()` returns state. No stdout writes. |
| Built-in generic test runner | Not provided. No `bin/ctg-test`. Callers write their own runners. |
| Pipeline-owned subject snapshot/debug | Not provided. No `_snapshotSubject`. No debug config key. |
| Pipeline-level `compare` hook | Not provided. No `compare()` method on CTGTest. Comparison is exclusively owned by `CTGTestPredicate.evaluate()`. |

---

## 6. Extension Surfaces

```
realizes: Core Concepts > 5. Extension Surfaces
```

The framework has three extension surfaces: **STATE**, **PREDICATE**,
and **PIPELINE**.

| Surface | JS Extension Mechanism | Example |
|---|---|---|
| STATE | Subclass `CTGTestState`, add domain fields | `CTGBrowserTestState` adds `page`, `browser`, `context` |
| PREDICATE | Subclass `CTGTestPredicate` or build via `CTGTestPredicate.init()` | `httpPredicates.statusIs(200)` returns a predicate |
| PIPELINE | Subclass `CTGTest`, add builder methods | `CTGBrowserTest.navigate(url)` internally calls `this.stage(...)` |

Extensions do NOT:
- Create or inspect individual operation representations (no public
  STEP type)
- Add new status values (STATUS is a closed set of three)
- Add keys to CONFIG (unknown keys throw `INVALID_CONFIG`)
- Omit or redefine the six canonical RESULT fields (subclasses may add
  extra fields but the canonical shape is required)

---

## 7. Judgment Calls Index

1. **CONFIG as plain object** (§1) — two keys, no behavior, class adds ceremony.
2. **STATUS as frozen object with integer codes** (§1) — JS lacks enums; integers are stable identifiers decoupled from display labels; string labels can change without breaking comparisons.
3. **STEP removed** (§1) — design doc removes STEP as primitive; pipeline stores internally.
4. **`label` not `name`** (§2.1) — design doc uses `label`; v2.0 break.
5. **`addResult` takes CTGTestResult** (§2.1) — typed results enforce structure; supports async safety.
6. **Pipeline label on STATE** (§2.1) — satisfies `STATE -> OUTPUT` formatter contract.
7. **No `type` field on RESULT** (§2.2) — design doc omits it.
8. **No `durationMs` on RESULT** (§2.2) — design doc omits it; domain extensions add if needed.
9. **No `message` on RESULT** (§2.2) — diagnostics in error field.
10. **CTGTestResult as class** (§2.2) — enforces six-field structure.
11. **CTGTestPredicate as class** (§2.3) — enables instanceof validation.
12. **Separate CTGTestPredicates class** (§2.4) — type vs builders.
13. **`isVoid` not `isNull`** (§2.4) — aligns with design doc VOID concept; checks both null and undefined.
14. **`anyOf` replaces `assertAny`** (§2.4) — predicate concern, not step type.
15. **`equals` uses `isDeepStrictEqual`** (§2.4) — JS equivalent of PHP `===` for objects.
16. **`satisfies` expectedOutcome is `"*"`** (§2.4) — unconstrained outcome; `*` is the any-type notation.
17. **Stage returns value, not state** (§2.5) — design doc alignment; v2.0 break.
18. **No error handler parameter** (§2.5) — design doc omits; PHP omits; simplifies execution.
19. **Skip has no label** (§2.5) — design doc signature; PHP alignment.
20. **No `compare()` on CTGTest** (§2.5) — anti-pattern; comparison owned by predicates.
21. **No getSteps()/getOperations()** (§2.5) — operation list is internal.
22. **All validation deferred to `start()`** (§4.3) — canonical errors, not native TypeError.
23. **No skip ordering constraint** (§4.3) — skip map built before execution; PHP alignment.
24. **Label uniqueness excludes skips** (§4.3) — skips are labelless directives.
25. **`INVALID_OPERATION` not `INVALID_STEP`** (§2.6) — STEP removed; PHP alignment.
26. **`data` as `*`** (§2.6) — design doc says shape not prescribed.
27. **No config param on formatters** (§2.7) — design doc says STATE only.
28. **`>` as label separator** (§2.7) — formatter concern; PHP alignment.
29. **Formatter output format aligned with PHP** (§2.7) — cross-language consistency.
30. **Promise.race for timeout** (§4.5) — JS idiom, millisecond granularity.
31. **Vitest as independent oracle** (§4.9) — same rationale as PHPUnit for PHP; dev-only dependency preserves zero production deps.

---

## 8. Resolved Questions

### Q1: `state.computed` resets between operations

Reset `state.computed` to `undefined` before each operation executes.
Each operation starts with a clean computed slot. This prevents stale
computed values from leaking across operations.

### Q2: Stage result field values

Stage results have `undefined` for `computedValue` and
`expectedOutcome` (JS's realization of VOID). All `CTGTestResult`
instances carry all six fields. Formatters use status and the
combination of defined fields to determine rendering.

### Q3: Skip condition throws → ERROR result for the target operation

When a skip's condition function throws, the framework records an
ERROR result for the **target** operation. The skip asked "should this
operation run?" and got an error instead of an answer. The target did
not run, and its result reflects that with `status: STATUS.ERROR` and the
caught exception in `error`. The label on the ERROR result is the
target operation's label (skips have no label of their own).

### Q4: Chain failure halts outer pipeline under `haltOnFailure`

Yes. The sub-pipeline runs with the same `haltOnFailure` setting.
Failure results are appended to the outer state with the chain label
prepended. The outer pipeline sees the failure and halts. When
`haltOnFailure` is false, everything runs to completion.

### Q5: Label uniqueness namespace

Label uniqueness is enforced per-pipeline across stages, asserts, and
chains. Skip directives have no labels and do not participate in the
uniqueness namespace.

### Q6: Skipped chain label array

A skipped chain result has label `[chainLabel]` (single-element
array), `skipped: true`, `status: undefined`, all other fields
`undefined`. The sub-pipeline never ran — no child results.

### Q7: Skip directives are internal

Skip directives execute during the pipeline run (evaluate their
condition, mark their target). They do not produce result entries.
Their effect is visible on the target operation's result
(`skipped: true`). No public method inspects skip directives.

---

## Appendix A: Execution Algorithm (Pseudocode)

`start()` is the public entry point. It normalizes input, validates,
and delegates to `executePipeline()` — the internal executor that
chain also calls.

```
async function START(subject, config):
    config = resolveConfig(config)        // merge defaults, validate
    validatePipeline(this, depth=0)       // validate all operations recursively

    // Normalize input
    if subject is CTGTestState (or subclass):
        state = subject
        state.label = this.label          // pipeline owns the label
    else:
        state = CTGTestState.init(this.label, subject)

    await executePipeline(this, state, config, labelPrefix=[])
    return state
```

```
async function executePipeline(pipeline, state, config, labelPrefix):
    // Build skip lookup map for this pipeline's operations
    skipMap = {}
    for each operation in pipeline._operations:
        if operation is a skip directive:
            skipMap[operation.targetLabel] = operation.condition

    // Execute non-skip operations in order
    for each operation in pipeline._operations:
        if operation is a skip directive:
            continue

        state.computed = undefined        // reset computed slot
        fullLabel = [...labelPrefix, operation.label]

        // Check skip map
        if operation.label is in skipMap:
            condition = skipMap[operation.label]
            try:
                if condition is null or (await condition(state)) is true:
                    state.addResult(skippedResult(fullLabel))
                    continue
                // condition returned false — operation runs normally
            catch (err):
                state.addResult(errorResult(fullLabel, err))
                if haltOnFailure: return
                continue

        // snapshot framework-owned slots for timeout rollback
        snapshot = [state.subject, state.computed]

        // Wrap execution in Promise.race for timeout enforcement
        try with timeout:
            if operation is stage:
                value = await operation.fn(state)
                state.subject = value
                state.addResult(stageResult(fullLabel, STATUS.PASS))

            else if operation is assert:
                value = await operation.fn(state)
                state.computed = value
                passed = operation.predicate.evaluate(state.computed)
                state.addResult(assertResult(
                    fullLabel,
                    passed ? STATUS.PASS : STATUS.FAIL,
                    state.computed,
                    operation.predicate.expectedOutcome
                ))

            else if operation is chain:
                // Same state, extended label prefix — no start() call
                newPrefix = [...labelPrefix, operation.label]
                await executePipeline(operation.pipeline, state, config, newPrefix)

        catch timeout:
            // Timeout — restore slots, record error
            restore state.subject, state.computed from snapshot
            state.addResult(errorResult(fullLabel, timeoutError))

        catch (err):
            // Handler threw — slots were not deposited, no restore needed
            state.addResult(errorResult(fullLabel, err))

        // halt check
        lastResult = last element of state.results
        if haltOnFailure AND (lastResult.status is STATUS.FAIL or STATUS.ERROR):
            return
```

> **Note:** `start()` is the public entry point; `executePipeline()`
> is the internal executor. Chain calls `executePipeline()` directly
> with the same state and an extended label prefix — it never calls
> `start()` on the sub-pipeline. This is how same-state chaining
> works: the sub-pipeline's operations mutate the same state object,
> and the label prefix accumulates as chains nest. This matches the
> PHP implementation.

> **Note on skip evaluation timing:** Skip conditions are evaluated
> when the target operation is reached during execution, not when
> the skip directive is encountered. Conditions see the current state
> including mutations from earlier operations.

> **Note on skip condition errors:** When a skip's condition throws,
> the framework records an ERROR result with the **target's** label
> and the caught exception. The target does not execute. The result
> trace has exactly one entry for the target.

> **Note on slot rollback:** Slot restore (`state.subject`,
> `state.computed`) happens only on timeout, not on regular handler
> errors. When a handler throws, the slot deposit hasn't happened yet
> — the framework writes to slots *after* the handler returns — so
> no restore is needed. This follows the PHP implementation.

---

## Appendix B: v2.0 to v2.2 Migration Summary

| v2.0 Concept | v2.2 Equivalent | Breaking? |
|---|---|---|
| `CTGTestStep` (class) | Removed — operations internal | Yes |
| `StageStep`, `AssertStep`, `AssertAnyStep`, `ChainStep`, `SkipStep` | Removed — all six classes | Yes |
| `steps/` directory | Removed | Yes |
| `getSteps()` / `get steps` | Removed — no public inspection | Yes |
| `INVALID_STEP` (1000) | `INVALID_OPERATION` (1000) | Yes — renamed |
| `INVALID_EXPECTED` (1003) | `INVALID_EXPECTED_OUTCOME` (1003) | Yes — renamed |
| `.assertAny(name, fn, candidates)` | `.assert(name, fn, CTGTestPredicates.anyOf(candidates))` | Yes |
| `.assert(name, fn, rawValue)` | `.assert(name, fn, CTGTestPredicates.equals(value))` | Yes |
| `.skip(name, targetName, condition)` | `.skip(targetLabel, condition)` | Yes — skip has no label |
| `state.actual` | `state.computed` | Yes — renamed |
| `state.name` | `state.label` | Yes — renamed |
| `state.skipTargets` | Internal to pipeline (skip map) | Yes — removed from state |
| `test.name` | `test.label` | Yes — renamed |
| Result `name` field (string) | Result `label` field (array) | Yes — different shape |
| Result `type` field | Removed | Yes |
| Result `durationMs` field | Removed | Yes |
| Result `message` field | Removed — diagnostics in `error` | Yes |
| Result `actual` / `expected` / `candidates` | `computedValue` / `expectedOutcome` | Yes — renamed |
| `STATUS.RECOVERED` (3) | Removed — recovery maps to PASS/FAIL | Yes |
| `STATUS.SKIP` (4) | Removed — `skipped` is a bool field on result | Yes |
| Numeric status codes (0–4) | Three integer codes (0–2): `PASS`, `FAIL`, `ERROR` | Yes — `RECOVERED` and `SKIP` removed |
| `compare()` on CTGTest | Removed — comparison in predicates | Yes |
| Error handler param on stage/assert | Removed — wrap in try/catch in handler | Yes |
| `config` param on formatters | Removed — formatters take state only | Yes |
| `_snapshotSubject` debug mode | Removed | Yes |
| `_lastStepStatus`, `_lastStepMessage`, `_chainResult` on state | Removed — internal to pipeline | Yes |
