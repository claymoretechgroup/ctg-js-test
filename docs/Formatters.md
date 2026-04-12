# Formatters

Formatter utilities that accept CTGTestState and return a formatted string. Formatters are not referenced by CTGTest — the caller imports and uses them directly. No trailing newline — the caller appends it.

```javascript
import CTGTestConsoleFormatter from "ctg-js-test/formatters/CTGTestConsoleFormatter.js";

const state = await pipeline.start(subject);
const formatted = CTGTestConsoleFormatter.format(state);
process.stdout.write(formatted + "\n");
```

---

## CTGTestConsoleFormatter

Human-readable console output formatter. Accepts a CTGTestState and produces formatted text for terminal display. All methods are static — this class is not instantiated.

### CTGTestConsoleFormatter.format :: CTGTestState -> STRING

Formats state as human-readable text. Output includes a pipeline header, one line per result with status tags (`[PASS]`, `[FAIL]`, `[ERROR]`, `[SKIPPED]`), detail lines for failures and errors, and a summary with counts and overall result. Wraps native errors as `FORMATTER_ERROR` (2000).

```javascript
const state = await CTGTest.init("my test")
    .assert("check", (state) => state.subject, 42)
    .start(42);

console.log(CTGTestConsoleFormatter.format(state));
// Pipeline: my test
//
//   [PASS]    my test > check
//
// ---
// 1 passed, 0 failed, 0 skipped, 0 errored (1 total)
// Result: PASS
```

---

## CTGTestJsonFormatter

JSON formatter with BigInt-safe serialization. Accepts a CTGTestState and produces pretty-printed JSON. All methods are static — this class is not instantiated.

### CTGTestJsonFormatter.format :: CTGTestState -> STRING

Pretty-printed JSON serialization of the state. Delegates to `JSON.stringify` with a BigInt replacer and 2-space indentation. Wraps native errors as `FORMATTER_ERROR` (2000).

```javascript
const state = await CTGTest.init("my test")
    .assert("check", (state) => state.subject, 42)
    .start(42);

console.log(CTGTestJsonFormatter.format(state));
```

---

### CTGTestJsonFormatter.bigIntReplacer :: STRING, * -> *

JSON replacer function that converts BigInt values to strings with an `"n"` suffix. Used internally by `format` and available for external use.

```javascript
JSON.stringify({ count: 9007199254740993n }, CTGTestJsonFormatter.bigIntReplacer);
// '{"count":"9007199254740993n"}'
```
