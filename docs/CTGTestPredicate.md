# CTGTestPredicate

Predicate type that carries an expected outcome and an evaluation function. Assert operations receive a predicate instance, and the pipeline calls `predicate.evaluate(computed)` after the assert handler deposits its value.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _expectedOutcome | * | The value the predicate checks against, stored for diagnostics |
| _evaluate | (* -> BOOL) | The evaluation function; receives computed value, returns true or false |

---

### CTGTestPredicate.init :: *, (* -> BOOL) -> ctgTestPredicate

Creates a new predicate with the given expected outcome and evaluation function. The expected outcome is used for reporting; the evaluation function determines pass or fail.

```javascript
const isFortyTwo = CTGTestPredicate.init(42, (value) => value === 42);
```

---

### ctgTestPredicate.expectedOutcome :: VOID -> *

Getter. Returns the expected outcome value. Used by the pipeline when building result diagnostics.

```javascript
const pred = CTGTestPredicate.init(42, (value) => value === 42);
pred.expectedOutcome; // 42
```

---

### ctgTestPredicate.evaluate :: VOID -> (* -> BOOL)

Getter. Returns the evaluation function. The pipeline calls this with the computed value from an assert handler to determine pass or fail.

```javascript
const pred = CTGTestPredicate.init(42, (value) => value === 42);
pred.evaluate(42); // true
pred.evaluate(99); // false
```
