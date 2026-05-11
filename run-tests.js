// Node.js test runner for Fantasy Realms browser tests
const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, 'js');

// Mock jQuery (only $ and jQuery.i18n are used)
global.jQuery = {
  i18n: {
    prop: (key) => key
  }
};
global.$ = function (selector) {
  return {
    append: (html) => {
      const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (html.includes('list-group-item-success')) {
        console.log('\x1b[32m' + text + '\x1b[0m');
        passed++;
      } else if (html.includes('list-group-item-danger')) {
        console.log('\x1b[31m' + text + '\x1b[0m');
        failed++;
      }
    }
  };
};

// Stats
let passed = 0;
let failed = 0;

// These globals are set in tests.js before $ is available
global.cursedHoardItems = false;
global.cursedHoardSuits = false;

const vm = require('vm');

// Load scripts into the global V8 context so var declarations are global
function load(file) {
  const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
  vm.runInThisContext(code, { filename: file });
}

load('deck.js');
load('discard.js');
load('hand.js');

// Run tests inline (instead of loading tests.js which needs $(document).ready)
cursedHoardItems = false;
cursedHoardSuits = false;

function assertScoreByName(cardNames, expectedScore, message) {
  hand.clear();
  for (const cardName of cardNames) {
    hand.addCard(deck.getCardByName(cardName));
  }
  assertScore(hand, expectedScore, message);
}

function assertScoreByCode(code, expectedScore, message) {
  hand.clear();
  hand.loadFromString(code);
  assertScore(hand, expectedScore, message);
}

function assertScore(hand, expectedScore, message) {
  var score = hand.score();
  var label = (message ? message + ': ' : '') + hand.cardNames().join(', ');
  if (score === expectedScore) {
    passed++;
    console.log('\x1b[32mPASS\x1b[0m ' + label + ' = ' + score);
  } else {
    failed++;
    console.log('\x1b[31mFAIL\x1b[0m ' + label + ' scored ' + score + ' (expected ' + expectedScore + ')');
  }
}

assertScoreByName(['Blizzard', 'Great Flood', 'Elven Archers'], 35);
assertScoreByName(['Smoke', 'Dwarvish Infantry', 'War Dirigible'], 50);
assertScoreByName(['Candle', 'Smoke', 'Dwarvish Infantry', 'War Dirigible'], 44);
assertScoreByCode('FR21,FR24,FR25,FR31,FR32,FR43,FR46+', 265);
assertScoreByCode('FR06,FR07,FR08,FR09,FR10,FR11,FR26+', 326);
assertScoreByCode('FR18,FR22,FR31,FR32,FR43,FR46,FR47+', 351, 'Max score without special cards?');
assertScoreByCode('FR01,FR08,FR13,FR14,FR15,FR16,FR52+FR52:FR11', 260, 'Rulebook example I');
assertScoreByCode('FR03,FR17,FR32,FR43,FR46,FR47,FR49+FR49:FR47:Wizard', 380, 'Rulebook example II');
assertScoreByCode('FR03,FR17,FR28,FR38,FR43,FR46,FR47,FR49+FR49:FR03:Leader', 397, 'Best hand ever?');
assertScoreByCode('FR02,FR03,FR05,FR17,FR26,FR28,FR47,FR49+FR49:FR17:Land', 388, 'Second best');
assertScoreByCode('FR03,FR17,FR28,FR32,FR43,FR46,FR47,FR49+FR49:FR03:Army', 388, 'Second best');
assertScoreByCode('FR28,FR29,FR31,FR32,FR34,FR35,FR51,FR53+FR51:FR31,FR53:FR29', -74, 'Worst hand ever?');
assertScoreByCode('FR37,FR53+FR53:FR37', 0, '2 Basilisks should blank eachother');
assertScoreByCode('FR24,FR53+FR53:FR24', 26, '2 Dwarvish Infantries should penalty eachother');
assertScoreByCode('FR09,FR12,FR16,FR37+FR09:FR16', 95, 'Island can be used even when blanked');
assertScoreByCode('FR10,FR53+FR53:FR10', 23, 'Elementals count their Doppelgänger');
assertScoreByCode('FR26,FR27,FR30,FR36,FR38,FR39,FR40+', 193, 'Collector can score multiple sets');
assertScoreByCode('FR26,FR46,FR47,FR51,FR53+FR51:FR46,FR53:FR46', 20, 'Collector does not score duplicated cards');
assertScoreByCode('FR22,FR31,FR36,FR43,FR44,FR46,FR47+', 206, 'Gem of Order can score multiple sets');
assertScoreByCode('FR46,FR47,FR02,FR05,FR25,FR32+', 105, 'Gem of Order can score multiple identical sets');
assertScoreByCode('FR16,FR49,FR11,FR12+FR49:FR12:flood', 11, 'Blanking I');
assertScoreByCode('FR12,FR08,FR16,FR49+FR49:FR12:beast', 3, 'Blanking II');
assertScoreByCode('FR49,FR41,FR37,FR21+FR49:FR37:flood', 73, 'Blanking III');
assertScoreByCode('FR49,FR41,FR24,FR22+FR49:FR24:flood', 56, 'Blanking IV');
assertScoreByCode('FR49,FR41,FR06,FR08,FR22+FR49:FR08:wizard', 82, 'Blanking V');
assertScoreByCode('FR08,FR12,FR16+', 65, 'Blanking cycle (base case) - Rulebook Q&A');
assertScoreByCode('FR02,FR08,FR12,FR16+', 62, 'Blanking cycle (with cavern) - Rulebook Q&A');
assertScoreByCode('FR08,FR12,FR16,FR49+FR49:FR12:beast', 3, 'Blanking cycle (with book changing Blizzard to beast)');
assertScoreByCode('FR02,FR08,FR12,FR16,FR49+FR49:FR12:beast', 9, 'Blanking cycle (with cavern and book)');
assertScoreByCode('FR49,FR41,FR45,FR23,FR15+FR49:FR45:flood', 24, 'War Dirigible and Warship are blanked');
assertScoreByCode('FR49,FR41,FR45+FR49:FR45:flood', 61, 'War Dirigible does not need Army when Army cleared from penalty');
assertScoreByCode('FR49,FR45,FR25+FR49:FR25:land', 53, 'War Dirigible does not need Army when Army cleared from penalty');
assertScoreByCode('FR21,FR45,FR13+', 47, 'War Dirigible + Smoke');
assertScoreByCode('FR21,FR13,FR45+', 47, 'Smoke + War Dirigible');

