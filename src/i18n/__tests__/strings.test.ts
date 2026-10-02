import { DICTIONARIES, isStringKey, LANGUAGES, matchLanguage, translate, translatePlural, type StringKey } from '../strings';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  const en = DICTIONARIES.en;

  it.each(LANGUAGES.map((l) => l.code))('%s defines every English key with the same placeholders', (code) => {
    const dict = DICTIONARIES[code];
    for (const key of Object.keys(en) as StringKey[]) {
      expect(typeof dict[key]).toBe('string');
      expect(dict[key].trim().length).toBeGreaterThan(0);
      const expected = placeholders(en[key]);
      const actual = placeholders(dict[key]);
      // Singular forms may leave out {count} ("Revoir la carte ratée").
      const allowed = key.endsWith('_one') ? expected.filter((p) => p !== 'count') : expected;
      for (const p of actual) expect(expected).toContain(p);
      for (const p of allowed) expect(actual).toContain(p);
    }
    expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
  });

  it('gives every plural key both forms', () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith('_other')) expect(isStringKey(key.replace(/_other$/, '_one'))).toBe(true);
      if (key.endsWith('_one')) expect(isStringKey(key.replace(/_one$/, '_other'))).toBe(true);
    }
  });
});

describe('translate', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('en', 'settings.connected', { model: 'MathGPT Flash' })).toBe('Connected to MathGPT Flash ✓');
    expect(translate('es', 'test.questionOf', { n: 2, total: 8 })).toBe('Pregunta 2 de 8');
    expect(translate('en', 'test.questionOf', { n: 2 })).toBe('Question 2 of {total}');
  });

  it('picks plural forms with each language’s rules', () => {
    expect(translatePlural('en', 'artifact.questions', 1)).toBe('1 question');
    expect(translatePlural('en', 'artifact.questions', 8)).toBe('8 questions');
    expect(translatePlural('fr', 'artifact.questions', 0)).toBe('0 question');
    expect(translatePlural('de', 'due.days', 3)).toBe('in 3 Tagen');
    expect(translatePlural('zh', 'artifact.flashcards', 1)).toBe('1 张记忆卡');
  });
});

describe('matchLanguage', () => {
  it('maps device locales to supported languages', () => {
    expect(matchLanguage('pt-BR')).toBe('pt');
    expect(matchLanguage('zh-Hans-CN')).toBe('zh');
    expect(matchLanguage('es_MX')).toBe('es');
    expect(matchLanguage('ja-JP')).toBeNull();
    expect(matchLanguage(undefined)).toBeNull();
  });
});
