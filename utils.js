function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
}

function daysSince(d) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function catPillClass(slug) {
  return `category-pill category-pill--${slug || 'other'}`;
}

function matchesSearch(loan, q, categoryName = '') {
  if (!q) return true;
  return loan.item.toLowerCase().includes(q)
      || loan.person.toLowerCase().includes(q)
      || (loan.notes || '').toLowerCase().includes(q)
      || categoryName.toLowerCase().includes(q);
}

// today is injectable so tests are deterministic
function isOverdue(loan, today = new Date().toISOString().split('T')[0]) {
  if (!loan.due || loan.returned || loan.writtenOff) return false;
  return loan.due < today;
}

// categories must be passed explicitly so this function is pure and testable
function resolveCategory(categoryId, categories) {
  return categories.find(c => c.id === categoryId) || { name: 'Other', slug: 'other' };
}

/**
 * getInitials — every word contributes its first letter.
 * "John X Jamrich" → "JXJ", "Marcus" → "M", "Amelia Smith" → "AS"
 */
function getInitials(name) {
  return String(name || '').trim().split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
}

/**
 * sortActiveRecords — order for the "Out on Loan" / "Borrowing Now" lists.
 *
 * Two groups, with all dated items shown before undated ones:
 *   1. Has a return-by date → sort by due ASC, then loan-date ASC,
 *      then item name (case-insensitive).
 *   2. No return-by date → sort by loan-date ASC, then item name.
 *
 * Date strings are ISO ("YYYY-MM-DD"), so plain string compare is
 * chronological. Returns a new array; does not mutate the input.
 */
function sortActiveRecords(records) {
  const cmpName = (a, b) =>
    String(a.item || '').localeCompare(String(b.item || ''), undefined, { sensitivity: 'base' });

  return [...records].sort((a, b) => {
    const aHasDue = !!a.due;
    const bHasDue = !!b.due;

    // Dated items come before undated items.
    if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;

    if (aHasDue) {
      if (a.due  !== b.due)  return a.due  < b.due  ? -1 : 1;
    }
    if (a.date !== b.date)   return a.date < b.date ? -1 : 1;
    return cmpName(a, b);
  });
}

if (typeof module !== 'undefined') module.exports = { escapeHtml, formatDate, daysSince, catPillClass, matchesSearch, isOverdue, resolveCategory, getInitials, sortActiveRecords };