// Necromancer hand-limit tests (must run before enableCursedHoardSuits, which deletes FR28)
(function testNecromancerLimit() {
  function assert(condition, passMsg, failMsg) {
    if (condition) { passed++; console.log('\x1b[32mPASS\x1b[0m ' + passMsg); }
    else           { failed++; console.log('\x1b[31mFAIL\x1b[0m ' + failMsg); }
  }

  // Test 1: limit() returns 8 when Necromancer is enabled
  hand.clear();
  hand.addCard(deck.getCardById('FR28'));
  assert(hand.limit() === 8,
    'limit() returns 8 with Necromancer enabled',
    'limit() should return 8 with Necromancer enabled, got ' + hand.limit());

  // Test 2: limit() returns 7 when Necromancer is benched (disabled)
  hand.clear();
  hand.cardsInHand['FR28'] = new CardInHand(deck.getCardById('FR28'), undefined, false);
  assert(hand.limit() === 7,
    'limit() returns 7 with Necromancer benched',
    'limit() should return 7 with Necromancer benched, got ' + hand.limit());

  // Setup: 7 enabled cards + Necromancer benched + one more non-Necromancer card benched
  hand.clear();
  ['FR16','FR13','FR19','FR17','FR01','FR02','FR04'].forEach(function(id) {
    hand.addCard(deck.getCardById(id));
  });
  hand.cardsInHand['FR28'] = new CardInHand(deck.getCardById('FR28'), undefined, false);
  hand.cardsInHand['FR05'] = new CardInHand(deck.getCardById('FR05'), undefined, false);

  // Test 3: toggleCard blocks enabling a non-Necromancer card when at 7/7 + Necromancer benched
  var resultBlocked = hand.toggleCard('FR05');
  if (resultBlocked !== false) hand.cardsInHand['FR05'].enabled = false; // undo side-effect
  assert(resultBlocked === false,
    'toggleCard blocks non-Necromancer when 7/7 active + Necromancer benched',
    'toggleCard should return false for non-Necromancer when 7/7 active + Necromancer benched');

  // Test 4: toggleCard allows enabling Necromancer itself when 7 other cards are already active
  var resultAllowed = hand.toggleCard('FR28');
  assert(resultAllowed === true && hand.enabledSize() === 8 && hand.limit() === 8,
    'toggleCard allows enabling Necromancer from bench with 7/7 active (size=' + hand.enabledSize() + ', limit=' + hand.limit() + ')',
    'toggleCard should allow enabling Necromancer from bench with 7/7 active (result=' + resultAllowed + ', size=' + hand.enabledSize() + ', limit=' + hand.limit() + ')');
})();

