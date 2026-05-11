# Blanking and Clearing Reference

## Blanking

### Flood

**Great Flood** (`FR08` / `CH18`): blanks all Armies, all Lands except Mountain, all Flames except Lightning, and Phoenix (Promo).
- blanks Wildfire
- blanks Cavern, but Cavern first clears penalty on all Weather
- blanks Phoenix (Promo) via its `blanks()` function
- blanks Phoenix (`FR55`) via Phoenix's own `blankedIf` (see Beast section)

**Blizzard**: blanks all Floods.
- blanks Great Flood

### Weather

**Rainstorm**: blanks all Flames except Lightning, and Phoenix (Promo).
- blanks Wildfire

**Smoke**: blanked unless with at least one Flame.

### Flame

**Wildfire**: blanks all cards except Flames, Wizards, Weather, Weapons, Artifacts, Wild, Mountain, Great Flood, Island, Unicorn, Dragon, and Phoenix.
- blanks Basilisk
- blanks Cavern, but Cavern first clears penalty on all Weather
- blanks Rangers, but Rangers first clear the word Army from all penalties

### Beast

**Basilisk**: blanks all Armies, Leaders, and other Beasts.
- does not blank Rangers (Army, not Beast)
- blanks itself when copied by Doppelganger

**Phoenix** (`FR55`): blanked if any Flood card is in hand (`blankedIf`).
- this is on Phoenix itself, not on the Flood card
- Cavern protects Phoenix from this (Cavern explicitly clears Phoenix's penalty)
- Beastmaster does **not** protect Phoenix (see Clearing section)

**Phoenix (Promo)** (`FR55P`): same `blankedIf` as Phoenix, and actively blanked by Great Flood and Rainstorm via their `blanks()` functions.

### Weapon

**Warship**: clears the word Army from all penalties of all Floods. Blanked unless with at least one Flood.
- Warship itself is a Flood, so it always satisfies its own `blankedIf`
- open question: if the only Flood in hand is blanked (by Blizzard or Wildfire), does Warship become blanked too?

**War Dirigible**: blanked unless with at least one Army (or Army cleared). Blanked with any Weather card.
- open question: if the only Army is blanked (by Basilisk or Wildfire), does War Dirigible become blanked too?
- Phoenix (`FR55`) does not count as Weather for War Dirigible's `blankedIf` (`containsSuitExcluding` explicitly excludes `PHOENIX = 'FR55'`)
- Phoenix Promo (`FR55P`) is **not** excluded — it would trigger War Dirigible's `blankedIf` if present

---

## Clearing

### Land
**Mountain** (`FR01`): clears the penalty on all Floods.

**Cavern** (`FR02`): clears the penalty on all Weather and on Phoenix.
- because Cavern protects Phoenix, Phoenix is not blanked by Floods when Cavern is in hand (`penaltyCleared` prevents `blankedIf` from running)

### Flood
**Island** (`FR09`): clears the penalty on any one Flood or Flame (player's choice).

### Army
**Rangers** (`FR25` / `CH19`): clears the word Army from all penalties.

### Wizard
**Beastmaster** (`FR27`): clears the penalty on all Beasts, except Phoenix.
- Phoenix's flood-blanking vulnerability (`blankedIf`) must remain active; Beastmaster clearing it would wrongly protect Phoenix from Great Flood
- `isPhoenix(card)` is excluded from Beastmaster's `clearsPenalty` function

### Weapon
**Warship** (`FR41`): clears the word Army from all penalties of all Floods.

### Artifact
**Protection Rune** (`FR50`): clears the penalty on all cards.

---

## Scoring Order

Card actions run in `ACTION_ORDER` (defined in `deck.js`):

1. Doppelganger (`FR53`) — copies another card's identity
2. Mirage (`FR52` / `CH23`) — copies a card from the deck
3. Shapeshifter (`FR51` / `CH22`) — copies a card from the deck
4. Book of Changes (`FR49`) — changes a card's suit
5. Island (`FR09`) — clears penalty on one Flood or Flame
6. Angel (`CH08`) — protects one Magic card from blanking
7. Clear penalties (`clearsPenalty` functions run for all enabled cards)
8. Apply blanking:
   - a. Demon blanks first (before cycle detection)
   - b. `blanks()` cycle detection (mutual blanking = both blanked)
   - c. `blankedIf()` loop (repeats until stable), skipped if `penaltyCleared`
9. Score enabled, non-blanked cards

---

## Implementation Notes

### `penaltyCleared` flag
Set by `_clearPenalties()` when a card's suit matches another card's `clearsPenalty()` function. Has two effects:
1. Skips `penaltyScore()` for that card (no negative score contribution)
2. Skips `blankedIf()` for that card in `_applyBlanking()`

Effect 2 is intentional for Cavern + Phoenix (Cavern should protect Phoenix from Floods), but was a bug for Beastmaster + Phoenix (Beastmaster should not protect Phoenix from Floods). Fixed by excluding `isPhoenix()` from Beastmaster's `clearsPenalty`.

### Blanking cycle detection (`_cardBlanked`)
- If card A blanks card B **and** card B blanks card A, both are blanked.
- If there is a longer cycle (A→B→C→A), all cards in the cycle are blanked.
- If a blanker has `penaltyCleared = true`, it does not blank anything (e.g. Blizzard with Cavern in hand does not blank Great Flood).
