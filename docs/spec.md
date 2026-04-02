# CTG JS Test — Implementation Spec

**Source:** `design-docs/test-design-doc.md`
**Language:** JavaScript (ESM, Node.js)
**Code Style:** `ctg-project-proc/code-styles/js-code-style.md`

---

## Implementation Status

The following spec sections are **not yet implemented** and represent planned work:

- **Per-step timeout** (`timeout` config key, `_withTimeout` helper) — spec section: Per-Step Timeout
- **Static result collector** (`CTGTest._results`) — spec section: Static Result Collector
- **CI exit semantics** (exit code 1 on test fail/error) — spec section: Exit Codes
- **CLI `--timeout` flag** — spec section: `--timeout` Validation

All other spec sections are implemented and tested.

---

## Design Doc Divergences

This spec intentionally diverges from the design doc in the following areas:

### Async Pipeline Execution

**Design doc says:** "Async/parallel test execution — out of scope"

**This spec says:** All step callables (fn, errorHandler, skip predicates) are `await`ed.
The pipeline remains **sequential** — one step at a time, subject threading preserved —
but each step can perform async work. This is required because Node.js is single-threaded
and async-pervasive; forcing synchronous-only callables would make the framework
impractical for testing real-world Node.js code (database calls, HTTP requests, file I/O).

No separate `asyncAssert` or `asyncStage` methods. Every callable is uniformly `await`ed —
if it returns a plain value, `await` is a no-op; if it returns a Promise, it resolves before
the next step proceeds.

### Access Modifiers

**JS code style says:** Use `#` prefix for private methods.

**This spec says:** Use `_` underscore prefix for all non-public methods and fields.
ES2022 `#private` fields introduce Node.js version constraints and complicate subclassing
(the `compare()` extension point requires subclasses). Using underscore-prefixed
private-by-convention maximizes cross-version compatibility and keeps the inheritance
model simple. This is a spec-level decision that does not change the shared JS code
style guide.

---

## File Layout

```
ctg-js-test/
├── src/
│   ├── CTGTest.js                  # Test pipeline engine
│   ├── CTGTestError.js             # Typed error class
│   ├── CTGTestResult.js            # Result factory & aggregation utilities
│   ├── CTGTestStep.js              # Step definition value object
│   └── formatters/
│       ├── CTGTestConsoleFormatter.js
│       ├── CTGTestJsonFormatter.js
│       └── CTGTestJunitFormatter.js
├── bin/
│   └── ctg-test                    # CLI runner (Node.js executable)
├── docs/
│   └── spec.md                     # This file
└── package.json
```

### package.json

```json
{
    "name": "ctg-js-test",
    "version": "1.0.0",
    "type": "module",
    "exports": {
        ".": "./src/CTGTest.js"
    },
    "bin": {
        "ctg-test": "./bin/ctg-test"
    }
}
```

- **`"type": "module"`** — all `.js` files are ESM
- **`"exports"`** — single entry point; consumers `import CTGTest from "ctg-js-test"`
- **`"bin"`** — CLI runner registered as `ctg-test` command
- **Minimum Node.js version:** 14.x (ESM support, `util.isDeepStrictEqual`, `performance.now()`). Documented here but not enforced via `"engines"`.
- **No external dependencies.** All source files use `export default class`. Only Node.js built-ins (`node:util`, `node:fs`, `node:path`, `node:url`, `node:perf_hooks`).

---

## Class: CTGTestError

**File:** `src/CTGTestError.js`
**Design doc ref:** Error System

Extends `Error`. Typed exception with bidirectional name/code lookup.

### Static Fields

```javascript
static ERROR_TYPES = {
    INVALID_STEP:    1000,
    INVALID_CHAIN:   1001,
    INVALID_CONFIG:  1002,
    INVALID_EXPECTED: 1003,
    INVALID_SKIP:    1004,
    FORMATTER_ERROR: 2000,
    RUNNER_ERROR:    2001
};
```

### Constructor

```javascript
// CONSTRUCTOR :: STRING|INT, STRING?, * -> this
// Accepts type name or numeric code. Resolves both via bidirectional lookup.
// If msg is not provided, defaults to the type name string.
// Unknown types or codes throw a native TypeError immediately.
constructor(typeOrCode, msg, data)
```

- `typeOrCode` — string type name (e.g., `"INVALID_STEP"`) or integer code (e.g., `1000`)
- `msg` — optional message; defaults to the resolved type name
- `data` — optional arbitrary context data; defaults to `null`

**Instance fields:**
- `_type` — resolved string type name
- `_code` — resolved numeric code
- `_msg` — message string
- `_data` — context data or `null`

Sets `this.name` to `"CTGTestError"` and `this.message` to the resolved `msg` for native Error compatibility.

### Properties

```javascript
// GETTER :: VOID -> STRING
get type()

// GETTER :: VOID -> INT
get code()

// GETTER :: VOID -> STRING
get msg()

// GETTER :: VOID -> *
get data()
```

### Static Methods

```javascript
// :: STRING|INT -> INT|STRING
// Bidirectional lookup. String input returns code; integer input returns type name.
// Throws TypeError for unknown types or codes.
static lookup(key)
```

### Language-Specific Decisions

- **Design doc:** "extends the language's native exception/error type" → extends `Error`
- **Design doc:** "Unknown types or codes throw immediately as a native argument error" → throws `TypeError`
- `_type`, `_code`, `_msg`, `_data` use underscore-prefixed instance fields
- No `on`/`otherwise` handler chaining (design doc explicitly excludes this)

---

## Class: CTGTestStep

**File:** `src/CTGTestStep.js`
**Design doc ref:** Step Definition (Value Object)

