# ctg-js-test

`ctg-js-test` is a composable, pipeline-based test framework for JavaScript (Node.js, ESM). Tests are defined as pipelines of stage and assert steps on a threaded subject. Stage transforms the subject. Assert evaluates something about the subject without mutating it. Chain composes test instances together. The pipeline returns a `CTGTestState` to the caller — the caller owns formatting, collection, and delivery.

**Key Features:**

* **Pipeline model**: Tests are ordered sequences of stages and asserts on a threaded subject
* **Caller-owned reporting**: Pipeline returns state, caller decides how to format and deliver results
* **Composable**: Chain separately defined test instances into larger pipelines
* **Async-native**: All callables are `await`ed — no separate async API needed
* **Five-status reporting**: pass, fail, error, recovered, skip — not just pass/fail
* **Per-step timeout**: Configurable timeout prevents hung async operations from blocking the pipeline
* **Zero dependencies**: Only Node.js built-ins (`node:util`, `node:perf_hooks`)

## Install

```
npm install claymoretechgroup/ctg-js-test
```

## Examples

### Basic Pipeline

Define a test pipeline and run it:

```javascript
import CTGTest from "ctg-js-test";

const state = await CTGTest.init("arithmetic")
    .stage("setup", (state) => { state.subject = state.subject + 1; return state; })
    .assert("incremented", (state) => state.subject, 2)
    .start(1);
```

### Composing Pipelines

Define reusable test components and chain them together:

```javascript
const validatePositive = CTGTest.init("positive check")
    .assert("is positive", (state) => state.subject > 0, true);

const test = CTGTest.init("math pipeline")
    .stage("double", (state) => { state.subject = state.subject * 2; return state; })
    .chain("validate", validatePositive);

const state = await test.start(5);
```

### Async Steps

Test async code naturally — HTTP calls, database queries, file I/O:

```javascript
const state = await CTGTest.init("api test")
    .stage("fetch user", async (state) => {
        const res = await fetch(`https://api.example.com/users/${state.subject}`);
        state.subject = await res.json();
        return state;
    })
    .assert("has name", (state) => typeof state.subject.name, "string")
    .start(42);
```

### Error Recovery

Stage and assert steps accept an optional error handler:

```javascript
const state = await CTGTest.init("resilient")
    .stage("connect",
        async (state) => { state.subject = await connectDB(state.subject); return state; },
        async (err) => await connectFallbackDB()
    )
    .assert("connected", (state) => state.subject.isConnected, true)
    .start({ host: "primary.db" });
```

### Conditional Skip

Skip steps by name, unconditionally or based on a predicate:

```javascript
const state = await CTGTest.init("conditional")
    .skip("skip expensive", "expensive", (state) => state.subject < 10)
    .stage("setup", (state) => state)
    .stage("expensive", async (state) => { state.subject = await heavyComputation(state.subject); return state; })
    .assert("result", (state) => state.subject > 0, true)
    .start(5);
```

### Caller-Owned Reporting

The pipeline returns `CTGTestState`. The caller formats and delivers results:

```javascript
import CTGTestResult from "ctg-js-test/result";
import CTGTestConsoleFormatter from "ctg-js-test/formatter/console";
import CTGTestJsonFormatter from "ctg-js-test/formatter/json";

const state = await CTGTest.init("example")
    .assert("check", (state) => state.subject, 5)
    .start(5);

// Human-readable console output
const text = CTGTestConsoleFormatter.format(state);
process.stdout.write(text + "\n");

// JSON output
const json = CTGTestJsonFormatter.format(state);
process.stdout.write(json + "\n");

// Exit code from state status
const S = CTGTestResult.STATUS;
const failed = state.status === S.FAIL || state.status === S.ERROR;
process.exit(failed ? 1 : 0);
```

### Timeout

Per-step timeout prevents hung async operations. Default is 5000ms:

```javascript
// Custom timeout
const state = await test.start(subject, { timeout: 10000 });

// Disable timeout
const state = await test.start(subject, { timeout: 0 });
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `haltOnFailure` | boolean | `true` | Stop pipeline on first fail or error |
| `timeout` | number | `5000` | Per-step timeout in ms (0 = disabled) |

## Considerations

### Skip Ordering

Skip steps must currently appear before their target in the pipeline because steps execute sequentially — a skip defined after its target would never fire. However, since all step definitions are known at `start()` time, skip could instead function as a lookup consulted before each step executes, removing the ordering constraint. This would make skip behave more like a config option than a pipeline step, but binding predicates to specific step labels is cleaner as a method call (`.skip(name, target, predicate)`) than as a config map. A future version may revisit whether skip should remain a step type or become a separate mechanism.

### JUnit Formatter

A JUnit XML formatter was removed in v2.1.0 because its output could not be validated against the JUnit schema without introducing a dev dependency for XML parsing. The formatter concept is supported — console and JSON formatters ship with the framework — and JUnit may be reintroduced in a future version once proper validation is in place.

## Notice

`ctg-js-test` is under active development. The core pipeline API is stable.