(function testUrlRoundTrip() {
  function assert(condition, passMsg, failMsg) {
    if (condition) { passed++; console.log('\x1b[32mPASS\x1b[0m ' + passMsg); }
    else           { failed++; console.log('\x1b[31mFAIL\x1b[0m ' + failMsg); }
  }

  // 2.1 Preserves enabled/disabled state
  hand.clear();
  hand.addCard(deck.getCardById('FR16'));
  hand.addCard(deck.getCardById('FR13'));
  hand.addCard(deck.getCardById('FR19'));
  hand.cardsInHand['FR01'] = new CardInHand(deck.getCardById('FR01'), undefined, false);
  var str = hand.toString();
  hand.clear();
  hand.loadFromString(str);
  var s16 = hand.cardsInHand['FR16'], s13 = hand.cardsInHand['FR13'], s19 = hand.cardsInHand['FR19'], s01 = hand.cardsInHand['FR01'];
  assert(
    s16.enabled && s13.enabled && s19.enabled && !s01.enabled,
    'URL round-trip preserves enabled/disabled state',
    'URL round-trip failed: FR16=' + s16.enabled + ' FR13=' + s13.enabled + ' FR19=' + s19.enabled + ' FR01=' + s01.enabled + ' (expected T T T F)'
  );

  // 2.2 Preserves Book of Changes action data
  hand.clear();
  hand.loadFromString('FR49,FR16+FR49:FR16:flame');
  var scoreA = hand.score();
  var str2 = hand.toString();
  hand.clear();
  hand.loadFromString(str2);
  // Capture actionData before score() runs, as it may null it out for missing targets
  var ad = hand.cardsInHand['FR49'].actionData;
  var scoreB = hand.score();
  assert(
    scoreA === scoreB && ad !== undefined && ad.length === 2 && ad[0] === 'FR16' && ad[1] === 'flame',
    'URL round-trip preserves Book of Changes action data',
    'URL round-trip failed to preserve Book of Changes action data (scoreA=' + scoreA + ', scoreB=' + scoreB + ', actionData=' + JSON.stringify(ad) + ')'
  );

  // 2.3 All cards benched → score is 0
  hand.clear();
  hand.loadFromString('!FR16,!FR13,!FR19+');
  assert(
    hand.score() === 0 && hand.enabledSize() === 0 && hand.totalSize() === 3,
    'All cards benched: score=0, enabledSize=0, totalSize=3',
    'All cards benched failed (score=' + hand.score() + ', enabledSize=' + hand.enabledSize() + ', totalSize=' + hand.totalSize() + ')'
  );

  // 2.4 Necromancer enabled survives round-trip (limit stays 8)
  hand.clear();
  hand.loadFromString('FR28,FR16,FR13,FR19,FR01,FR02,FR04,FR17+');
  var str3 = hand.toString();
  hand.clear();
  hand.loadFromString(str3);
  assert(
    hand.limit() === 8 && hand.enabledSize() === 8,
    'URL round-trip with Necromancer: limit=8, enabledSize=8',
    'URL round-trip with Necromancer failed (limit=' + hand.limit() + ', enabledSize=' + hand.enabledSize() + ')'
  );
})();