Immutable-by-convention value object holding a single step definition.

### Constructor

```javascript
// CONSTRUCTOR :: STRING, STRING, ((*) -> *)|ctgTest, *, ((*) -> *)? -> this
// Creates a step definition. No validation here — deferred to CTGTest._validateSteps().
constructor(type, name, fn, expected, errorHandler)
```

- `type` — one of: `"stage"`, `"assert"`, `"assert-any"`, `"chain"`
- `name` — human-readable step name (stored as-is; trimming checked at validation)
- `fn` — callable for stage/assert/assert-any; CTGTest instance for chain
- `expected` — expected value for assert; candidate array for assert-any; `null` for stage/chain
- `errorHandler` — optional recovery callable; `null` if not provided

### Properties

```javascript
// GETTER :: VOID -> STRING
get type()

// GETTER :: VOID -> STRING
get name()

// GETTER :: VOID -> ((*) -> *)|ctgTest
get fn()

// GETTER :: VOID -> *
get expected()

// GETTER :: VOID -> ((*) -> *)|VOID
get errorHandler()
```

All getters return the stored value. No setters — write-once at construction.

### Language-Specific Decisions

- No static `init` factory — plain constructor is sufficient for an internal value object
- Instance fields: `_type`, `_name`, `_fn`, `_expected`, `_errorHandler`

---

## Class: CTGTestResult

**File:** `src/CTGTestResult.js`
**Design doc ref:** Result Utilities

All methods are static. No constructor or instance state.

### Static Fields

```javascript
static STATUS_PASS      = "pass";
static STATUS_FAIL      = "fail";
static STATUS_ERROR     = "error";
static STATUS_RECOVERED = "recovered";
static STATUS_SKIP      = "skip";

static SEVERITY = {
    "error":     5,
    "fail":      4,
    "recovered": 3,
    "pass":      2,
    "skip":      1
};
```

### Static Methods

```javascript
// :: STRING, STRING, STRING, INT, STRING?, OBJECT? -> OBJECT
// Creates a stage-type result structure.
// Design doc ref: stepResult
static stepResult(type, name, status, durationMs, message = null, exception = null)
```

Returns:
```javascript
{ type, name, status, duration_ms, message, exception }
```

---

```javascript
// :: STRING, STRING, INT, *, *, STRING?, OBJECT? -> OBJECT
// Creates an assert result with actual and expected fields.
// Design doc ref: assertResult
static assertResult(name, status, durationMs, actual, expected, message = null, exception = null)
```

Returns:
```javascript
{ type: "assert", name, status, duration_ms, actual, expected, message, exception }
```

---

```javascript
// :: STRING, STRING, INT, *, [*], STRING?, OBJECT? -> OBJECT
// Creates an assert-any result with actual and candidates fields.
// Design doc ref: assertAnyResult
static assertAnyResult(name, status, durationMs, actual, candidates, message = null, exception = null)
```

Returns:
```javascript
{ type: "assert-any", name, status, duration_ms, actual, candidates, message, exception }
```

---

```javascript
// :: STRING, STRING, INT, STRING?, OBJECT?, [OBJECT], OBJECT -> OBJECT
// Creates a chain result with nested step results and aggregate counts.
// Design doc ref: chainResult
static chainResult(name, status, durationMs, message, exception, steps, counts)
```

Returns:
```javascript
{ type: "chain", name, status, duration_ms, message, exception, steps,
  passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
  recovered: counts.recovered, errored: counts.errored, total: counts.total }
```

---

```javascript
// :: INT, INT, INT -> STRING|VOID
// Generates canonical chain message from child counts.
// Returns null if no failures or errors.
// Design doc ref: chainMessage
static chainMessage(failed, errored, total)
```

Returns `"{failed} failed, {errored} errored in {total} steps"` or `null`.

---

```javascript
// :: STRING, [OBJECT] -> OBJECT
// Assembles root report. Calls countSteps, aggregateStatus, sumDuration internally.
// Design doc ref: report
static report(name, steps)
```

Returns:
```javascript
{ name, status, passed, failed, skipped, recovered, errored, total, duration_ms, steps }
```

---

```javascript
// :: [OBJECT] -> STRING
// Derives worst status from child steps using severity ordering.
// Empty list returns "pass".
// Design doc ref: aggregateStatus
static aggregateStatus(steps)
```

---

```javascript
// :: [OBJECT] -> OBJECT
// Counts steps by status at current level only (no recursion into chains).
// Design doc ref: countSteps
static countSteps(steps)
```

Returns: `{ passed, failed, skipped, recovered, errored, total }`

---

```javascript
// :: [OBJECT] -> INT
// Sums duration_ms across steps at current level.
// Design doc ref: sumDuration
static sumDuration(steps)
```

---

```javascript
// :: Error, BOOL, OBJECT? -> OBJECT
// Serializes an exception to a structured map.
// causedBy is a pre-formatted exception map, not a raw Error.
// Design doc ref: formatException
static formatException(exception, includeTrace, causedBy = null)
```

Returns:
```javascript
{ class: "ErrorClassName", message: "...", code: number|string|null,
  trace: "..." /* only if includeTrace */,
  caused_by: { ... } /* only if causedBy provided */ }
```

- `class` — `exception.constructor.name`
- `message` — `exception.message`
- `code` — `exception.code` if present, as-is (`number` for CTGTestError, `string` for Node.js errors like `"ENOENT"`). If absent, `null`. Never defaults to `0` — `null` means no code, `0` would imply a real code.
- `trace` — `exception.stack` (only when `includeTrace` is true)
- `caused_by` — the pre-formatted map passed as `causedBy`

---

