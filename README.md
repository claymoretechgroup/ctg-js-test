# ctg-js-test

`ctg-js-test` is a composable, pipeline-based test framework for JavaScript (Node.js, ESM). Tests are defined as pipelines of stage and assert operations on a threaded subject. Stage transforms the subject. Assert computes a value and evaluates it against a predicate. Chain composes pipelines together. The framework separates test definition from execution — the pipeline returns a `CTGTestState` to the caller, and the caller owns formatting, collection, and delivery.

**Key Features:**

* **Pipeline model**: Tests are ordered sequences of stages and asserts on a threaded subject
* **Predicate-based assertions**: Comparison logic lives in predicates, not the pipeline — extensible without modifying the core
* **Composable**: Chain separately defined pipelines into larger test sequences sharing the same state
* **Caller-owned reporting**: Pipeline returns state; caller decides how to format and deliver results
* **Async-native**: All handlers are `await`ed — sync and async handlers work transparently
* **Per-operation timeout**: Configurable timeout prevents hung async operations from blocking the pipeline
* **Zero dependencies**: Only Node.js built-ins (`node:util`)

## Install

```
npm install claymoretechgroup/ctg-js-test
```

## Examples

### Basic Pipeline

Define a test pipeline and run it:

```javascript
import CTGTest from "ctg-js-test";
import CTGTestPredicates from "ctg-js-test/predicates";

const state = await CTGTest.init("arithmetic")
    .stage("add one", (state) => state.subject + 1)
    .assert("is two", (state) => state.subject, CTGTestPredicates.equals(2))
    .start(1);
```

### Predicates

Predicates define how assert operations evaluate correctness. The framework ships 17 convenience builders:

```javascript
import CTGTestPredicates from "ctg-js-test/predicates";

// Deep equality
CTGTestPredicates.equals({ name: "Alice" })

// Void check (null or undefined)
CTGTestPredicates.isVoid()

// Type check
CTGTestPredicates.isType("string")

// Any of several values
CTGTestPredicates.anyOf([200, 201, 204])

// Custom logic
CTGTestPredicates.satisfies((v) => v > 0 && v < 100)
```

### Composing Pipelines

Define reusable pipelines and chain them together:

```javascript
const validatePositive = CTGTest.init("positive check")
    .assert("is positive", (state) => state.subject, CTGTestPredicates.greaterThan(0));

const test = CTGTest.init("math pipeline")
    .stage("double", (state) => state.subject * 2)
    .chain("validate", validatePositive);

const state = await test.start(5);
```

Chain runs the sub-pipeline's operations against the same state object. Subject changes inside a chain are visible to the outer pipeline.

### Async Operations

Test async code naturally:

```javascript
const state = await CTGTest.init("api test")
    .stage("fetch user", async (state) => {
        const res = await fetch(`https://api.example.com/users/${state.subject}`);
        return await res.json();
    })
    .assert("has name", (state) => typeof state.subject.name, CTGTestPredicates.equals("string"))
    .start(42);
```

### Conditional Skip

Skip operations by target label, unconditionally or with a condition:

```javascript
const state = await CTGTest.init("conditional")
    .stage("setup", (state) => state.subject)
    .skip("expensive", (state) => state.subject < 10)
    .stage("expensive", async (state) => await heavyComputation(state.subject))
    .assert("result", (state) => state.subject, CTGTestPredicates.greaterThan(0))
    .start(5);
```

Skip directives can appear at any position in the builder sequence. The condition is evaluated when the target operation is reached during execution.

### Caller-Owned Reporting

The pipeline returns `CTGTestState`. The caller formats and delivers results:

```javascript
import CTGTestResult from "ctg-js-test/result";
import CTGTestConsoleFormatter from "ctg-js-test/formatter/console";

const state = await CTGTest.init("example")
    .assert("check", (state) => state.subject, CTGTestPredicates.equals(5))
    .start(5);

// Format and print
process.stdout.write(CTGTestConsoleFormatter.format(state) + "\n");

// Exit code from status
const S = CTGTestResult.STATUS;
process.exit(state.status === S.FAIL || state.status === S.ERROR ? 1 : 0);
```

### Custom Predicates

Build domain-specific predicates using `CTGTestPredicate.init`:

```javascript
import CTGTestPredicate from "ctg-js-test/predicate";

const isValidEmail = CTGTestPredicate.init(
    "valid email",
    (value) => typeof value === "string" && /^[^@]+@[^@]+\.[^@]+$/.test(value)
);

const state = await CTGTest.init("user validation")
    .assert("email format", (state) => state.subject.email, isValidEmail)
    .start({ email: "user@example.com" });
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `haltOnFailure` | boolean | `true` | Stop pipeline on first fail or error |
| `timeout` | number | `5000` | Per-operation timeout in ms (0 = disabled) |

```javascript
// Run all operations regardless of failures
const state = await test.start(subject, { haltOnFailure: false });

// Custom timeout
const state = await test.start(subject, { timeout: 10000 });
```

## Notice

`ctg-js-test` is under active development. The core pipeline API is stable but formatters and extension patterns may evolve.
