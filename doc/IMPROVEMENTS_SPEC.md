# Improvement Specs

Spec-driven backlog for test coverage and tooling improvements. Each item describes what to implement — turn it into a test block in `run-tests.js` when ready.

---

## 1. Tooling

### 1.1 `npm test` script
Add a `"test"` script to `package.json` so the suite runs with a standard command.

```json
"scripts": {
  "test": "node run-tests.js"
}
```

**Done when:** `npm test` exits 0 on a clean run.

---

### 1.2 Coverage with `c8`
Add `c8` as a dev dependency so coverage can be checked with zero config.

```bash
npx c8 node run-tests.js
```

`c8` uses Node's built-in V8 coverage — no instrumentation needed.

**Done when:** running the command above prints a coverage table for `hand.js` and `deck.js`. Aim for >80% line coverage on `hand.js` as a starting baseline.

**Known limitation:** `c8` is installed and works, but coverage only reports on `run-tests.js` (the harness), not `hand.js`/`deck.js`. The game files are loaded via `vm.runInThisContext`, which V8 coverage cannot instrument. Fixing this requires adding `module.exports` to the game files and switching to `require` in `run-tests.js` — but bare `module.exports` throws `ReferenceError` in the browser, so the guard `if (typeof module !== 'undefined') module.exports = ...` is needed. This is a production file change for a test tooling benefit, so it was left as a deferred decision.

---

## 2. URL Round-trip (`toString` / `loadFromString`)

These tests belong in a `testUrlRoundTrip` IIFE, placed before `deck.enableCursedHoardSuits()`.

### 2.1 Preserves enabled/disabled state
```
Setup:   add FR16, FR13, FR19 (enabled); bench FR01 (disabled)
Action:  str = hand.toString(); hand.clear(); hand.loadFromString(str)
Expect:  FR16/FR13/FR19 are enabled; FR01 is disabled
```

### 2.2 Preserves action data (Book of Changes)
```
Setup:   load 'FR49,FR16+FR49:FR16:flame'  (Book changes Wildfire to Flame)
Action:  str = hand.toString(); hand.clear(); hand.loadFromString(str)
Expect:  score equals the original score
         FR49.actionData === ['FR16', 'flame']
```

### 2.3 All cards benched → score is 0
```
Setup:   hand.loadFromString('!FR16,!FR13,!FR19')
Expect:  hand.score() === 0
         hand.enabledSize() === 0
         hand.totalSize() === 3
```

### 2.4 Necromancer enabled survives round-trip
```
Setup:   load 'FR28,FR16,FR13,FR19,FR01,FR02,FR04,FR17'  (8 cards, Necromancer in hand)
Action:  str = hand.toString(); hand.clear(); hand.loadFromString(str)
Expect:  hand.limit() === 8
         hand.enabledSize() === 8
```

---

## 3. `scoreWithCardEnabled` — extraCard edge cases

These tests belong in the existing `testBenchScoring` IIFE or a dedicated one. Must run **before** `deck.enableCursedHoardSuits()` since they use FR28.

### 3.1 Necromancer bench potential includes its own strength
```
Setup:   6 enabled cards (e.g. FR16, FR13, FR19, FR17, FR01, FR02); Necromancer (FR28) benched
Action:  potential = hand.scoreWithCardEnabled('FR28')
Expect:  potential > hand.score()           (adds Necromancer's strength at minimum)
         potential - hand.score() >= 3      (Necromancer base strength is 3)
```

### 3.2 Limit check uses 7 (not 8) when evaluating a non-extraCard benched card alongside a benched Necromancer
```
Setup:   7 enabled cards; Necromancer (FR28) benched; FR05 benched
Action:  potential = hand.scoreWithCardEnabled('FR05')
         — scoreWithCardEnabled should temporarily enable FR05 for scoring
Expect:  score is calculated with FR05 active (the call should not be blocked)
         BUT hand.limit() after the call is still 7 (Necromancer still benched)
         AND hand.enabledSize() after the call is still 7 (no mutation)
```

### 3.3 No state mutation after call
```
Setup:   4 enabled cards; FR01 benched with actionData
Action:  hand.scoreWithCardEnabled('FR01')
Expect:  every card's .enabled state is identical before and after the call
         FR01.enabled === false  after the call
```

---

## 4. `toggleCard` — other `extraCard` cards (Cursed Hoard)

These tests require `deck.enableCursedHoardSuits()` and `cursedHoardSuits = true`. Place them in a `testExtraCardLimit` IIFE after those calls.

Genie = CH06, Leprechaun = CH09, Portal = CH46 (cursed item).

### 4.1 Genie (CH06) enabled expands limit; benched does not
```
Test A — enabled:
  Setup:   hand with only CH06 (enabled)
  Expect:  hand.limit() === 8

Test B — benched:
  Setup:   hand.cardsInHand['CH06'] = new CardInHand(..., false)
  Expect:  hand.limit() === 8  (cursedHoardSuits adds 1, CH06 benched adds 0)
           i.e. limit() === _defaultLimit() === 9 is WRONG; should be 8
```

> Note: when `cursedHoardSuits = true`, `_defaultLimit()` returns 8. So with Genie enabled the limit is 9, and with Genie benched it should be 8. Adjust expected values accordingly.

### 4.2 Leprechaun (CH09) — same pattern as 4.1

### 4.3 Portal (CH46, cursed item) enabled expands limit; benched does not
```
Test A — enabled:
  Setup:   hand.cursedItems['CH46'] = new CardInHand(deck.getCardById('CH46'), undefined, true)
  Expect:  hand.limit() === _defaultLimit() + 1

Test B — benched:
  Setup:   hand.cursedItems['CH46'] = new CardInHand(deck.getCardById('CH46'), undefined, false)
  Expect:  hand.limit() === _defaultLimit()
```

### 4.4 Two extraCard cards benched — limit stays at base
```
Setup:   CH06 benched + CH09 benched; no enabled cards
Expect:  hand.limit() === _defaultLimit()   (not base+2 or base+1)
```

### 4.5 One extraCard enabled + one benched — limit is base+1, not base+2
```
Setup:   CH06 enabled + CH09 benched
Expect:  hand.limit() === _defaultLimit() + 1
```

### 4.6 toggleCard blocks non-extraCard card when at limit with Genie benched
```
Setup:   _defaultLimit() enabled cards (no extraCard); CH06 benched; FR16 benched
Action:  result = hand.toggleCard('FR16')
Expect:  result === false   (Genie on bench must not inflate limit)
```

### 4.7 toggleCard allows enabling Genie itself when at limit
```
Setup:   _defaultLimit() enabled cards (no extraCard); CH06 benched
Action:  result = hand.toggleCard('CH06')
Expect:  result === true
         hand.enabledSize() === _defaultLimit() + 1
         hand.limit() === _defaultLimit() + 1
```