```javascript
// :: * -> STRING
// Serializes any value to a human-readable string.
// Design doc ref: formatValue
static formatValue(value)
```

| JS Value | Output |
|----------|--------|
| `null` | `"null"` |
| `undefined` | `"null"` |
| `true` / `false` | `"true"` / `"false"` |
| integer number (e.g., `42`) | `"42"` |
| float number (e.g., `3.14`) | `"3.14"` |
| `NaN` | `"NaN"` |
| `Infinity` | `"Infinity"` |
| `-Infinity` | `"-Infinity"` |
| `BigInt` (e.g., `42n`) | `"42n"` |
| string | single-quoted with escaping (e.g., `"'hello'"`) |
| `Array` | `"array(N)"` where N is `length` |
| `Map` | `"Map(N)"` where N is `size` |
| `Set` | `"Set(N)"` where N is `size` |
| `function` | `"[Closure]"` |
| `symbol` | `"symbol(description)"` |
| object (non-null, including `Error`) | `"object(ClassName)"` using `constructor.name` |

**Type detection order:** `null` → `undefined` → `typeof` checks for `boolean`, `number`
(then `NaN`/`Infinity` sub-checks), `bigint`, `string`, `function`, `symbol` → `Array.isArray()`
→ `instanceof Map` → `instanceof Set` → fallback to object.

### Language-Specific Decisions

- **Design doc:** "resource handles" → JS has no native resource type. Omitted from formatValue and uncomparable checks. If a resource-like pattern emerges (e.g., file handles from Node APIs), treat as plain objects.
- **Design doc:** `formatException` uses `exception.constructor.name` for class name (JS has no formal class property on errors, but `constructor.name` is the idiomatic equivalent)
- **Design doc:** `code` field — CTGTestError provides `_code` via getter; native Errors don't have a numeric code. Missing codes are `null`, not `0` (see `formatException` spec).
- `undefined` maps to `"null"` in formatValue (JS-specific — design doc only lists null, but undefined is the JS equivalent in many contexts)

---

## Class: CTGTest

**File:** `src/CTGTest.js`
**Design doc ref:** Test Definition, Comparison, Configuration, Pipeline Execution

### Static Fields

```javascript
static MAX_CHAIN_DEPTH = 64;
static MAX_NESTING_DEPTH = 128;

static VALID_CONFIG_KEYS = ["output", "haltOnFailure", "strict", "trace", "debug", "formatter", "timeout"];
static VALID_OUTPUT_MODES = ["console", "return", "return-json", "json", "junit"];
static BOOLEAN_CONFIG_KEYS = ["haltOnFailure", "strict", "trace", "debug"];

static DEFAULT_CONFIG = {
    output: "console",
    haltOnFailure: true,
    strict: true,
    trace: false,
    debug: false,
    formatter: null,
    timeout: 5000
};
```

### Instance Fields

```javascript
_name       // STRING — test name (trimmed at init)
_steps      // [CTGTestStep] — step definitions
_skips      // [OBJECT] — skip directives: { name: STRING, predicate: ((*) -> BOOL)|VOID }
```

### Constructor

```javascript
// CONSTRUCTOR :: STRING -> this
// Private-by-convention. Use static init() factory.
constructor(name)
```

Stores trimmed name. Initializes `_steps` and `_skips` as empty arrays.

### Properties

```javascript
// GETTER :: VOID -> STRING
// Design doc ref: getName
get name()

// GETTER :: VOID -> [ctgTestStep]
// Design doc ref: getSteps
get steps()

// GETTER :: VOID -> [OBJECT]
// Design doc ref: getSkips
get skips()
```

### Instance Methods

```javascript
// :: STRING, (* -> *|PROMISE(*)), ((Error) -> *|PROMISE(*))? -> this
// Adds a stage step. Returns self for chaining.
// Design doc ref: stage
stage(name, fn, errorHandler = null)
```

Creates a `CTGTestStep("stage", name, fn, null, errorHandler)` and pushes to `_steps`.

---

```javascript
// :: STRING, (* -> *|PROMISE(*)), *, ((Error) -> *|PROMISE(*))? -> this
// Adds an assert step. Returns self for chaining.
// Design doc ref: assert
assert(name, fn, expected, errorHandler = null)
```

Creates a `CTGTestStep("assert", name, fn, expected, errorHandler)` and pushes to `_steps`.

---

```javascript
// :: STRING, (* -> *|PROMISE(*)), [*], ((Error) -> *|PROMISE(*))? -> this
// Adds an assert-any step. Returns self for chaining.
// Design doc ref: assertAny
assertAny(name, fn, candidates, errorHandler = null)
```

Creates a `CTGTestStep("assert-any", name, fn, candidates, errorHandler)` and pushes to `_steps`.

---

```javascript
// :: STRING, ctgTest -> this
// Composes another test's steps inline.
// Design doc ref: chain
chain(name, testInstance)
```

Creates a `CTGTestStep("chain", name, testInstance, null, null)` and pushes to `_steps`.

---

```javascript
// :: STRING, ((* -> BOOL|PROMISE(BOOL)))? -> this
// Marks a step for conditional or unconditional skipping.
// Design doc ref: skip
skip(stepName, predicate = null)
```

Pushes `{ name: stepName, predicate }` to `_skips`.

---

```javascript
// :: *, OBJECT? -> PROMISE(STRING|OBJECT|VOID)
// Executes the pipeline. All validation runs first (synchronous).
// Step execution is async — awaits each callable sequentially.
// Design doc ref: start
async start(subject, config = {})
```

