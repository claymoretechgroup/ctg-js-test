# CTGTestStep

Abstract base class for pipeline steps. Steps compute values against state. The pipeline owns judgment (comparison, pass/fail) and result construction. Concrete step types implement `execute(state)` and `validate()`.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _type | STRING | Step type identifier |
| _name | STRING | Step name |
| _errorHandler | FUNCTION\|NULL | Optional error recovery handler |

### CONSTRUCTOR :: STRING, STRING, OBJECT? -> ctgTestStep

Creates a step with a type, name, and optional configuration. The `errorHandler` option is read from opts if provided.

```javascript
const step = new CTGTestStep("stage", "my step", { errorHandler: (err) => err.message });
```

---

### ctgTestStep.type :: VOID -> STRING

Getter. Returns the step type identifier.

---

### ctgTestStep.name :: VOID -> STRING

Getter. Returns the step name.

---

### ctgTestStep.errorHandler :: VOID -> FUNCTION|NULL

Getter. Returns the error handler set at construction, or null.

---

### ctgTestStep.producesResult :: VOID -> BOOL

Getter. Whether this step produces a result entry in the pipeline. Default `true`. SkipStep returns `false` — it modifies state without producing a result.

---

### ctgTestStep.expectedOutcome :: VOID -> OBJECT|NULL

Getter. Declares what the step expects for correctness evaluation. The pipeline reads this after `execute` to judge the outcome. Returns `null` if the step does not require comparison. Default `null`.

| Outcome Type | Shape |
|-------------|-------|
| `"value"` | `{ type: "value", expected: * }` |
| `"candidates"` | `{ type: "candidates", candidates: [*] }` |
| `null` | No comparison needed |

---

### ctgTestStep.execute :: CTGTestState -> PROMISE(CTGTestState)

Abstract. Computes a value against the state and returns the state. Does not evaluate correctness — that is the pipeline's concern. Must be implemented by subclasses.

```javascript
async execute(state) {
    // compute, set state.actual or state.subject
    return state;
}
```

---

### ctgTestStep.validate :: VOID -> VOID

Abstract. Validates the step definition. Throws `CTGTestError` on failure. Must be implemented by subclasses.

```javascript
validate() {
    if (typeof this._fn !== "function") {
        throw new CTGTestError("INVALID_STEP", "fn must be a function");
    }
}
```
