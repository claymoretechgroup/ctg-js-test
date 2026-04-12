# CTGTestResult

Frozen value object representing a single step outcome, plus static utilities for status aggregation, counting, and formatting. Results are constructed via factory methods only — the constructor is not public API.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| label | [STRING] | Label path from pipeline root to this step |
| skipped | BOOL | Whether this step was skipped |
| status | INT? | Status code (0 = PASS, 1 = FAIL, 2 = ERROR), undefined if skipped |
| computedValue | * | Actual value produced by an assert step |
| expectedOutcome | * | Expected value for an assert step |
| error | Error? | Exception captured during step execution |

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| STATUS | OBJECT | Frozen enum: `{ PASS: 0, FAIL: 1, ERROR: 2 }` |
| STATUS_LABELS | OBJECT | Frozen reverse map: `{ 0: "pass", 1: "fail", 2: "error" }` |
| SEVERITY | OBJECT | Frozen severity ordering: `{ 2: 3, 1: 2, 0: 1 }` |

---

### CTGTestResult.stageResult :: [STRING], INT, Error? -> ctgTestResult

Creates a stage result (PASS or ERROR). `computedValue` and `expectedOutcome` are undefined.

```javascript
const result = CTGTestResult.stageResult(["pipeline", "setup"], CTGTestResult.STATUS.PASS);
```

---

### CTGTestResult.assertResult :: [STRING], INT, *, *, Error? -> ctgTestResult

Creates an assert result (PASS, FAIL, or ERROR).

```javascript
const result = CTGTestResult.assertResult(
    ["pipeline", "check value"], CTGTestResult.STATUS.FAIL, 41, 42
);
```

---

### CTGTestResult.skippedResult :: [STRING] -> ctgTestResult

Creates a skipped result. All evaluation fields are undefined.

```javascript
const result = CTGTestResult.skippedResult(["pipeline", "optional step"]);
```

---

### CTGTestResult.statusLabel :: INT -> STRING

Resolves a status code to its human-readable label.

```javascript
CTGTestResult.statusLabel(0); // "pass"
CTGTestResult.statusLabel(2); // "error"
```

---

### CTGTestResult.aggregateStatus :: [ctgTestResult] -> INT

Derives the worst status from a results array using severity ordering. Skipped results are ignored. An empty list returns `STATUS.PASS`.

```javascript
const worst = CTGTestResult.aggregateStatus(state.results); // 0, 1, or 2
```

---

### CTGTestResult.countResults :: [ctgTestResult] -> { passed: INT, failed: INT, errored: INT, skipped: INT, total: INT }

Counts results by category.

```javascript
const counts = CTGTestResult.countResults(state.results);
console.log(counts.passed, counts.total);
```

---

### CTGTestResult.sumDuration :: [ctgTestResult] -> INT

Sums `durationMs` across results at the current level.

```javascript
const totalMs = CTGTestResult.sumDuration(state.results);
```

---

### CTGTestResult.report :: STRING, [ctgTestResult] -> OBJECT

Assembles a root report object containing name, status, counts, and results. Calls `countResults` and `aggregateStatus` internally.

```javascript
const report = CTGTestResult.report("my test", state.results);
// { name, status, passed, failed, errored, skipped, total, results }
```

---

### CTGTestResult.formatException :: Error, BOOL, OBJECT? -> OBJECT

Serializes an exception to a structured map. Returns `{ class, message, code, trace?, data?, caused_by? }`. The `code` field is `null` when absent. The `data` field is included when the exception has a non-null `data` property. The `causedBy` argument is a pre-formatted exception map, not a raw Error.

```javascript
try {
    throw new Error("boom");
} catch (err) {
    const formatted = CTGTestResult.formatException(err, true);
    // { class: "Error", message: "boom", code: null, trace: "..." }
}
```

---

### CTGTestResult.formatValue :: * -> STRING

Serializes any value to a human-readable string for display in test output.

| Value | Output |
|-------|--------|
| `null` / `undefined` | `"null"` |
| `true` / `false` | `"true"` / `"false"` |
| `42` | `"42"` |
| `NaN` | `"NaN"` |
| `Infinity` | `"Infinity"` |
| `42n` (BigInt) | `"42n"` |
| `"hello"` | `"'hello'"` |
| `[1, 2]` | `"array(2)"` |
| `new Map(...)` | `"Map(N)"` |
| `new Set(...)` | `"Set(N)"` |
| function | `"[Closure]"` |
| `Symbol("x")` | `"symbol(x)"` |
| object | `"object(ClassName)"` |