Execution order:
1. `_resolveConfig(config)` — merge with defaults
2. `_validateConfig(resolved)` — validate keys, types, output mode, formatter
3. `_validateSteps()` — validate all step definitions
4. `_validateSkips()` — validate all skip directives
5. `await _executeSteps(subject, resolved, 0, this._steps, this._skips)` — run pipeline
6. `CTGTestResult.report(this._name, stepResults)` — assemble report
7. `_deliver(report, resolved)` — format and return/print

Validation (steps 1-4) is synchronous — no async work needed to check
definitions. Execution (step 5) is async — each step callable is `await`ed.

Return value per output mode (all wrapped in Promise):
- `"return"` — resolves to formatted string
- `"return-json"` — resolves to raw report object (may contain raw `BigInt` values in `actual`/`expected` fields; consumers are responsible for serialization)
- `"console"`, `"json"`, `"junit"` — resolves to `undefined` (prints to stdout via `process.stdout.write`)

### Non-Public Methods

All non-public methods use underscore prefix (`_methodName`) rather than
ES2022 `#private` syntax. See Design Doc Divergences section.

```javascript
// :: OBJECT -> OBJECT
// Merges caller config with DEFAULT_CONFIG.
_resolveConfig(config)
```

---

```javascript
// :: OBJECT -> VOID
// Validates config keys, output mode, boolean types, formatter reference.
// Throws CTGTestError(INVALID_CONFIG) on failure.
_validateConfig(config)
```

Validation rules (design doc ref: Config Key Validation through Formatter Validation):
- Every key must be in `VALID_CONFIG_KEYS`
- `output` must be in `VALID_OUTPUT_MODES`
- `haltOnFailure`, `strict`, `trace`, `debug` must be `typeof === "boolean"`
- `formatter` must be `null` or a class/constructor with a static `format` method
- `timeout` must be `typeof === "number"`, finite, and `>= 0`. The value is normalized via `Math.trunc` and the truncated integer is stored back into the resolved config before execution. Non-numeric, `NaN`, `Infinity`, or negative-after-truncation values throw `INVALID_CONFIG`. `0` disables timeout enforcement.

**Formatter resolution:** In JS, the caller passes the formatter class directly
(not a string path). The config validator checks that the value is `null` or
a constructor function with a static `format` method (`typeof === "function"`).
This avoids the complexity of string-based module resolution and is idiomatic
for JS — the test file imports its formatter and passes the class reference.

---

```javascript
// :: VOID -> VOID
// Validates all step definitions.
// Throws CTGTestError on first violation.
_validateSteps()
```

Validation rules (design doc ref: Definition Validation):
1. Test name must not be empty after trim → `INVALID_STEP`
2. Each step name must not be empty after trim → `INVALID_STEP`
3. Step names must be unique within this level → `INVALID_STEP`
4. Non-chain steps: `fn` must be `typeof === "function"` → `INVALID_STEP`
5. Error handlers, when not null, must be `typeof === "function"` → `INVALID_STEP`
6. Assert `expected` must not be `typeof === "function"` → `INVALID_EXPECTED`
7. Assert-any `expected` must be `Array.isArray()` → `INVALID_EXPECTED`
8. Chain `fn` must be an instance of `CTGTest` → `INVALID_CHAIN`

---

```javascript
// :: VOID -> VOID
// Validates all skip directives.
// Throws CTGTestError on first violation.
_validateSkips()
```

Validation rules (design doc ref: Skip Validation):
1. Skip name must not be empty after trim → `INVALID_SKIP`
2. Skip name must match an existing step name → `INVALID_SKIP`
3. No duplicate skip names → `INVALID_SKIP`
4. Predicate, when not null, must be `typeof === "function"` → `INVALID_SKIP`

---

```javascript
// :: *, OBJECT, INT, [ctgTestStep], [OBJECT] -> PROMISE([OBJECT])
// Executes steps sequentially, threading the subject.
// Each step callable is awaited — supports both sync and async callables.
// depth tracks chain nesting for the 64-level limit.
// steps and skips are passed explicitly so chain recursion can provide the
// chained test's definitions without modifying `this`.
async _executeSteps(subject, config, depth, steps, skips)
```

For each step:
1. Check skip directives — if matched and (no predicate or `await predicate(subject)` returns true), produce skip result
   - If predicate throws → produce error result with the step's own type-specific shape
2. Execute based on step type:
   - **stage:** `await fn(subject)`, update subject on success
   - **assert:** `await fn(subject)`, compare result against expected via `compare()`
   - **assert-any:** `await fn(subject)`, compare against each candidate
   - **chain:** validate depth < 64 (throw `INVALID_CHAIN` if not), then recurse with `await _executeSteps(subject, config, depth + 1, testInstance.steps, testInstance.skips)`
3. Error recovery: if fn throws and errorHandler exists, call `await errorHandler(error)`
   - Handler returns → `recovered` status; for stage, returned value becomes new subject; for assert, returned value compared against expected
   - Handler throws → `error` status with `caused_by` (format original exception first, pass as causedBy)
4. If `config.debug` is true, snapshot the subject before execution and attach as `subject` field
5. If `config.haltOnFailure` and status is `fail` or `error`, stop pipeline
6. Track `duration_ms` per step using `performance.now()` (milliseconds, rounded to integer)

**Chain depth validation** is checked at execution time only, not during upfront
validation. The same test definition can be chained at different depths depending
on composition, so depth is not knowable until execution. Upfront validation still
covers chain target type (`instanceof CTGTest`).

#### Skipped Step Result Shapes

Every step type produces its full type-specific shape when skipped, so formatters
receive a stable structure regardless of status:

