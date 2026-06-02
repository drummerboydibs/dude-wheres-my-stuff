const { escapeHtml, formatDate, daysSince, catPillClass, matchesSearch, isOverdue, resolveCategory, getInitials, sortActiveRecords, shouldShowAddForm } = require('../utils.js');

describe('escapeHtml', () => {
  it('escapes ampersands', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  it('escapes angle brackets', () => expect(escapeHtml('<script>')).toBe('&lt;script&gt;'));
  it('escapes double quotes', () => expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;'));
  it('escapes single quotes', () => expect(escapeHtml("it's")).toBe('it&#39;s'));
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

describe('getInitials', () => {
  it('returns a single letter for a one-word name', () => expect(getInitials('Marcus')).toBe('M'));
  it('returns first letter of each word for a two-word name', () => expect(getInitials('Amelia Smith')).toBe('AS'));
  it('includes every word, even middle initials', () => expect(getInitials('John X Jamrich')).toBe('JXJ'));
  it('uppercases lowercase input', () => expect(getInitials('alice')).toBe('A'));
  it('collapses extra whitespace', () => expect(getInitials('  John   Doe  ')).toBe('JD'));
  it('returns empty string for empty input', () => expect(getInitials('')).toBe(''));
  it('returns empty string for null', () => expect(getInitials(null)).toBe(''));
  it('returns empty string for undefined', () => expect(getInitials(undefined)).toBe(''));
});

describe('sortActiveRecords', () => {
  it('puts dated items before undated items', () => {
    const input = [
      { item: 'NoDue',  date: '2020-01-01', due: '' },
      { item: 'WithDue',date: '2025-01-01', due: '2025-12-31' },
    ];
    const out = sortActiveRecords(input);
    expect(out.map(r => r.item)).toEqual(['WithDue', 'NoDue']);
  });

  it('sorts dated items by due date ASC', () => {
    const input = [
      { item: 'Late',  date: '2025-01-01', due: '2025-12-31' },
      { item: 'Early', date: '2025-01-01', due: '2025-03-15' },
      { item: 'Mid',   date: '2025-01-01', due: '2025-06-01' },
    ];
    expect(sortActiveRecords(input).map(r => r.item)).toEqual(['Early', 'Mid', 'Late']);
  });

  it('uses loan date as secondary sort for dated items', () => {
    const input = [
      { item: 'NewerLoan', date: '2025-02-01', due: '2025-03-15' },
      { item: 'OlderLoan', date: '2025-01-01', due: '2025-03-15' },
    ];
    expect(sortActiveRecords(input).map(r => r.item)).toEqual(['OlderLoan', 'NewerLoan']);
  });

  it('uses item name as tertiary sort for dated items', () => {
    const input = [
      { item: 'Zither', date: '2025-01-01', due: '2025-03-15' },
      { item: 'Anvil',  date: '2025-01-01', due: '2025-03-15' },
      { item: 'Banjo',  date: '2025-01-01', due: '2025-03-15' },
    ];
    expect(sortActiveRecords(input).map(r => r.item)).toEqual(['Anvil', 'Banjo', 'Zither']);
  });

  it('sorts item names case-insensitively', () => {
    const input = [
      { item: 'banjo',  date: '2025-01-01', due: '2025-03-15' },
      { item: 'Apple',  date: '2025-01-01', due: '2025-03-15' },
    ];
    expect(sortActiveRecords(input).map(r => r.item)).toEqual(['Apple', 'banjo']);
  });

  it('sorts undated items by loan date ASC', () => {
    const input = [
      { item: 'Newer', date: '2025-08-15', due: '' },
      { item: 'Older', date: '2024-05-01', due: '' },
    ];
    expect(sortActiveRecords(input).map(r => r.item)).toEqual(['Older', 'Newer']);
  });

  it('uses item name as secondary sort for undated items', () => {
    const input = [
      { item: 'Saw',    date: '2024-05-01', due: '' },
      { item: 'Hammer', date: '2024-05-01', due: '' },
    ];
    expect(sortActiveRecords(input).map(r => r.item)).toEqual(['Hammer', 'Saw']);
  });

  it('treats null, undefined, and empty string as no due date', () => {
    const input = [
      { item: 'Dated',     date: '2025-01-01', due: '2025-06-01' },
      { item: 'NullDue',   date: '2024-01-01', due: null },
      { item: 'UndefDue',  date: '2024-01-02', due: undefined },
      { item: 'EmptyDue',  date: '2024-01-03', due: '' },
    ];
    const out = sortActiveRecords(input);
    expect(out[0].item).toBe('Dated');                 // dated first
    expect(out.slice(1).map(r => r.item)).toEqual(['NullDue', 'UndefDue', 'EmptyDue']);
  });

  it('does not mutate the input array', () => {
    const input = [
      { item: 'B', date: '2025-01-01', due: '' },
      { item: 'A', date: '2025-01-01', due: '' },
    ];
    const snapshot = [...input];
    sortActiveRecords(input);
    expect(input).toEqual(snapshot);
  });

  it('returns an empty array for empty input', () => {
    expect(sortActiveRecords([])).toEqual([]);
  });
});

describe('shouldShowAddForm', () => {
  it('returns true with no items',    () => expect(shouldShowAddForm(0)).toBe(true));
  it('returns true at the threshold', () => expect(shouldShowAddForm(3)).toBe(true));
  it('returns false just past it',    () => expect(shouldShowAddForm(4)).toBe(false));
  it('returns false for many items',  () => expect(shouldShowAddForm(100)).toBe(false));
  it('respects a custom threshold',   () => expect(shouldShowAddForm(5, 5)).toBe(true));
  it('returns false above a custom threshold', () => expect(shouldShowAddForm(6, 5)).toBe(false));
});
