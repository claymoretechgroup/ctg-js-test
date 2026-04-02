# CTGTestResult

Static utility class for creating result structures, aggregating statuses, and formatting values. No constructor or instance state — all methods are static.

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| STATUS_PASS | STRING | `"pass"` |
| STATUS_FAIL | STRING | `"fail"` |
| STATUS_ERROR | STRING | `"error"` |
| STATUS_RECOVERED | STRING | `"recovered"` |
| STATUS_SKIP | STRING | `"skip"` |
| SEVERITY | OBJECT | Severity ordering: error(5) > fail(4) > recovered(3) > pass(2) > skip(1) |

---

### CTGTestResult.stepResult :: STRING, STRING, STRING, INT, STRING?, OBJECT? -> OBJECT

Creates a stage-type result. Returns `{ type, name, status, duration_ms, message, exception }`.

---

### CTGTestResult.assertResult :: STRING, STRING, INT, *, *, STRING?, OBJECT? -> OBJECT

Creates an assert result with `actual` and `expected` fields.

---

### CTGTestResult.assertAnyResult :: STRING, STRING, INT, *, [*], STRING?, OBJECT? -> OBJECT

Creates an assert-any result with `actual` and `candidates` fields.

---

### CTGTestResult.chainResult :: STRING, STRING, INT, STRING?, OBJECT?, [OBJECT], OBJECT -> OBJECT

Creates a chain result with nested step results and aggregate counts (`passed`, `failed`, `skipped`, `recovered`, `errored`, `total`).

---

### CTGTestResult.report :: STRING, [OBJECT] -> OBJECT

Assembles a root report from step results. Calls `countSteps`, `aggregateStatus`, and `sumDuration` internally. The root report has no `type` field.

```javascript
const report = CTGTestResult.report("my test", stepResults);
// { name, status, passed, failed, skipped, recovered, errored, total, duration_ms, steps }
```

---

### CTGTestResult.aggregateStatus :: [OBJECT] -> STRING

Derives the worst status from child steps using severity ordering. Empty list returns `"pass"`.

---

### CTGTestResult.countSteps :: [OBJECT] -> OBJECT

Counts steps by status at the current level only (no recursion into chains). Returns `{ passed, failed, skipped, recovered, errored, total }`.

---

### CTGTestResult.sumDuration :: [OBJECT] -> INT

Sums `duration_ms` across steps at the current level.

---

### CTGTestResult.formatException :: Error, BOOL, OBJECT? -> OBJECT

Serializes an exception to a structured map. Returns `{ class, message, code, trace?, data?, caused_by? }`. The `code` field is `null` when absent (not `0`). The `data` field is included when the exception has a non-null `data` property (e.g., CTGTestError timeout payloads).

```javascript
const exc = CTGTestResult.formatException(new RangeError("boom"), true);
// { class: "RangeError", message: "boom", code: null, trace: "..." }
```

---

### CTGTestResult.formatValue :: * -> STRING

Serializes any value to a human-readable string for display in error messages and formatter output.

| Value | Output |
|-------|--------|
| `null` / `undefined` | `"null"` |
| `true` / `false` | `"true"` / `"false"` |
| `42` | `"42"` |
| `3.14` | `"3.14"` |
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