- **Skipped stage:** `stepResult("stage", name, "skip", 0, null, null)`
- **Skipped assert:** `assertResult(name, "skip", 0, null, expected, null, null)` — `actual` is `null`
- **Skipped assert-any:** `assertAnyResult(name, "skip", 0, null, candidates, null, null)` — `actual` is `null`
- **Skipped chain:** `chainResult(name, "skip", 0, null, null, [], { passed: 0, failed: 0, skipped: 0, recovered: 0, errored: 0, total: 0 })`

**Skip-predicate exceptions** produce the same type-specific shape with status
`"error"` and the exception populated. The `duration_ms` reflects the predicate
execution time.

#### Per-Step Timeout

When `config.timeout` is a positive integer, every `await`ed callable (step fn,
error handler, skip predicate) is wrapped in a `Promise.race` against a timer.
The implementation uses a helper method:

```javascript
// :: ((*) -> *|PROMISE(*)), *, STRING, STRING, INT -> PROMISE(*)
// Races callable against a timeout timer. kind and stepName are for error context.
async _withTimeout(callable, arg, kind, stepName, timeoutMs)
```

Internally:

```javascript
const callablePromise = Promise.resolve(callable(arg));
if (timeoutMs <= 0) return callablePromise;

let timer;
const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(
        () => reject(new CTGTestError("INVALID_STEP",
            `Step '${stepName}' ${kind} timed out after ${timeoutMs}ms`,
            { step: stepName, timeout: timeoutMs, kind })),
        timeoutMs
    );
});

try {
    const result = await Promise.race([callablePromise, timeoutPromise]);
    clearTimeout(timer);
    return result;
} catch (err) {
    clearTimeout(timer);
    // Attach a sink catch to the original promise so late rejections
    // do not produce unhandled rejection noise
    callablePromise.catch(() => {});
    throw err;
}
```

**Unhandled rejection mitigation:** After timeout, the original callable's
promise may still reject. A no-op `.catch(() => {})` is attached to the
callable promise in the timeout path so that late rejections are silently
swallowed rather than surfacing as unhandled rejections. This catch is only
attached after timeout — on normal completion, the callable's rejection
propagates normally through the error handling path.

**Timeout error payload:**

On timeout, the error result includes:
- `status`: `"error"`
- `message`: `"Step '{stepName}' {kind} timed out after {N}ms"` — where
  `kind` is one of `"fn"`, `"errorHandler"`, or `"predicate"`
- `exception`: formatted `CTGTestError` with:
  - `class`: `"CTGTestError"`
  - `code`: `1000` (INVALID_STEP)
  - `message`: same as result message
  - `data`: `{ step: "{stepName}", timeout: {N}, kind: "{kind}" }`
- `duration_ms`: reflects the timeout duration (approximately equal to
  the configured timeout value)
- Type-specific shape preserved (assert results include `actual: null`,
  `expected`, etc.)

The timer is cleared via `clearTimeout` on normal completion to prevent
leaked timers.

When `config.timeout` is `0`, no timeout enforcement is applied — callables
are `await`ed directly.

**Scope — timeout applies to these async callables only:**
- Step fn (`stage`, `assert`, `assert-any`) — `kind: "fn"`
- Error handlers — `kind: "errorHandler"`
- Skip predicates — `kind: "predicate"`

**Timeout does NOT apply to:**
- Validation (synchronous — `_validateConfig`, `_validateSteps`, `_validateSkips`)
- Comparison (`compare()` and `_looseDeepEqual` are synchronous)
- Chain depth checks
- Chain recursion as a whole (individual steps within the chain are timed
  independently)
- `_snapshotSubject` (synchronous)
- Formatter `format()` calls (synchronous)

---

```javascript
// :: *, *, BOOL -> BOOL
// Default comparison. Subclasses may override for custom matching.
// Design doc ref: Comparison
// NOTE: This is the extension point — not matcher objects.
compare(actual, expected, strict)
```

1. Check uncomparable values first (both `actual` and `expected`):
   - `typeof === "function"` → throw `CTGTestError(INVALID_STEP, "Cannot compare closures")`
   - `instanceof Map` → throw `CTGTestError(INVALID_STEP, "Cannot compare Map instances")`
   - `instanceof Set` → throw `CTGTestError(INVALID_STEP, "Cannot compare Set instances")`
2. Strict mode (`strict === true`): delegate to `util.isDeepStrictEqual(actual, expected)` from `node:util`
3. Loose mode (`strict === false`): custom deep equality (see below)

**Strict mode** delegates entirely to Node's `util.isDeepStrictEqual`, which
handles circular references, typed arrays, Date, RegExp, NaN, -0, and all
other edge cases correctly.

**Loose mode** is implemented manually because Node provides no deep loose
equality built-in. Rules for specific types:

| Type | Loose behavior |
|------|---------------|
| `Date` | Compare via `.getTime()` (numeric milliseconds) |
| `RegExp` | Compare via `.toString()` (source + flags as string) |
| Typed arrays (`Uint8Array`, etc.) | Element-by-element with `==` |
| `NaN` | `NaN` loose-equals `NaN` → `true` (diverges from JS `==` but matches testing intent — comparing NaN to NaN in a test expects a match) |
| `-0` | `-0` loose-equals `0` → `true` (matches JS `==` behavior) |
| `BigInt` | `BigInt(42)` loose-equals `42` → `true` (matches JS `==` behavior) |
| `Array` | Index-by-index recursive comparison, length must match |
| Plain objects / class instances | Own enumerable properties compared recursively, `==` at leaf primitives |

