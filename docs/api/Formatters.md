# Formatters

All formatters implement the same static contract: `static format(report, config) -> STRING`. Formatters must not include a trailing newline — the delivery layer appends it when writing to stdout.

---

## CTGTestConsoleFormatter

Human-readable output with indented tree structure and dot-padded status alignment.

### CTGTestConsoleFormatter.format :: OBJECT, OBJECT? -> STRING

Formats a report as human-readable text. Step types are shown in brackets, durations in parentheses, statuses right-aligned. Chain children are indented. Summary line shows counts and total duration.

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

### CTGTestJsonFormatter.format :: OBJECT, OBJECT? -> STRING

Serializes the report to JSON with 2-space indentation. BigInt values are converted to strings with `"n"` suffix via a static replacer.

### CTGTestJsonFormatter.bigIntReplacer :: STRING, * -> *

JSON replacer function that converts BigInt values to `"Nn"` strings. Available as a static utility for other formatters that need JSON serialization.

---

## CTGTestJunitFormatter

JUnit XML output for CI integration.

### CTGTestJunitFormatter.format :: OBJECT, OBJECT? -> STRING

Produces JUnit XML. Root report maps to `<testsuite>`. Steps map to `<testcase>`. Chains map to nested `<testsuite>`. Status mapping:

| Status | JUnit Element |
|--------|---------------|
| pass | bare `<testcase>` |
| fail | `<testcase>` with `<failure>` child |
| error | `<testcase>` with `<error>` child |
| skip | `<testcase>` with `<skipped/>` child |
| recovered | `<testcase>` with `<system-out>` child |

---

## Custom Formatters

Pass a class with a static `format` method via the `formatter` config key:

```javascript
class MyFormatter {
    static format(report, config = {}) {
        return `${report.name}: ${report.status}`;
    }
}

await test.start(subject, { output: "return", formatter: MyFormatter });
```

The custom formatter is used for content generation. Output mode still controls delivery (`return` gives you the string, `console`/`json`/`junit` write to stdout). `return-json` always returns the raw report object, ignoring the formatter.
