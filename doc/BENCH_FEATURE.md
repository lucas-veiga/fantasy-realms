# Bench Feature

## Overview

The bench feature lets players hold more than 7 cards at once and compare combinations without manually swapping. Cards beyond the active-hand limit sit in a **Bench** section below the active hand, each showing how many points they would add if swapped in.

This feature is implemented in both this fork and the upstream repository. See [Fork-Specific Changes](#fork-specific-changes) for what this fork adds on top.

---

## User Guide

### Adding cards to the bench

Cards are added to the bench automatically when the hand is at its limit (7, or 8 with Necromancer / Cursed Hoard). The header shows `7/7 (10 total)` to indicate enabled vs. total cards.

### Bench card interactions

| Action | Result |
|---|---|
| **Click anywhere on a bench card** | Removes the card entirely (plays swoosh sound) |
| **Click the checkbox on a bench card** | Enables the card — moves it to the active hand |
| **Click the checkbox on an active card** | Disables the card — moves it to the bench |
| **Click ▼/▶ button** | Collapses or expands card details |

> Note: enabling a bench card only works if the active hand is not at its limit. When at limit, the checkbox is disabled and the card shows `(at limit)`.

### Potential score preview

Each bench card shows the net score change if it were added to the active hand:
- `+25` green — adding it would gain 25 points
- `-5` red — adding it would lose 5 points
- `+0` grey — no net effect
- `(at limit)` amber — cannot enable until an active card is benched

The preview is not shown when the hand is at its limit (adding would require removing something first, making the delta meaningless without knowing what to remove).

### URL persistence

The enabled/disabled state is encoded in the shareable URL. Disabled cards get a `!` prefix:

```
?hand=FR01,FR02,!FR03,!FR04+actions
```

Old URLs without `!` prefixes continue to work — all cards default to enabled.

---

## Technical Implementation

### `hand.js`

#### `CardInHand` — `enabled` property

```javascript
constructor(card, actionData, enabled) {
  // ...
  this.enabled = enabled !== undefined ? enabled : true;
}
```

#### `addCard()` — auto-bench when at limit

New cards are enabled if the hand is under the limit, disabled (benched) otherwise:

```javascript
addCard(card) {
  if (this._canAdd(card)) {
    var enabled = this.enabledSize() < this.limit();
    if (card.cursedItem) {
      this.cursedItems[card.id] = new CardInHand(card, undefined, enabled);
    } else {
      this.cardsInHand[card.id] = new CardInHand(card, undefined, enabled);
    }
    return true;
  }
  return false;
}
```

`_canAdd()` allows up to 20 total cards (enabled + benched), not just 7.

#### `scoreWithCardEnabled()` — potential score without state mutation

```javascript
scoreWithCardEnabled(cardId, discard) {
  var card = this.getCardById(cardId);
  if (!card) return this.score(discard);

  var originalEnabled = card.enabled;

  // Temporarily enable the card
  card.enabled = true;

  // score() calls _resetHand() internally, which recreates CardInHand objects
  var potentialScore = this.score(discard);

  // Re-fetch by ID since _resetHand() replaced the original object reference
  var freshCard = this.getCardById(cardId);
  if (freshCard) {
    freshCard.enabled = originalEnabled;
  }

  return potentialScore;
}
```

The key subtlety: `score()` calls `_resetHand()` which creates new `CardInHand` objects, invalidating any saved reference. The restored state is applied to the **new** object, not the original.

#### `_resetHand()` — preserves `enabled` state

```javascript
_resetHand() {
  for (const card of this.cards()) {
    var enabled = card.enabled;
    this.cardsInHand[card.id] = new CardInHand(card.card, card.actionData, enabled);
  }
  for (const cursedItem of this.faceDownCursedItems()) {
    var enabled = cursedItem.enabled;
    this.cursedItems[cursedItem.id] = new CardInHand(cursedItem.card, cursedItem.actionData, enabled);
  }
}
```

Without this, every `score()` call would reset all cards to `enabled: true`.

#### Scoring only counts enabled cards

`nonBlankedCards()` filters by both `enabled` and `!blanked`:

```javascript
nonBlankedCards() {
  return this.cards().filter(function (card) {
    return card.enabled && !card.blanked;
  });
}
```

Blanking, penalty clearing, and all scoring logic operate only over this filtered set. Benched cards are invisible to all game mechanics.

#### `toggleCard()` — respects the limit

```javascript
toggleCard(id) {
  var card = this.cardsInHand[id] || this.cursedItems[id];
  if (card) {
    if (!card.enabled && this.enabledSize() >= this.limit()) {
      return false; // at limit, can't enable
    }
    card.enabled = !card.enabled;
    return true;
  }
  return false;
}
```

#### URL encoding

`toString()` prepends `!` for disabled cards:

```javascript
toString() {
  var cardStrings = [];
  for (const card of this.cards()) {
    var prefix = card.enabled ? '' : '!';
    cardStrings.push(prefix + card.id);
  }
  // ...
}
```

`loadFromString()` strips the `!` prefix and sets `enabled: false`:

```javascript
var enabled = true;
if (cardId.startsWith('!')) {
  enabled = false;
  cardId = cardId.substring(1);
}
```

---

### `app.js`

#### `updateHandView()` — separates active and bench cards

Cards are split **after** calling `hand.score()` (which rebuilds objects via `_resetHand()`):

```javascript
var score = hand.score(discard);

// Get fresh references AFTER scoring
var allCards = hand.faceDownCursedItems().concat(hand.cards());
var enabledCards  = allCards.filter(function(card) { return  card.enabled; });
var disabledCards = allCards.filter(function(card) { return !card.enabled; });
```

Potential scores are computed only when the hand is not at its limit:

```javascript
var atLimit = hand.enabledSize() >= hand.limit();
for (var i = 0; i < disabledCards.length; i++) {
  var card = disabledCards[i];
  if (atLimit) {
    card.potentialScore = null;
    card.canEnable = false;
  } else {
    card.potentialScore = hand.scoreWithCardEnabled(card.id, discard) - score;
    card.canEnable = true;
  }
}
```

#### Event handlers

```javascript
function toggleCardEnabled(id) {   // checkbox click
  hand.toggleCard(id);
  updateHandView();
}

function removeFromBench(id) {     // bench card body click
  swoosh.play();
  hand.deleteCardById(id);
  updateHandView();
}

function toggleCardCollapse(id) {  // ▼/▶ button click
  collapsedCards[id] = !collapsedCards[id];
  updateHandView();
}
```

`collapsedCards` is a plain object `{}` holding UI-only state; it is not persisted in the URL.

---

### `index.html` — Handlebars template

The hand template renders two sections. Key differences between active and bench cards:

| | Active card | Bench card |
|---|---|---|
| Card `onclick` | `selectFromHand(id)` | `removeFromBench(id)` |
| Checkbox | Always checked | Unchecked; disabled at limit |
| Score display | `{{points}}` (actual points) | `+N` / `-N` / `+0` / `(at limit)` |
| Action buttons | Shown | Hidden |
| Penalty cleared styling | Shown | Hidden |

The bench section header is rendered via i18n: `{{{i18n 'label.bench'}}}`.

---

## Fork-Specific Changes

The fork adds the following on top of the upstream implementation:

### Internationalization for bench labels

The upstream hardcoded the "Active Hand" and "Bench" section headers in English. This fork moves them to the i18n system, with translations in all 11 supported languages:

| Key | English value |
|---|---|
| `label.active-hand` | `Active Hand` |
| `label.bench` | `Bench (click header to remove, checkbox to add to hand)` |

Languages covered: Czech, German, English, Spanish, French, Korean, Polish, Portuguese, Russian, Ukrainian, Chinese (Simplified).

In `index.html`, the hardcoded strings were replaced with:
```handlebars
{{{i18n 'label.active-hand'}}}
{{{i18n 'label.bench'}}}
```

### Service worker registration path fix

Changed from an absolute path to a relative path so the app works when hosted at a non-root URL:

```javascript
// Before (upstream)
navigator.serviceWorker.register('/service-worker.js');

// After (fork)
navigator.serviceWorker.register('./service-worker.js');
```

---

## Bug Fixes

### Beastmaster should not protect Phoenix from flood blanking

**File:** `js/deck.js`

Beastmaster's `clearsPenalty` function targeted all beasts, which included Phoenix. This set `penaltyCleared = true` on Phoenix, causing `_applyBlanking` to skip Phoenix's `blankedIf` check — so Great Flood would not blank Phoenix when Beastmaster was in the same hand.

```javascript
// Before
clearsPenalty: function (card) {
  return card.suit === 'beast';
}

// After
clearsPenalty: function (card) {
  return card.suit === 'beast' && !isPhoenix(card);
}
```

Cavern still correctly protects Phoenix from floods because it explicitly includes `isPhoenix(card)` in its own `clearsPenalty`. Only Beastmaster was wrong.

### `testBenchScoring` used nonexistent card IDs

**File:** `js/tests.js`

The test referenced `CH40` (Fishhook, a cursed item not available in this mode), `FR04B` (does not exist), and `FR09` (Island, not Mountain). It crashed before reaching any assertion.

Fixed by using a valid hand: Wildfire (`FR16`) + Smoke (`FR13`) + Lightning (`FR19`) + Candle (`FR17`), with Mountain (`FR01`) as the disabled bench card. The expected score difference is 59 — Mountain's base strength (9) plus its Smoke+Wildfire bonus (50).

---

## Performance

Each bench card requires one `scoreWithCardEnabled()` call per render, which runs the full scoring pipeline internally. With N benched cards, `updateHandView()` runs N+1 full scoring calculations.

In practice this is fine: scoring is fast (< 5 ms), the typical bench has 0–3 cards, and calculations only happen on user interaction. The 20-card total cap bounds the worst case.