Loose mode uses **pair-path tracking** for cycle detection: an array of
`[actual, expected]` pairs representing the current traversal path. Before
recursing into an object pair, the path is checked for a matching pair
(same references). If found, the comparison is cyclic and throws
`CTGTestError(INVALID_STEP)`. Pairs are pushed before recursing and popped
after returning (backtracking), so shared references that appear in
sibling branches are not falsely flagged as cycles. A depth counter capped
at `MAX_NESTING_DEPTH` (128) provides a secondary guard — depth exceeding
128 throws `CTGTestError(INVALID_STEP)`.

**Category gating:** Before falling through to generic object-key comparison,
loose mode checks that both values belong to the same object category.
Date, RegExp, typed arrays, DataView, and Array are compared using their
type-specific rules only when both sides match. If one side is a special
type and the other is not, the comparison returns `false` immediately.

---

```javascript
// :: *, INT -> *
// Creates a safe snapshot of the subject for debug mode.
// Design doc ref: Debug Mode
_snapshotSubject(subject, depth = 0)
```

| Value | Snapshot |
|-------|----------|
| Primitives (string, number, boolean, null, undefined) | As-is |
| Function | `"[Closure]"` |
| Array | Deep copy with recursion (depth-limited) |
| Object | Map with `__class` key (`constructor.name`) plus all own enumerable properties (deep copy) |
| Circular reference (seen via `WeakSet`) | `"[Circular: ClassName]"` using `constructor.name` |
| Depth > 128 | `"[Truncated: max depth]"` |
| Non-serializable built-ins (WeakMap, WeakSet, Promise, etc.) | `"[ClassName]"` using `constructor.name` |

**Edge case rules:**
- **Symbol keys:** Skipped — only string keys are included in snapshots
- **Non-enumerable properties:** Skipped — only own enumerable properties
- **Getters:** Skipped — only data properties are captured (properties with a `value` descriptor per `Object.getOwnPropertyDescriptor`, not those with a `get` descriptor). Debug mode must be purely observational and must not trigger side effects.
- **`BigInt`:** Converted to string with `"n"` suffix (e.g., `42n` → `"42n"`), matching `formatValue` output. This ensures all snapshots are JSON-safe without requiring formatters to handle BigInt serialization.

**Language-specific decision:** JS has no native resource handles. The `"[Resource: type]"` snapshot case from the design doc does not apply.

---

```javascript
// :: OBJECT, OBJECT -> STRING|OBJECT|VOID
// Formats and delivers the report based on output mode.
_deliver(report, config)
```

1. If `config.output === "return-json"` → return the raw report object (custom formatter is ignored)
2. Resolve formatter:
   - If `config.formatter` is set → use custom formatter class directly
   - Otherwise → use built-in formatter matching `config.output`:
     - `"console"` or `"return"` → `CTGTestConsoleFormatter`
     - `"json"` → `CTGTestJsonFormatter`
     - `"junit"` → `CTGTestJunitFormatter`
3. Call `Formatter.format(report, config)` wrapped in try/catch:
   - If formatter throws a `CTGTestError` → re-throw directly
   - If formatter throws any other error → throw `CTGTestError(FORMATTER_ERROR)` with data `{ formatter: Formatter.name, exception: formatException(e), report }`
4. Delivery based on output mode:
   - `"return"` → return the formatted string (no stdout, no newline appended)
   - `"console"`, `"json"`, `"junit"` → `process.stdout.write(formatted + "\n")`, return `undefined`

This applies uniformly to both built-in and custom formatters. Output mode
controls delivery behavior; formatter controls content.

**Newline policy:** Formatters must NOT include a trailing newline in their
return value. The delivery layer appends exactly one `"\n"` when writing to
stdout. For `"return"` mode, no newline is appended — the caller receives the
raw formatted string.

### Static Methods

```javascript
// Static Factory Method :: STRING -> ctgTest
// Creates a new test definition with the given name.
// Design doc ref: init
static init(name)
```

Returns `new this(name)`. Uses `new this(...)` for late-bound construction so subclasses inherit correctly.

---

```javascript
// :: OBJECT -> VOID
// Stores CLI configuration for retrieval by test files.
// Design doc ref: setCliConfig
static setCliConfig(config)
```

Stores config on a static field `_cliConfig`.

---

```javascript
// :: VOID -> OBJECT
// Returns CLI config set by the runner. Returns {} if none was set.
// Design doc ref: getCliConfig
static getCliConfig()
```

Returns `_cliConfig` or `{}`.

### Language-Specific Decisions

- **Design doc:** "callable" → `typeof value === "function"` in JS (covers both sync and async functions)
- **Design doc:** "mutable builder returning self" → each definition method returns `this`
- **Design doc:** "late-bound construction" → `new this(name)` in static `init`
- **Async divergence:** `start()` is `async`, `_executeSteps()` is `async`, all step callables are `await`ed. See Design Doc Divergences section.
- **Duration tracking:** `performance.now()` from `node:perf_hooks` (Node.js built-in), rounded to integer ms
- **CLI config storage:** Static field `_cliConfig = null` (underscore-prefixed, not `#private`)
- **stdout output:** Uses `process.stdout.write()` (no trailing newline ambiguity from `console.log`)
- **Chain depth validation:** Checked at execution time only in `_executeSteps`, not during upfront validation. The depth counter is passed through recursive calls. The same test definition could be chained at different depths depending on composition.
- **Comparison:** Strict mode wraps `util.isDeepStrictEqual`; loose mode is manual. Both paths share the same `compare()` interface for subclass override. Map and Set are uncomparable in both modes.

---

## Formatter Interface

**Design doc ref:** Formatter Interface

No formal interface file in JS (no language-level interfaces). The contract is:

```javascript
// Any formatter class must implement:
// :: OBJECT, OBJECT? -> STRING
static format(report, config = {})
```