(function testScoreWithCardEnabledEdgeCases() {
  function assert(condition, passMsg, failMsg) {
    if (condition) { passed++; console.log('\x1b[32mPASS\x1b[0m ' + passMsg); }
    else           { failed++; console.log('\x1b[31mFAIL\x1b[0m ' + failMsg); }
  }

  // 3.1: Necromancer bench potential includes its own strength
  hand.clear();
  ['FR16','FR13','FR19','FR17','FR01','FR02'].forEach(function(id) {
    hand.addCard(deck.getCardById(id));
  });
  hand.cardsInHand['FR28'] = new CardInHand(deck.getCardById('FR28'), undefined, false);
  var base31 = hand.score();
  var potential31 = hand.scoreWithCardEnabled('FR28');
  assert(
    potential31 > base31 && potential31 - base31 >= 3,
    'scoreWithCardEnabled(Necromancer) includes its own strength (delta=' + (potential31 - base31) + ')',
    'scoreWithCardEnabled(Necromancer) should add >= 3 to score, got delta=' + (potential31 - base31)
  );

  // 3.2: No limit inflation; no mutation when FR05 evaluated alongside benched Necromancer
  // (FR11 instead of FR16 so Wildfire doesn't blank Earth Elemental)
  hand.clear();
  ['FR11','FR13','FR19','FR17','FR01','FR02','FR04'].forEach(function(id) {
    hand.addCard(deck.getCardById(id));
  });
  hand.cardsInHand['FR28'] = new CardInHand(deck.getCardById('FR28'), undefined, false);
  hand.cardsInHand['FR05'] = new CardInHand(deck.getCardById('FR05'), undefined, false);
  var base32 = hand.score();
  var potential32 = hand.scoreWithCardEnabled('FR05');
  assert(
    typeof potential32 === 'number' && potential32 > base32,
    'scoreWithCardEnabled(FR05) returns a score including FR05 (potential=' + potential32 + ', base=' + base32 + ')',
    'scoreWithCardEnabled(FR05) should return a score greater than base (potential=' + potential32 + ', base=' + base32 + ')'
  );
  assert(
    hand.limit() === 7,
    'scoreWithCardEnabled(FR05) does not inflate limit() — Necromancer still benched',
    'scoreWithCardEnabled(FR05) should not inflate limit() (expected 7, got ' + hand.limit() + ')'
  );
  assert(
    hand.enabledSize() === 7,
    'scoreWithCardEnabled(FR05) does not mutate enabledSize()',
    'scoreWithCardEnabled(FR05) should not mutate enabledSize() (expected 7, got ' + hand.enabledSize() + ')'
  );

  // 3.3: No state mutation — all card.enabled values identical before and after
  hand.clear();
  ['FR16','FR13','FR19','FR17'].forEach(function(id) {
    hand.addCard(deck.getCardById(id));
  });
  hand.cardsInHand['FR01'] = new CardInHand(deck.getCardById('FR01'), ['dummy'], false);
  var snapshotBefore = {};
  hand.cards().forEach(function(c) { snapshotBefore[c.id] = c.enabled; });
  hand.scoreWithCardEnabled('FR01');
  var allMatch = hand.cards().every(function(c) { return c.enabled === snapshotBefore[c.id]; });
  assert(
    allMatch,
    'scoreWithCardEnabled(FR01) does not mutate any card.enabled state',
    'scoreWithCardEnabled(FR01) mutated at least one card.enabled state'
  );
  assert(
    hand.getCardById('FR01').enabled === false,
    'scoreWithCardEnabled(FR01) leaves FR01 disabled after call',
    'scoreWithCardEnabled(FR01) left FR01 enabled after call'
  );

  // 3.4: Wildfire blanks Earth Elemental — potential equals base (not a bug)
  hand.clear();
  ['FR16','FR13','FR19','FR17','FR01','FR02'].forEach(function(id) {
    hand.addCard(deck.getCardById(id));
  });
  hand.cardsInHand['FR05'] = new CardInHand(deck.getCardById('FR05'), undefined, false);
  var base34 = hand.score();
  var potential34 = hand.scoreWithCardEnabled('FR05');
  assert(
    potential34 === base34,
    'scoreWithCardEnabled(FR05) equals base when Wildfire blanks it (potential=' + potential34 + ')',
    'scoreWithCardEnabled(FR05) with Wildfire should equal base (' + base34 + '), got ' + potential34
  );
})();

deck.enableCursedHoardSuits();
cursedHoardSuits = true;

