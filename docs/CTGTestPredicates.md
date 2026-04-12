# CTGTestPredicates

Static convenience builders for `CTGTestPredicate` instances. Each method returns a ready-to-use predicate for an assert operation. This is the extension surface for new comparison modes — the pipeline never changes; new comparison behavior is a new predicate.

---

## Equality

### CTGTestPredicates.equals :: * -> ctgTestPredicate

Deep strict equality via `node:util` `isDeepStrictEqual`. Works on primitives, objects, arrays, Maps, Sets, and nested structures.

```javascript
.assert("check", (state) => state.subject, CTGTestPredicates.equals({ a: 1 }))
```

---

### CTGTestPredicates.notEquals :: * -> ctgTestPredicate

Deep strict inequality. Passes when the computed value is not deep-strict-equal to the expected value.

```javascript
.assert("changed", (state) => state.subject, CTGTestPredicates.notEquals(originalValue))
```

---

## Void Checks

### CTGTestPredicates.isVoid :: VOID -> ctgTestPredicate

Passes when the computed value is `null` or `undefined`.

```javascript
.assert("is empty", (state) => state.subject, CTGTestPredicates.isVoid())
```

---

### CTGTestPredicates.isNotVoid :: VOID -> ctgTestPredicate

Passes when the computed value is neither `null` nor `undefined`.

```javascript
.assert("exists", (state) => state.subject, CTGTestPredicates.isNotVoid())
```

---

## Truthiness

### CTGTestPredicates.isTruthy :: VOID -> ctgTestPredicate

Passes when the computed value is truthy.

```javascript
.assert("has value", (state) => state.subject, CTGTestPredicates.isTruthy())
```

---

### CTGTestPredicates.isFalsy :: VOID -> ctgTestPredicate

Passes when the computed value is falsy.

```javascript
.assert("is empty", (state) => state.subject, CTGTestPredicates.isFalsy())
```

---

### CTGTestPredicates.isTrue :: VOID -> ctgTestPredicate

Passes when the computed value is strictly `true`.

```javascript
.assert("flag on", (state) => state.subject, CTGTestPredicates.isTrue())
```

---

### CTGTestPredicates.isFalse :: VOID -> ctgTestPredicate

Passes when the computed value is strictly `false`.

```javascript
.assert("flag off", (state) => state.subject, CTGTestPredicates.isFalse())
```

---

## Type Checks

### CTGTestPredicates.isInstanceOf :: (* -> *) -> ctgTestPredicate

Passes when the computed value is an instance of the given constructor function.

```javascript
.assert("is error", (state) => state.subject, CTGTestPredicates.isInstanceOf(Error))
```

---

### CTGTestPredicates.isType :: STRING -> ctgTestPredicate

Passes when `typeof` the computed value matches the given type string.

```javascript
.assert("is string", (state) => state.subject, CTGTestPredicates.isType("string"))
```

---

## Ordering

### CTGTestPredicates.greaterThan :: * -> ctgTestPredicate

Passes when the computed value is greater than the expected value.

```javascript
.assert("above zero", (state) => state.subject, CTGTestPredicates.greaterThan(0))
```

---

### CTGTestPredicates.lessThan :: * -> ctgTestPredicate

Passes when the computed value is less than the expected value.

```javascript
.assert("under limit", (state) => state.subject, CTGTestPredicates.lessThan(100))
```

---

## String and Pattern Matching

### CTGTestPredicates.contains :: STRING -> ctgTestPredicate

Passes when the computed value is a string that includes the expected substring.

```javascript
.assert("has greeting", (state) => state.subject, CTGTestPredicates.contains("hello"))
```

---

### CTGTestPredicates.matchesPattern :: REGEXP -> ctgTestPredicate

Passes when the computed value matches the given regular expression. Resets `lastIndex` before each test to avoid stateful regex bugs with `g` or `y` flags.

```javascript
.assert("is email", (state) => state.subject, CTGTestPredicates.matchesPattern(/^.+@.+\..+$/))
```

---

## Collection

### CTGTestPredicates.hasLength :: INT -> ctgTestPredicate

Passes when the computed value has the expected length or size. Checks `.length` first (arrays, strings), then `.size` (Map, Set), then counts via iteration for custom iterables.

```javascript
.assert("has three items", (state) => state.subject, CTGTestPredicates.hasLength(3))
```

---

### CTGTestPredicates.anyOf :: [*] -> ctgTestPredicate

Passes when the computed value deep-strict-equals any value in the candidate array.

```javascript
.assert("valid status", (state) => state.subject, CTGTestPredicates.anyOf(["active", "pending"]))
```

---

## Custom

### CTGTestPredicates.satisfies :: (* -> BOOL) -> ctgTestPredicate

Custom predicate from a function. The function receives the computed value and returns true or false. The expected outcome is stored as `"*"` for diagnostics.

```javascript
.assert("is even", (state) => state.subject, CTGTestPredicates.satisfies((v) => v % 2 === 0))
```