Formatter classes are validated at config time by checking that the value
is a constructor function with a static `format` method that is `typeof === "function"`.

**Newline contract:** Formatters must NOT include a trailing newline in
their return value. The delivery layer is responsible for framing.

---

## Class: CTGTestConsoleFormatter

**File:** `src/formatters/CTGTestConsoleFormatter.js`
**Design doc ref:** Console Formatter

### Static Methods

```javascript
// :: OBJECT, OBJECT? -> STRING
// Human-readable output with indented tree structure.
static format(report, config = {})
```

Output format:
```
Test Name
  [stage]      step name (Xms) ................. PASS
  [assert]     check value (Xms) ............... PASS
  [assert-any] multi check (Xms) ............... FAIL
  [chain]      group name (Xms) ................ PASS
    [stage]    nested step (Xms) ............... PASS

3 passed, 1 failed, 0 skipped, 0 recovered, 0 errored (Xms)
```

- Step type in brackets
- Step name followed by duration in parens
- Dot-padding to align status labels (right-aligned to a fixed column, e.g., 72 chars)
- Status in UPPERCASE
- Chain children indented with additional 2 spaces per nesting level
- Summary line with counts and total duration
- Failed/errored steps: include message/exception info on subsequent indented lines
- No trailing newline (delivery layer appends it)

---

## Class: CTGTestJsonFormatter

**File:** `src/formatters/CTGTestJsonFormatter.js`
**Design doc ref:** JSON Formatter

### Static Methods

```javascript
// :: OBJECT, OBJECT? -> STRING
// Pretty-printed JSON serialization of the full report structure.
static format(report, config = {})
```

Uses `JSON.stringify(report, replacer, 2)` with a replacer function that
converts `BigInt` values to string with `"n"` suffix (e.g., `42n` → `"42n"`).
This is necessary because `JSON.stringify` throws on BigInt, and `actual`/`expected`
fields in assert results can hold any value the test author passes through —
not just debug snapshots. The replacer is defined as a static utility method on
`CTGTestJsonFormatter` so other formatters that need JSON serialization can
reuse it rather than duplicating the logic. No trailing newline.

---

## Class: CTGTestJunitFormatter

**File:** `src/formatters/CTGTestJunitFormatter.js`
**Design doc ref:** JUnit Formatter

### Static Methods

```javascript
// :: OBJECT, OBJECT? -> STRING
// JUnit XML output for CI integration.
static format(report, config = {})
```

Mapping:
- Root report → `<testsuite>` (matches PHP implementation; not `<testsuites>`)
- `<testsuite>` attributes: `name`, `tests`, `failures`, `errors`, `skipped`, `time`
- Stage/assert/assert-any steps → `<testcase>` with `name`, `time` attributes
- Chain steps → nested `<testsuite>` (recursive)
- `pass` → bare `<testcase>`
- `fail` → `<testcase>` with `<failure message="..." type="AssertionFailure">` child; body includes Expected/Actual
- `error` → `<testcase>` with `<error message="..." type="ClassName">` child; optional trace from config
- `skip` → `<testcase>` with `<skipped/>` child
- `recovered` → `<testcase>` with `<system-out>` child (JUnit has no recovery concept — lossy mapping)
- Time attributes in seconds: `duration_ms / 1000`

XML is built via string concatenation (no external XML library). Special characters (`<`, `>`, `&`, `"`, `'`) are escaped in attribute values and text content. No trailing newline.

---

## CLI Runner

**File:** `bin/ctg-test`
**Design doc ref:** CLI Runner

Node.js executable script with `#!/usr/bin/env node` shebang.

### Behavior

1. Parse `process.argv` for flags
2. Set shared configuration via `CTGTest.setCliConfig(parsedConfig)`
3. Discover test files (see Test File Discovery)
4. For each test file:
   a. Reset `CTGTest._results = []`
   b. Dynamically `await import(pathToFileURL(absPath).href)` using `node:url`'s `pathToFileURL` (file imports `CTGTest`, calls `getCliConfig()` to pick up CLI settings, builds and starts tests). Using `pathToFileURL` avoids platform edge cases with Windows drive letters and special characters in paths.
   c. If import threw → mark file as failed
   d. Check `CTGTest._results` for any `fail` or `error` status → mark as failed
5. Exit with `process.exit(1)` if any file failed to load, any test reported `fail` or `error` status, or framework threw `RUNNER_ERROR`. Exit `0` otherwise.

### Flags

| Flag | Config Key | Description |
|------|-----------|-------------|
| `--format=MODE` | `output` | Output mode |
| `--no-halt` | `haltOnFailure: false` | Continue on failures |
| `--loose` | `strict: false` | Use loose comparison |
| `--trace` | `trace: true` | Include stack traces |
| `--timeout=N` | `timeout: N` | Per-step timeout in ms (0 = disabled) |
| `--help` | — | Show usage |

#### `--timeout` Validation

- Missing value (`--timeout` with no `=N`): ignored, default applies
- Non-numeric (`--timeout=abc`): emit warning to stderr, use default
- Negative (`--timeout=-1`): emit warning to stderr, use default
- Non-integer float (`--timeout=1.5`): truncated to integer via `Math.trunc`
  before any further validation. Truncation is silent (no warning) since the
  intent is clear. The truncated value is then subject to the same rules as
  any integer (e.g., `--timeout=0.7` truncates to `0`, which disables timeout).
- Zero (`--timeout=0`): valid, disables timeout enforcement

CLI validation is intentionally lenient (warn + fallback to default) since
the runner is a user-facing entry point. `_validateConfig` inside `start()`
is strict (throw `INVALID_CONFIG`) since programmatic callers should get
immediate feedback on bad config values. These are separate validation paths.

