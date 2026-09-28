// campaign/site/site.js — Naadag Hasaka's own tabs on the VTT's site, ahead of the system's
// (engine/instance.js, stage `site`): the saga's home, the chronicle, the party, the people they met.
// Everything drawn comes from campaign/data/docs.js (window.NAADAG_DOCS, built by
// campaign/build/build_docs.py from campaign/docs/). A character's Path, Archetype, Motivation and
// Nation link to the book's own entry, which opens even with the books closed (engine/site.js).
(function () {
  const DOCS = window.NAADAG_DOCS;
  const tabs = window.VttSiteTabs;
  if (!DOCS || !Array.isArray(tabs)) return;
  const { el } = window.VttRender;
  const D = window.CnCData;

  const page = (container) => { const p = el('div', { class: 'page nh-page' }); container.appendChild(p); return p; };
  const prose = (h, cls) => { const d = el('div', { class: 'nh-prose' + (cls ? ' ' + cls : '') }); d.innerHTML = h; return d; };
  const crumbs = (ctx, id, label, here) => el('div', { class: 'crumbs' }, [el('a', { href: ctx.href(id) }, [label]), here ? ' › ' + here : '']);

  // the book's entry of that type and name, as a link (or the plain word when the book has none)
  function bookLink(type, name) {
    const r = D && D.records ? D.records().find((x) => x.type === type && x.name === name) : null;
    return r ? el('a', { class: 'ref', href: '#book/' + encodeURIComponent(r.book) + '/' + encodeURIComponent(r.id) }, [name]) : name;
  }
  const facts = (rows) => el('table', { class: 'nh-facts' }, [el('tbody', {}, rows.filter((r) => r[1]).map((r) => el('tr', {}, [el('th', {}, [r[0]]), el('td', {}, [r[1]])])))]);
  const chapter = (n) => DOCS.chronicle.find((c) => c.n === n);

  // ── the saga ──
  function renderHome(container, path, ctx) {
    const p = page(container);
    const h = DOCS.home;
    p.appendChild(el('div', { class: 'nh-hero' }, [el('h1', { class: 'nh-title' }, [h.title]), el('p', { class: 'nh-sub' }, [h.subtitle])]));
    p.appendChild(prose(h.html, 'nh-lede'));
    const cards = [
      ['chronicle', 'The Chronicle', DOCS.chronicle.length + ' chapters: ' + DOCS.chronicle.map((c) => c.title).join(', ')],
      ['party', 'The Travellers', DOCS.party.map((c) => c.name).join(', ')],
      ['people', 'Dramatis Personae', DOCS.people.length + ' met at the Seeing'],
    ];
    p.appendChild(el('div', { class: 'nh-cards' }, cards.map((c) => el('a', { class: 'shelf-book nh-card', href: ctx.href(c[0]) }, [el('div', { class: 'nh-card-t' }, [c[1]]), el('div', { class: 'muted small' }, [c[2]])]))));
  }

  // ── the chronicle: its contents, then one chapter to a page ──
  function renderChronicle(container, path, ctx) {
    const p = page(container);
    const c = path[0] && DOCS.chronicle.find((x) => x.slug === path[0]);
    if (!c) {
      p.appendChild(el('h2', { class: 'chapter-h' }, ['The Chronicle']));
      p.appendChild(el('ol', { class: 'nh-toc' }, DOCS.chronicle.map((x) => el('li', {}, [
        el('a', { href: ctx.href('chronicle', [x.slug]) }, [x.title]), el('span', { class: 'muted small' }, [' · ' + x.part]),
      ]))));
      return;
    }
    const prev = chapter(c.n - 1), next = chapter(c.n + 1);
    p.appendChild(crumbs(ctx, 'chronicle', 'The Chronicle', c.title));
    p.appendChild(el('h2', { class: 'chapter-h nh-chapter-h' }, [c.title]));
    p.appendChild(el('div', { class: 'nh-part muted' }, [c.part]));
    p.appendChild(prose(c.html, 'nh-chapter'));
    p.appendChild(el('nav', { class: 'nh-turn' }, [
      prev ? el('a', { href: ctx.href('chronicle', [prev.slug]) }, ['‹ ' + prev.title]) : el('span'),
      next ? el('a', { href: ctx.href('chronicle', [next.slug]) }, [next.title + ' ›']) : el('span'),
    ]));
  }

  // ── the travellers ──
  const subtitle = (x) => [x.archetype, x.path, x.companion].filter(Boolean).join(' · ');
  function renderParty(container, path, ctx) {
    const p = page(container);
    const x = path[0] && DOCS.party.find((c) => c.slug === path[0]);
    if (!x) {
      p.appendChild(el('h2', { class: 'chapter-h' }, ['The Travellers']));
      p.appendChild(el('div', { class: 'nh-people' }, DOCS.party.map((c) => el('a', { class: 'nh-person', href: ctx.href('party', [c.slug]) }, [
        el('div', { class: 'nh-person-n' }, [c.name]), el('div', { class: 'nh-person-s muted small' }, [subtitle(c)]),
      ]))));
      return;
    }
    p.appendChild(crumbs(ctx, 'party', 'The Travellers', x.name));
    p.appendChild(el('h2', { class: 'chapter-h' }, [x.name]));
    p.appendChild(facts([
      ['Age', x.age ? String(x.age) : ''], ['Archetype', x.archetype && bookLink('Archetype', x.archetype)],
      ['Path', x.path && bookLink('Path', x.path)], ['Motivation', x.motivation && bookLink('Motivation', x.motivation)],
      ['From', x.nation && bookLink('Nation', x.nation)], ['Lives', x.home], ['Travels as', x.companion],
    ]));
    p.appendChild(prose(x.html));
  }

  // ── the people they met ──
  function renderPeople(container, path, ctx) {
    const p = page(container);
    const x = path[0] && DOCS.people.find((c) => c.slug === path[0]);
    if (!x) {
      p.appendChild(el('h2', { class: 'chapter-h' }, ['Dramatis Personae']));
      p.appendChild(el('div', { class: 'nh-people' }, DOCS.people.map((c) => el('a', { class: 'nh-person', href: ctx.href('people', [c.slug]) }, [
        el('div', { class: 'nh-person-n' }, [c.name]), el('div', { class: 'nh-person-s muted small' }, [c.role]),
      ]))));
      return;
    }
    p.appendChild(crumbs(ctx, 'people', 'Dramatis Personae', x.name));
    p.appendChild(el('h2', { class: 'chapter-h' }, [x.name]));
    p.appendChild(el('div', { class: 'nh-part muted' }, [x.role]));
    p.appendChild(prose(x.html));
    const chs = (x.chapters || []).map(chapter).filter(Boolean);
    if (chs.length) {
      p.appendChild(el('h4', {}, ['In the chronicle']));
      p.appendChild(el('ul', { class: 'nh-in' }, chs.map((c) => el('li', {}, [el('a', { href: ctx.href('chronicle', [c.slug]) }, [c.title])]))));
    }
  }

  tabs.unshift(
    { id: 'saga', label: 'Naadag Hasaka', render: renderHome, group: 'saga' },
    { id: 'chronicle', label: 'The Chronicle', render: renderChronicle, group: 'saga' },
    { id: 'party', label: 'The Travellers', render: renderParty, group: 'saga' },
    { id: 'people', label: 'Dramatis Personae', render: renderPeople, group: 'saga' },
  );
})();
