# CTGTest

Sequential test pipeline engine. Test instances are definitions — they hold no subject and carry no runtime state until `start()` is called. All step callables are `await`ed, supporting both sync and async code uniformly.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _name | STRING | Name of this test pipeline (trimmed at construction) |
| _steps | [ctgTestStep] | Ordered list of step definitions |
| _skips | [OBJECT] | Skip directives: `{ name: STRING, predicate: ((*) -> BOOL)\|VOID }` |

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| MAX_CHAIN_DEPTH | INT | Maximum chain nesting depth (64) |
| MAX_NESTING_DEPTH | INT | Maximum comparison/snapshot recursion depth (128) |
| DEFAULT_CONFIG | OBJECT | Default configuration merged into every `start()` call |
| _results | [OBJECT] | Internal result collector populated by `start()` |
| _cliConfig | OBJECT\|VOID | CLI configuration set by the runner |

---

### CTGTest.init :: STRING -> ctgTest

Creates a new test definition with the given name. Uses late-bound construction (`new this(...)`) so subclasses inherit correctly.

```javascript
const test = CTGTest.init("my test");
```

---

### CONSTRUCTOR :: STRING -> ctgTest

Stores the trimmed name and initializes empty steps and skips arrays. Use `CTGTest.init()` instead of calling the constructor directly.

---

### ctgTest.stage :: STRING, (* -> *|PROMISE(*)), ((Error) -> *|PROMISE(*))? -> this

Adds a stage step to the pipeline. At execution time, the callable receives the current subject and returns a transformed subject that becomes the new subject for subsequent steps. If an error handler is provided, it receives the exception when the callable throws and its return value replaces the subject (status: recovered). Chainable.

```javascript
CTGTest.init("transform")
    .stage("double", (n) => n * 2)
    .stage("add one", (n) => n + 1);
```

---

### ctgTest.assert :: STRING, (* -> *|PROMISE(*)), *, ((Error) -> *|PROMISE(*))? -> this

Adds an assert step. The callable receives the subject and returns a value compared against `expected`. The subject is not mutated. If comparison fails, status is `fail`. If the callable throws and an error handler recovers a value matching expected, status is `recovered`; if the recovered value doesn't match, status is `fail`. Chainable.

```javascript
CTGTest.init("check")
    .assert("is ten", (n) => n, 10);
```

---

### ctgTest.assertAny :: STRING, (* -> *|PROMISE(*)), [*], ((Error) -> *|PROMISE(*))? -> this

Adds an assert-any step. The callable's return value is compared against each candidate in the array. If any candidate matches, status is `pass`. Empty candidate arrays always fail. Chainable.

```javascript
CTGTest.init("check set")
    .assertAny("in range", (n) => n, [1, 2, 3, 4, 5]);
```

---

### ctgTest.chain :: STRING, ctgTest -> this

Composes another test's steps inline. The chained test's steps execute with the current subject, and mutations carry forward to subsequent steps in the parent pipeline. The chain's name comes from this call, not from the chained test's `init()` name. Chainable.

```javascript
const validator = CTGTest.init("validate")
    .assert("positive", (n) => n > 0, true);

CTGTest.init("pipeline")
    .stage("compute", (n) => n * 2)
    .chain("verify", validator);
```

---

### ctgTest.skip :: STRING, ((* -> BOOL|PROMISE(BOOL)))? -> this

Marks a step for skipping. Without a predicate, the step is always skipped. With a predicate, the step is skipped when the predicate returns `true` (receives the current subject). If the predicate throws, the step produces an error result. Chainable.

```javascript
CTGTest.init("conditional")
    .stage("expensive", async (x) => await heavyWork(x))
    .skip("expensive", (x) => x < threshold);
```

---

### ctgTest.start :: *, OBJECT? -> PROMISE(STRING|OBJECT|VOID)

Executes the pipeline. Validates config, steps, and skips synchronously, then runs steps async. Returns a value based on output mode: formatted string (`return`), raw report object (`return-json`), or `undefined` (console/json/junit print to stdout). Populates `CTGTest._results` with `{ name, status }` for runner integration.

```javascript
const report = await test.start(subject, {
    output: "return-json",
    strict: true,
    timeout: 5000
});
```

---

### ctgTest.compare :: *, *, BOOL -> BOOL

Default comparison method. Strict mode delegates to `util.isDeepStrictEqual`. Loose mode uses manual deep equality with `==` semantics, category gating, and pair-path cycle detection. Functions, Map, and Set are uncomparable (throw `INVALID_STEP`). Subclasses may override for custom matching.

```javascript
// Called internally during assert/assertAny execution
// Subclass override example:
class FuzzyTest extends CTGTest {
    compare(actual, expected, strict) {
        if (typeof actual === "number" && typeof expected === "number") {
            return Math.abs(actual - expected) < 0.001;
        }
        return super.compare(actual, expected, strict);
    }
}
```

---

### CTGTest.setCliConfig :: OBJECT -> VOID

Stores CLI configuration for retrieval by test files via `getCliConfig()`. Called by the CLI runner after parsing flags.

---

### CTGTest.getCliConfig :: VOID -> OBJECT

Returns the CLI config set by the runner. Returns `{}` if none was set. Test files spread this into their `start()` config to inherit CLI flags.

```javascript
const config = { ...CTGTest.getCliConfig(), output: "return-json" };
await test.start(subject, config);
```
