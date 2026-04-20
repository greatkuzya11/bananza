(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BananzaAiImageRisk = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WORD_BOUNDARY = '[^a-zа-яё0-9_]+';
  const RISK_GROUPS = [
    {
      category: 'genitals',
      terms: [
        'penis', 'cock', 'dick', 'prick', 'schlong', 'johnson', 'willy', 'dong', 'pecker', 'boner', 'erection', 'phallus',
        'pussy', 'cunt', 'vagina', 'twat', 'snatch', 'beaver', 'cooch', 'vulva', 'labia', 'clit', 'clitoris', 'hood',
        'balls', 'testicles', 'nuts', 'scrotum', 'sack', 'gonads', 'foreskin', 'glans', 'head', 'tip', 'shaft',
        'хуй', 'хер', 'член', 'залупа', 'головка', 'пенис', 'елда', 'писька', 'пизда', 'вагина', 'киска', 'манда',
        'блядина', 'клитор', 'клит', 'яйца', 'мошонка',
      ],
    },
    {
      category: 'sexual_acts',
      terms: [
        'cum', 'semen', 'jizz', 'spunk', 'load', 'ejaculate', 'squirt', 'creampie', 'bukkake', 'orgasm', 'climax',
        'fuck', 'sex', 'intercourse', 'blowjob', 'head', 'oral', 'cunnilingus', 'rimjob', 'anal', 'doggy', 'missionary',
        'rape', 'gangbang', 'pedo', 'lolita', 'child porn', 'underage', 'incest', 'bestiality',
        'сперма', 'кончить', 'конча', 'оргазм', 'ебля', 'трах', 'минет', 'отсос', 'анал', 'изнасилование',
        'групповуха', 'педо', 'лоли', 'детская порно', 'зоофилия',
      ],
    },
    {
      category: 'gore',
      terms: [
        'blood', 'gore', 'decapitate', 'behead', 'dismember', 'mutilate', 'disembowel', 'guts', 'entrails', 'brain matter',
        'kill', 'murder', 'torture', 'stab', 'shoot', 'explode', 'bomb', 'guillotine', 'hanging', 'crucifixion',
        'corpse', 'dead body', 'mutilated', 'severed', 'hacked', 'sliced',
        'кишки', 'кровь', 'расчлененка', 'труп', 'обезглавить', 'вспороть', 'взорвать',
      ],
    },
    {
      category: 'waste',
      terms: [
        'shit', 'poop', 'feces', 'crap', 'turd', 'diarrhea', 'piss', 'urine', 'scat', 'golden shower', 'puke', 'vomit',
        'говно', 'какашка', 'дерьмо', 'моча', 'срать', 'ссать', 'рвота',
      ],
    },
    {
      category: 'extremes',
      terms: [
        'nazi gas', 'holocaust', 'oven', 'zyklon', 'child abuse', 'snuff', 'genocide', 'faggot nuke', 'kike',
      ],
    },
    {
      category: 'custom',
      terms: [
        'суп из 7',
      ],
    },
  ];

  function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeRiskText(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/ё/g, 'е')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compileTerm(term) {
    const normalized = normalizeRiskText(term);
    const source = escapeRegex(normalized).replace(/\\ /g, '\\s+');
    return {
      term: normalized,
      regex: new RegExp(`(^|${WORD_BOUNDARY})(${source})(?=$|${WORD_BOUNDARY})`, 'iu'),
    };
  }

  const COMPILED_GROUPS = RISK_GROUPS.map((group) => ({
    category: group.category,
    entries: group.terms.map(compileTerm),
  }));

  function analyzeAiImageRisk(value) {
    const text = normalizeRiskText(value);
    if (!text) return { risky: false, matches: [], normalizedText: text };
    const matches = [];
    const seen = new Set();
    for (const group of COMPILED_GROUPS) {
      for (const entry of group.entries) {
        if (!entry.regex.test(text)) continue;
        const key = `${group.category}:${entry.term}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({
          category: group.category,
          term: entry.term,
        });
      }
    }
    return {
      risky: matches.length > 0,
      matches,
      normalizedText: text,
    };
  }

  function isRiskyAiImagePrompt(value) {
    return analyzeAiImageRisk(value).risky;
  }

  return {
    analyzeAiImageRisk,
    isRiskyAiImagePrompt,
    normalizeRiskText,
  };
}));
