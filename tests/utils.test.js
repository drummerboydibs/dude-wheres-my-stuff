const { escapeHtml, formatDate, daysSince, catPillClass, matchesSearch, isOverdue, resolveCategory } = require('../utils.js');

describe('escapeHtml', () => {
  it('escapes ampersands', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  it('escapes angle brackets', () => expect(escapeHtml('<script>')).toBe('&lt;script&gt;'));
  it('escapes double quotes', () => expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;'));
  it('returns empty string for null', () => expect(escapeHtml(null)).toBe(''));
  it('returns empty string for undefined', () => expect(escapeHtml(undefined)).toBe(''));
  it('coerces numbers to string', () => expect(escapeHtml(42)).toBe('42'));
});

describe('formatDate', () => {
  it('formats a date string', () => expect(formatDate('2026-03-04')).toBe('Mar 4, 2026'));
  it('returns empty string for null', () => expect(formatDate(null)).toBe(''));
  it('returns empty string for empty string', () => expect(formatDate('')).toBe(''));
  it('strips leading zeros from day', () => expect(formatDate('2026-01-01')).toBe('Jan 1, 2026'));
  it('handles December', () => expect(formatDate('2025-12-25')).toBe('Dec 25, 2025'));
});

describe('daysSince', () => {
  it('returns "today" for today\'s date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(daysSince(today)).toBe('today');
  });

  it('returns "1 day ago" for yesterday', () => {
    const d = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    expect(daysSince(d)).toBe('1 day ago');
  });

  it('returns "N days ago" for older dates', () => {
    const d = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
    expect(daysSince(d)).toBe('5 days ago');
  });
});

describe('catPillClass', () => {
  it('returns class with given slug', () => expect(catPillClass('book')).toBe('category-pill category-pill--book'));
  it('falls back to other for empty slug', () => expect(catPillClass('')).toBe('category-pill category-pill--other'));
  it('falls back to other for null', () => expect(catPillClass(null)).toBe('category-pill category-pill--other'));
  it('handles tool slug', () => expect(catPillClass('tool')).toBe('category-pill category-pill--tool'));
});

describe('matchesSearch', () => {
  const loan = { item: 'Circular Saw', person: 'Marcus', notes: 'Bought at Home Depot' };
  it('matches when query is empty', () => expect(matchesSearch(loan, '')).toBe(true));
  it('matches on item name case-insensitively', () => expect(matchesSearch(loan, 'circular')).toBe(true));
  it('matches on person name case-insensitively', () => expect(matchesSearch(loan, 'marcus')).toBe(true));
  it('returns false when no match', () => expect(matchesSearch(loan, 'xyz')).toBe(false));
  it('matches partial item name', () => expect(matchesSearch(loan, 'saw')).toBe(true));
  it('matches on notes case-insensitively', () => expect(matchesSearch(loan, 'depot')).toBe(true));
  it('handles a loan with no notes field', () => expect(matchesSearch({ item: 'A', person: 'B' }, 'a')).toBe(true));
  it('matches on category name when provided', () => expect(matchesSearch(loan, 'tool', 'Tool')).toBe(true));
});

describe('isOverdue', () => {
  it('returns true for a past due date', () => {
    expect(isOverdue({ due: '2020-01-01', returned: false, writtenOff: false }, '2026-05-22')).toBe(true);
  });
  it('returns false when due today', () => {
    expect(isOverdue({ due: '2026-05-22', returned: false, writtenOff: false }, '2026-05-22')).toBe(false);
  });
  it('returns false for a future due date', () => {
    expect(isOverdue({ due: '2030-01-01', returned: false, writtenOff: false }, '2026-05-22')).toBe(false);
  });
  it('returns false when due date is absent', () => {
    expect(isOverdue({ due: '', returned: false, writtenOff: false }, '2026-05-22')).toBe(false);
  });
  it('returns false when loan is already returned', () => {
    expect(isOverdue({ due: '2020-01-01', returned: true, writtenOff: false }, '2026-05-22')).toBe(false);
  });
  it('returns false when loan is written off', () => {
    expect(isOverdue({ due: '2020-01-01', returned: false, writtenOff: true }, '2026-05-22')).toBe(false);
  });
});

describe('resolveCategory', () => {
  const cats = [
    { id: 1, name: 'Other', slug: 'other' },
    { id: 2, name: 'Book',  slug: 'book'  },
    { id: 3, name: 'Tool',  slug: 'tool'  },
  ];
  it('finds a known category by id', () => {
    expect(resolveCategory(2, cats)).toEqual({ id: 2, name: 'Book', slug: 'book' });
  });
  it('falls back to Other for an unknown id', () => {
    expect(resolveCategory(99, cats)).toEqual({ name: 'Other', slug: 'other' });
  });
  it('falls back to Other for undefined id', () => {
    expect(resolveCategory(undefined, cats)).toEqual({ name: 'Other', slug: 'other' });
  });
});