assertScoreByCode('CH10,FR41,FR10,FR07,FR22,FR23+', 114);
assertScoreByCode('CH08,FR32,FR37+CH08:FR32', 57, 'Angel');
// Phoenix
assertScoreByCode('FR55,FR37,FR16,FR11,CH08,FR49+CH08:FR16,FR49:FR37:wizard', 116, 'Phoenix can not be blanked by any card except Floods');
assertScoreByCode('FR55,CH10+', 59, 'Phoenix can not be blanked by Demon');
assertScoreByCode('FR55,CH10,FR18,FR15+', 87, 'Phoenix prevents blanking by Demon because of its bonus');
assertScoreByCode('CH18,FR55,FR27+', 41, 'Great Flood can still blank a Phoenix since it is a Flood');
assertScoreByCode('FR55,FR45,FR22+', 59, 'Phoenix can not blank any other card');
assertScoreByCode('FR55,FR02,CH17,FR15,FR22,FR26,FR11+', 114, 'Phoenix also counts as a Weather');
assertScoreByCode('FR55,FR13,FR20,FR17,FR26+', 94, 'Phoenix also counts as a Flame');
assertScoreByCode('FR55,FR20,FR17,FR26,FR19,FR15,FR14,FR13+', 252, 'Phoenix is a Flame and a Weather at the same time');
assertScoreByCode('FR55,FR30+', 29, 'Phoenix gives double bonus for Enchantress');
assertScoreByCode('FR55,FR12+', 34, 'Phoenix gives double penalty for Blizzard');
assertScoreByCode('FR55,CH21,FR15+', 35, 'Bonus of Phoenix prevents bonus of World Tree');
assertScoreByCode('FR55,FR20,FR15,CH22,FR53,FR26,FR27+CH22:FR55,FR53:FR55', 109, 'Copy of a Phoenix only counts as a Beast');
// Phoenix (Promo)
assertScoreByCode('FR55P,FR02,CH17,FR15,FR22,FR26,FR11+', 114, 'Phoenix (Promo) also counts as a Weather');
assertScoreByCode('FR55P,FR13,FR20,FR17,FR26+', 94, 'Phoenix (Promo) also counts as a Flame');
assertScoreByCode('FR55P,FR20,FR17,FR26,FR19,FR15,FR14,FR13+', 252, 'Phoenix (Promo) is a Flame and a Weather at the same time');
assertScoreByCode('FR55P,FR30+', 29, 'Phoenix (Promo) gives double bonus for Enchantress');
assertScoreByCode('FR55P,FR12+', 34, 'Phoenix (Promo) gives double penalty for Blizzard');
assertScoreByCode('FR55P,CH21,FR15+', 35, 'Bonus of Phoenix (Promo) prevents bonus of World Tree');
assertScoreByCode('FR55P,FR20,FR15,CH22,FR53,FR26,FR27+CH22:FR55,FR53:FR55P', 109, 'Copy of a Phoenix (Promo) only counts as a Beast');
assertScoreByCode('FR55P,FR10,FR20,FR15,FR36,FR38,FR26,CH05+', 132, 'Phoenix (Promo) retains suits when blanked');

// testBenchScoring inline
(function testBenchScoring() {
  hand.clear();
  hand.addCard(deck.getCardById('FR16')); // Wildfire (40)
  hand.addCard(deck.getCardById('FR13')); // Smoke (27)
  hand.addCard(deck.getCardById('FR19')); // Lightning (11)
  hand.addCard(deck.getCardById('FR17')); // Candle (2)

  var baseScore = hand.score(discard);

  // Mountain disabled on bench: scores 9 base + 50 bonus with Smoke+Wildfire
  var mountain = deck.getCardById('FR01');
  hand.cardsInHand['FR01'] = new CardInHand(mountain, undefined, false);

  var scoreWithMountain = hand.scoreWithCardEnabled('FR01', discard);
  var expectedDifference = 59; // Mountain base (9) + Smoke+Wildfire bonus (+50)
  var actualDifference = scoreWithMountain - baseScore;

  if (actualDifference === expectedDifference) {
    passed++;
    console.log('\x1b[32mPASS\x1b[0m scoreWithCardEnabled correctly calculates Mountain bench potential (+' + actualDifference + ')');
  } else {
    failed++;
    console.log('\x1b[31mFAIL\x1b[0m scoreWithCardEnabled for Mountain expected +' + expectedDifference + ', got +' + actualDifference);
  }

  var scoreAfter = hand.score(discard);
  if (scoreAfter === baseScore) {
    passed++;
    console.log('\x1b[32mPASS\x1b[0m scoreWithCardEnabled preserves original enabled state');
  } else {
    failed++;
    console.log('\x1b[31mFAIL\x1b[0m scoreWithCardEnabled mutated state (base: ' + baseScore + ', after: ' + scoreAfter + ')');
  }
})();

console.log('\n--- Results: ' + passed + ' passed, ' + failed + ' failed ---');
process.exit(failed > 0 ? 1 : 0);
