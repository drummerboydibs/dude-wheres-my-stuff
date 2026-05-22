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

if (typeof module !== 'undefined') module.exports = { escapeHtml, formatDate, daysSince, catPillClass, matchesSearch, isOverdue, resolveCategory };