**Precedence:** CLI config is a baseline. Test files that pass their own
`timeout` in the config object to `start()` override the CLI value for that
call. `start()` merges caller config over defaults — CLI config is only used
when the test file spreads `CTGTest.getCliConfig()` into its config object.

### Exit Codes

- `0` — all test files executed and all tests passed
- `1` — a test file failed to load, framework threw runner-level error, or any test reported `fail` or `error` status

The runner inspects the report status from each `start()` call via a static
result collector on `CTGTest`. If any report has a status of `fail` or `error`,
the runner exits with code `1`.

#### Static Result Collector

`CTGTest` maintains a static result array that `start()` populates automatically.
This enables the runner to track test outcomes regardless of output mode, without
requiring test files to change their code for CI.

```javascript
// On CTGTest class:
static _results = [];

// At end of start(), before delivery:
CTGTest._results.push({ name: this._name, status: report.status });
```

Each entry records:
- `name` — the test name passed to `init()`
- `status` — the aggregate report status (`"pass"`, `"fail"`, `"error"`, `"recovered"`, `"skip"`)

**Lifecycle and reset boundaries:**

The runner resets `CTGTest._results` to `[]` **before each file import**.
This creates a clean per-file window:

```javascript
for (const file of files) {
    CTGTest._results = [];
    try {
        await import(pathToFileURL(file).href);
    } catch (err) { ... }
    // Check _results for this file
    for (const result of CTGTest._results) {
        if (result.status === "fail" || result.status === "error") {
            hadFailure = true;
        }
    }
}
```

This ensures:
- Results from file A don't leak into file B's check
- Multiple `start()` calls within one file are all captured
- Results are attributed to the file that produced them by position
  in the runner's file loop (no explicit file tagging needed)

`_results` is **internal and unstable** — it exists solely for runner-to-framework
communication. Test files must not read, modify, or depend on it. Its structure,
naming, and behavior may change without notice. It is not part of the public API
and carries no stability guarantees.

When `start()` is called outside the CLI runner (e.g., in self-tests or
programmatic usage), `_results` still accumulates as a side effect. This has
no effect on `start()`'s return value or output behavior. External callers
should not rely on `_results` for any purpose.

### Test File Discovery

Uses `node:fs` and `node:path` built-ins only (no glob dependency):

1. If specific files passed as positional args:
   - Resolve each to absolute path via `path.resolve()`
   - Deduplicate (first occurrence wins)
   - Directory args are not supported — emit warning to stderr and skip
2. Otherwise, auto-discover:
   - Check CWD for files matching `*Test.js`
   - If none found, check `tests/` subdirectory for `*Test.js`
3. Sort discovered files alphabetically (`Array.sort()` on filenames)
4. Symlinks are followed (default `readdirSync` behavior)

Argument parsing is done manually against `process.argv` (no dependency on
yargs/commander).

### Language-Specific Decisions

- **Design doc:** "require/execute the file" → uses dynamic `await import(pathToFileURL(absPath).href)` (ESM) with `node:url` for cross-platform path safety
- **Design doc:** `*Test.{ext}` → `*Test.js`
- Test files are ESM modules that import `CTGTest` and execute on import (side-effect imports match the PHP `require` pattern)

---

## Conformance Test Traceability

Every conformance test case from the design doc maps to this implementation as follows.
Features listed in the Implementation Status section are excluded from this table
until implemented.

| Design Doc Section | JS Mechanism |
|---|---|
| Pipeline Threading | `_executeSteps` subject variable passed through stages, unchanged by asserts |
| Assert Comparison | `compare()` wrapping `util.isDeepStrictEqual` (strict) / manual deep `==` (loose) |
| Error Recovery | try/catch in `_executeSteps`, `await errorHandler(...)`, `caused_by` via `formatException` |
| Skip Directives | `_skips` array checked per step in `_executeSteps`; `await predicate(subject)`; predicate errors → error status |
| Chain Behavior | Recursive `await _executeSteps(subject, config, depth+1, testInstance.steps, testInstance.skips)` |
| Halt on Failure | `config.haltOnFailure` check after each step result |
| Status Aggregation | `CTGTestResult.aggregateStatus()` with `SEVERITY` map |
| Definition Validation | `_validateSteps()` and `_validateSkips()` in `start()` before execution |
| Config Validation | `_validateConfig()` in `start()` before step validation |
| Custom Formatter | `_deliver()` routes through custom formatter with `FORMATTER_ERROR` wrapping |
| Error Construction | `CTGTestError` constructor with bidirectional lookup |
| Debug Mode Snapshots | `_snapshotSubject()` with `WeakSet` cycle detection |
| Exception Structure | `CTGTestResult.formatException()` |

---

## What This Spec Does NOT Add

Per design doc compatibility policy: "If a method or behavior is not in this document, it does not exist."

- No parallel execution (pipeline is sequential; async is for awaiting individual steps)
- No separate `asyncAssert` / `asyncStage` methods (uniform `await` on all callables)
- No assertion matchers or expect-style API
- No `on`/`otherwise` on CTGTestError
- No test fixtures or setup/teardown hooks (beforeAll/afterEach/etc.)
- No mocking/stubbing/spies
- No watch mode or changed-files rerun
- No code coverage integration (use external tools like `c8`)
- No describe/it test registry or tagging — pipeline composition via `chain()` serves this role
- No process isolation or worker parallelism — sequential single-process execution
- No AbortSignal passed to callables — timeout races the promise but cannot cancel it
- No per-step timeout override — `timeout` is config-level only
- No TypeScript-native pipeline or browser targets
- No plugin API for reporters — custom formatters passed via `formatter` config key
