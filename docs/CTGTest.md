# CTGTest

Pipeline-based test engine. Sequences steps, evaluates outcomes, records results on state. Returns CTGTestState to the caller. Test instances are definitions — they hold no subject and carry no runtime state until `start()` is called.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _name | STRING | Name of this test pipeline (trimmed at construction) |
| _steps | [CTGTestStep] | Ordered list of step instances |

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| MAX_CHAIN_DEPTH | INT | Maximum chain nesting depth (64) |
| MAX_NESTING_DEPTH | INT | Maximum comparison recursion depth (128) |
| DEFAULT_CONFIG | OBJECT | Default configuration merged into every `start()` call |
| VALID_CONFIG_KEYS | [STRING] | Accepted config keys: `haltOnFailure`, `strict`, `timeout` |

---

### CTGTest.init :: STRING -> ctgTest

Creates a new test definition with the given name. Uses late-bound construction (`new this(...)`) so subclasses inherit correctly.

```javascript
const test = CTGTest.init("my test");
```

---

### ctgTest.stage :: STRING, (CTGTestState -> CTGTestState), FUNCTION? -> ctgTest

Adds a stage step. The callback receives state, transforms it, and must return state. Chainable.

```javascript
CTGTest.init("example")
    .stage("double", (state) => { state.subject = state.subject * 2; return state; });
```

---

### ctgTest.assert :: STRING, (CTGTestState -> *), *, FUNCTION? -> ctgTest

Adds an assert step. The callback computes an actual value from state. The pipeline compares it to the expected value. Chainable.

```javascript
CTGTest.init("example")
    .assert("check", (state) => state.subject, 42);
```

---

### ctgTest.assertAny :: STRING, (CTGTestState -> *), [*], FUNCTION? -> ctgTest

Adds an assertAny step. The callback computes an actual value. The pipeline compares it against the candidate list. Chainable.

```javascript
CTGTest.init("example")
    .assertAny("check", (state) => state.subject, [41, 42, 43]);
```

---

### ctgTest.chain :: STRING, CTGTest -> ctgTest

Composes another pipeline's steps inline, threading the subject through. Chainable.

```javascript
const inner = CTGTest.init("inner")
    .stage("add 1", (state) => { state.subject = state.subject + 1; return state; });

CTGTest.init("outer")
    .chain("use inner", inner);
```

---

### ctgTest.skip :: STRING, STRING, (CTGTestState -> BOOL)? -> ctgTest

Adds a skip step targeting another step by name. If the predicate returns true (or is null for unconditional), the target step is skipped. Must appear before the target in the pipeline. Chainable.

```javascript
CTGTest.init("example")
    .skip("skip if negative", "check", (state) => state.subject < 0)
    .assert("check", (state) => state.subject, 42);
```

---

### ctgTest.start :: *, OBJECT? -> PROMISE(CTGTestState)

Executes the pipeline. Validates config, steps, and skip targets synchronously, then runs steps async. Returns the final CTGTestState containing all results.

If the subject is not a CTGTestState instance, it is wrapped in one. The pipeline does not write to stdout, select formatters, or publish results — the caller owns delivery.

```javascript
const state = await CTGTest.init("my test")
    .assert("check", (state) => state.subject, 42)
    .start(42);

// Caller owns delivery
console.log(state.status); // "pass"
```

### Config

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `haltOnFailure` | BOOL | `true` | Stop pipeline at first fail or error |
| `strict` | BOOL | `true` | Use strict (===) comparison |
| `timeout` | INT | `5000` | Per-step timeout in ms (0 = disabled) |

---

### ctgTest.compare :: *, *, BOOL -> BOOL

Compares actual and expected values. Used by the pipeline after step execution to judge assert outcomes. Strict mode uses `isDeepStrictEqual`. Loose mode uses manual traversal with type coercion.

```javascript
test.compare({ a: 1 }, { a: 1 }, true);  // true (strict)
test.compare(5, "5", false);              // true (loose)
```
