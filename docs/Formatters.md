# Formatters

Formatter utilities that accept CTGTestState and return a formatted string. Formatters are not referenced by CTGTest — the caller imports and uses them directly. No trailing newline — the caller appends it.

```javascript
import CTGTestConsoleFormatter from "ctg-js-test/formatters/CTGTestConsoleFormatter.js";

const state = await pipeline.start(subject, config);
const formatted = CTGTestConsoleFormatter.format(state);
process.stdout.write(formatted + "\n");
```

---

## CTGTestConsoleFormatter

Human-readable output with indented tree structure and dot-padded status alignment.

### CTGTestConsoleFormatter.format :: CTGTestState, OBJECT? -> STRING

Formats state as human-readable text. Step types are shown in brackets, durations in parentheses, statuses right-aligned. Chain children are indented. Summary line shows counts and total duration.

```
My Test
  [stage]  double (2ms) ......................... PASS
  [assert] check value (1ms) .................... FAIL
    expected 10 but got 8

1 passed, 1 failed, 0 skipped, 0 recovered, 0 errored (3ms)
```

---

## CTGTestJsonFormatter

Pretty-printed JSON serialization with BigInt handling.

### CTGTestJsonFormatter.format :: CTGTestState, OBJECT? -> STRING

Serializes the state to JSON with 2-space indentation. BigInt values are converted to strings with `"n"` suffix via a static replacer.

### CTGTestJsonFormatter.bigIntReplacer :: STRING, * -> *

JSON replacer function that converts BigInt values to `"Nn"` strings. Available as a static utility for other formatters that need JSON serialization.

---

## CTGTestJunitFormatter

JUnit XML output for CI integration.

### CTGTestJunitFormatter.format :: CTGTestState, OBJECT? -> STRING

Produces JUnit XML. State results map to `<testsuite>`. Steps map to `<testcase>`. Chains map to nested `<testsuite>`. Status mapping:

| Status | JUnit Element |
|--------|---------------|
| pass | bare `<testcase>` |
| fail | `<testcase>` with `<failure>` child |
| error | `<testcase>` with `<error>` child |
| skip | `<testcase>` with `<skipped/>` child |
| recovered | `<testcase>` with `<system-out>` child |

---

## Custom Formatters

Any class with a static `format(state, config?)` method can be used as a formatter. The caller chooses the formatter — the pipeline does not reference formatters.

```javascript
class MyFormatter {
    static format(state, config = {}) {
        return `${state.name}: ${state.status}`;
    }
}

const state = await test.start(subject);
const output = MyFormatter.format(state);
```
