// ============================================================
// demo-seed.js — Sample data for the "Try it out" demo
// Author: Dylan Smith
// Date:   2026-05-28
//
// Returns a fresh snapshot of demo loans + borrows. Dates are
// computed relative to the moment the demo starts so the
// overdue / returned / written-off views always look right.
// ============================================================

window.buildDemoSeed = function buildDemoSeed() {
  const daysAgo = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };
  const daysAhead = n => daysAgo(-n);

  // Category IDs match the db.js fallback list:
  //   1 Other, 2 Book, 3 Tool, 4 Clothing, 5 Media
  const loans = [
    { id: 1, item: 'Circular Saw', person: 'Marcus', categoryId: 3,
      date: daysAgo(5),  due: daysAhead(10), notes: 'For the deck rebuild',
      returned: false, returnedDate: null,
      writtenOff: false, writeoffReason: null, writtenOffDate: null },

    { id: 2, item: 'Tartine Bread Cookbook', person: 'Liz', categoryId: 2,
      date: daysAgo(45), due: daysAgo(14), notes: '',
      returned: false, returnedDate: null,
      writtenOff: false, writeoffReason: null, writtenOffDate: null },

    { id: 3, item: 'Yeti Cooler', person: 'Sam', categoryId: 1,
      date: daysAgo(90), due: '', notes: 'Camping trip',
      returned: true, returnedDate: daysAgo(30),
      writtenOff: false, writeoffReason: null, writtenOffDate: null },

    { id: 4, item: 'Lewis Pass Jacket', person: 'Dad', categoryId: 4,
      date: daysAgo(200), due: '', notes: '',
      returned: false, returnedDate: null,
      writtenOff: true, writeoffReason: 'Given as Gift', writtenOffDate: daysAgo(60) },
  ];

  const borrows = [
    { id: 1, item: 'Pressure Washer', person: 'Dave', categoryId: 3,
      date: daysAgo(2),  due: daysAhead(5), notes: 'Driveway cleanup',
      returned: false, returnedDate: null,
      writtenOff: false, writeoffReason: null, writtenOffDate: null },

    { id: 2, item: 'Dune (paperback)', person: 'Priya', categoryId: 2,
      date: daysAgo(45), due: daysAgo(7), notes: '',
      returned: false, returnedDate: null,
      writtenOff: false, writeoffReason: null, writtenOffDate: null },

    { id: 3, item: 'The Last of Us (PS5)', person: 'Jordan', categoryId: 5,
      date: daysAgo(30), due: '', notes: '',
      returned: true, returnedDate: daysAgo(10),
      writtenOff: false, writeoffReason: null, writtenOffDate: null },

    { id: 4, item: 'Black Hoodie', person: 'Sara', categoryId: 4,
      date: daysAgo(120), due: '', notes: '',
      returned: false, returnedDate: null,
      writtenOff: true, writeoffReason: 'Lost', writtenOffDate: daysAgo(30) },
  ];

  return { loans, borrows };
};
