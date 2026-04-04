# AssertStep

Extends CTGTestStep. Computes an actual value from state. The pipeline compares the actual value against the step's expected value and records pass, fail, or error.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _fn | FUNCTION | `(CTGTestState -> *)` — computes actual value |
| _expected | * | Value the pipeline compares actual against |

### CONSTRUCTOR :: STRING, FUNCTION, *, FUNCTION? -> assertStep

Creates an assert step with a name, compute function, expected value, and optional error handler. The expected value must not be a function.

---

### assertStep.expectedOutcome :: VOID -> OBJECT

Returns `{ type: "value", expected: * }`. The pipeline uses this to compare `state.actual` against the expected value after execution.

---

### assertStep.execute :: CTGTestState -> PROMISE(CTGTestState)

Calls the compute function with state and sets `state.actual` to the return value. Does not modify `state.subject`. If an error handler is provided and the function throws, the handler receives the error and its return value is set as `state.actual`.

```javascript
CTGTest.init("example")
    .assert("check", (state) => state.subject, 42)
    .start(42);
```
