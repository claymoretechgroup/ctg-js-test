# ctg-js-test

`ctg-js-test` is a composable, pipeline-based test framework for JavaScript (Node.js, ESM). Tests are defined as pipelines of stage and assert operations on a threaded subject. Stage transforms the subject. Assert inspects without mutating. Chain composes test instances together. All callables are `await`ed, so sync and async code works uniformly without separate APIs.

**Key Features:**

* **Pipeline model**: Tests are ordered sequences of stages and asserts on a threaded subject
* **Composable**: Chain separately defined test instances into larger pipelines
* **Async-native**: All callables are `await`ed — no separate async API needed
* **Five-status reporting**: pass, fail, error, recovered, skip — not just pass/fail
* **Per-step timeout**: Configurable timeout prevents hung async operations from blocking the pipeline
* **Zero dependencies**: Only Node.js built-ins (`node:util`, `node:fs`, `node:path`, `node:url`, `node:perf_hooks`)
* **Portable**: API designed to match `ctg-php-test` and port to additional languages

## Install

```
npm install claymoretechgroup/ctg-js-test
```

Minimum Node.js version: 14.x (ESM support, `util.isDeepStrictEqual`, `performance.now()`).

## Examples

### Basic Pipeline

Define a test pipeline and run it:

```javascript
import CTGTest from "ctg-js-test";

const test = CTGTest.init("arithmetic")
    .stage("setup", (n) => n + 1)
    .assert("incremented", (n) => n, 2);

await test.start(1);
```

### Multiple Stages

Stages thread the subject sequentially:

```javascript
const test = CTGTest.init("math")
    .stage("double", (n) => n * 2)
    .stage("add ten", (n) => n + 10)
    .assert("result", (n) => n, 20);

await test.start(5);
```

### Composing Pipelines

Define reusable test components and chain them together:

```javascript
const validatePositive = CTGTest.init("positive check")
    .assert("is positive", (n) => n > 0, true);

const test = CTGTest.init("math pipeline")
    .stage("double", (n) => n * 2)
    .chain("validate", validatePositive);

await test.start(5);
```

### Async Steps

Test async code naturally — HTTP calls, database queries, file I/O:

```javascript
const test = CTGTest.init("api test")
    .stage("fetch user", async (id) => {
        const res = await fetch(`https://api.example.com/users/${id}`);
        return res.json();
    })
    .assert("has name", (user) => typeof user.name, "string");

await test.start(42);
```

### Error Recovery

Stage and assert steps accept an optional error handler:

```javascript
const test = CTGTest.init("resilient")
    .stage("connect",
        async (config) => await connectDB(config),
        async (err) => await connectFallbackDB()
    )
    .assert("connected", (db) => db.isConnected, true);

await test.start({ host: "primary.db" });
```

### Conditional Skip

Skip steps unconditionally or based on a predicate:

```javascript
const test = CTGTest.init("conditional")
    .stage("setup", (x) => x)
    .stage("expensive", async (x) => await heavyComputation(x))
    .assert("result", (x) => x > 0, true)
    .skip("expensive", (x) => x < 10);

await test.start(5); // "expensive" is skipped because 5 < 10
```

### Strict and Loose Comparison

Strict mode (default) uses `util.isDeepStrictEqual`. Loose mode uses `==` semantics with deep object traversal:

```javascript
// Strict: 1 !== "1"
await CTGTest.init("strict")
    .assert("type matters", (x) => x, "1")
    .start(1); // fails

// Loose: 1 == "1"
await CTGTest.init("loose")
    .assert("type coerced", (x) => x, "1")
    .start(1, { strict: false }); // passes
```

### Output Modes

Control how results are delivered:

```javascript
// Console output (default) — human-readable to stdout
await test.start(subject);

// Return formatted string
const output = await test.start(subject, { output: "return" });

// Return raw report object
const report = await test.start(subject, { output: "return-json" });

// JSON to stdout
await test.start(subject, { output: "json" });

// JUnit XML to stdout (for CI)
await test.start(subject, { output: "junit" });
```

### Debug Mode

Capture subject snapshots before each step:

```javascript
const report = await CTGTest.init("debug example")
    .stage("double", (n) => n * 2)
    .assert("check", (n) => n, 10)
    .start(5, { output: "return-json", debug: true });

// report.steps[0].subject === 5  (before doubling)
// report.steps[1].subject === 10 (before asserting)
```

### Timeout

Per-step timeout prevents hung async operations. Default is 5000ms:

```javascript
// Custom timeout
await test.start(subject, { timeout: 10000 }); // 10 seconds

// Disable timeout
await test.start(subject, { timeout: 0 });
```

### CLI Runner

Run test files from the command line:

```
npx ctg-test
npx ctg-test tests/ApiTest.js tests/DbTest.js
npx ctg-test --format=junit --trace --timeout=10000
```

Test files are ESM modules that import `CTGTest` and execute on import. The runner discovers `*Test.js` files in the current directory or `tests/` subdirectory.

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `output` | string | `"console"` | Output mode: console, return, return-json, json, junit |
| `haltOnFailure` | boolean | `true` | Stop pipeline on first fail or error |
| `strict` | boolean | `true` | Use strict deep equality (vs loose `==`) |
| `trace` | boolean | `false` | Include stack traces in error results |
| `debug` | boolean | `false` | Capture subject snapshots before each step |
| `formatter` | class\|null | `null` | Custom formatter class with static `format(report, config)` |
| `timeout` | number | `5000` | Per-step timeout in ms (0 = disabled) |

## Notice

`ctg-js-test` is under active development. The core API is stable. Formatters and CLI tooling may change.
