'use strict';

var TYPE_LABEL = { app: 'アプリ', diagram: '図解', skill: 'スキル', sheet: 'シート' };

/* 種別タブの並び順 */
var TYPE_ORDER = ['app', 'diagram', 'skill', 'sheet'];

/* サムネイルのない種別に使う記号 */
var MARKS = {
  skill: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.2 20 7.6 12 12 4 7.6z"/><path d="M4 12.2 12 16.6 20 12.2"/><path d="M4 16.6 12 21 20 16.6"/></svg>',
  sheet: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.2" y="4.2" width="17.6" height="15.6" rx="2"/><path d="M3.2 9.4h17.6M3.2 14.6h17.6M9.6 9.4V19.8M15.2 9.4V19.8"/></svg>'
};

function el(tag, props, children) {
  var node = document.createElement(tag);
  Object.keys(props || {}).forEach(function (key) {
    if (key === 'text') node.textContent = props[key];
    else if (key === 'class') node.className = props[key];
    else if (props[key] != null) node.setAttribute(key, props[key]);
  });
  (children || []).forEach(function (child) { if (child) node.appendChild(child); });
  return node;
}

function badge(type) {
  return el('span', { class: 'badge badge-' + type, text: TYPE_LABEL[type] || type });
}

/* 2026-11 と 2026-11-27 が混在するので、並べ替え用に桁をそろえる */
function sortKey(value) {
  var digits = String(value || '').replace(/\D/g, '');
  return (digits + '00000000').slice(0, 8);
}

function load() {
  return fetch('items.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('items.json を読み込めませんでした（' + res.status + '）');
      return res.json();
    })
    .then(function (data) {
      return { genres: data.genres || [], items: data.items || [] };
    });
}

function fail(container, message) {
  container.textContent = '';
  container.appendChild(el('div', { class: 'empty', text: message }));
}

/* ======================= 一覧ページ ======================= */

function initIndex() {
  var sections = document.getElementById('sections');
  var railList = document.getElementById('rail-list');
  var countEl = document.getElementById('count');
  var typesEl = document.getElementById('types');
  var searchEl = document.getElementById('search');

  var genres = [];
  var items = [];
  var filterType = 'all';
  var observer = null;

  function matches(item, words) {
    if (!words.length) return true;
    var hay = [item.title, item.summary]
      .concat(item.tags || [], item.benefits || [])
      .join(' ')
      .toLowerCase();
    return words.every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function card(item) {
    var thumb;
    if (item.thumb) {
      thumb = el('div', { class: 'thumb' }, [
        el('img', { src: item.thumb, alt: '', loading: 'lazy', decoding: 'async', width: '1280', height: '800' })
      ]);
    } else {
      var mark = el('div', { class: 'thumb-mark badge-' + item.type });
      mark.innerHTML = MARKS[item.type] || '';
      mark.appendChild(el('span', { text: TYPE_LABEL[item.type] || '' }));
      thumb = el('div', { class: 'thumb' }, [mark]);
    }

    var meta = el('div', { class: 'card-meta' }, [badge(item.type)]);
    if (item.updated) meta.appendChild(el('span', { class: 'card-date', text: item.updated }));

    return el('li', {}, [
      el('a', { class: 'card', href: 'item.html?id=' + encodeURIComponent(item.id) }, [
        thumb,
        meta,
        el('h3', { class: 'card-title', text: item.title }),
        item.summary ? el('p', { class: 'card-summary', text: item.summary }) : null
      ])
    ]);
  }

  function renderRail(visibleByGenre) {
    railList.textContent = '';
    genres.forEach(function (g) {
      var n = (visibleByGenre[g.id] || []).length;
      if (!n) return;
      railList.appendChild(el('li', {}, [
        el('a', { href: '#genre-' + g.id, 'data-genre': g.id }, [
          el('span', { text: g.label }),
          el('span', { class: 'n', text: String(n) })
        ])
      ]));
    });
  }

  function watchSections() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;

    var links = {};
    railList.querySelectorAll('a[data-genre]').forEach(function (a) {
      links[a.dataset.genre] = a;
    });

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(links).forEach(function (id) { links[id].removeAttribute('aria-current'); });
        var active = links[entry.target.dataset.genre];
        if (active) active.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-120px 0px -65% 0px' });

    sections.querySelectorAll('.section').forEach(function (s) { observer.observe(s); });
  }

  function render() {
    var words = searchEl.value.trim().toLowerCase().split(/\s+/).filter(Boolean);

    var visible = items.filter(function (item) {
      return (filterType === 'all' || item.type === filterType) && matches(item, words);
    });

    var byGenre = {};
    visible.forEach(function (item) {
      (byGenre[item.genre] = byGenre[item.genre] || []).push(item);
    });

    countEl.textContent = visible.length ? visible.length + ' 件' : '';
    sections.textContent = '';

    if (!visible.length) {
      railList.textContent = '';
      sections.appendChild(el('div', { class: 'empty', text: '該当するものはありません。別の言葉で探すか、種別の絞り込みを外してみてください。' }));
      return;
    }

    genres.forEach(function (g) {
      var list = byGenre[g.id];
      if (!list || !list.length) return;

      sections.appendChild(el('section', { class: 'section', id: 'genre-' + g.id, 'data-genre': g.id }, [
        el('div', { class: 'section-head' }, [
          el('h2', { text: g.label }),
          el('span', { class: 'n', text: String(list.length) })
        ]),
        g.note ? el('p', { class: 'section-note', text: g.note }) : null,
        el('ul', { class: 'grid' }, list.map(card))
      ]));
    });

    renderRail(byGenre);
    watchSections();
  }

  function buildTypeTabs() {
    var present = TYPE_ORDER.filter(function (t) {
      return items.some(function (i) { return i.type === t; });
    });

    [{ id: 'all', label: 'すべて' }].concat(present.map(function (t) {
      return { id: t, label: TYPE_LABEL[t] };
    })).forEach(function (t) {
      var tab = el('button', {
        class: 'type-tab',
        type: 'button',
        role: 'tab',
        'data-type': t.id,
        'aria-selected': String(t.id === 'all')
      }, [el('span', { text: t.label })]);

      tab.addEventListener('click', function () {
        filterType = t.id;
        typesEl.querySelectorAll('.type-tab').forEach(function (other) {
          other.setAttribute('aria-selected', String(other === tab));
        });
        render();
      });

      typesEl.appendChild(tab);
    });
  }

  searchEl.addEventListener('input', render);

  load()
    .then(function (data) {
      genres = data.genres;
      items = data.items.slice().sort(function (a, b) {
        return sortKey(b.updated).localeCompare(sortKey(a.updated));
      });
      buildTypeTabs();
      render();
    })
    .catch(function (err) { fail(sections, err.message); });
}

/* ======================= 詳細ページ ======================= */

function copyButton(text) {
  var button = el('button', { class: 'copy', type: 'button', text: 'コピー' });
  button.addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        button.textContent = 'コピーしました';
        setTimeout(function () { button.textContent = 'コピー'; }, 1600);
      }, function () {
        button.textContent = '手動でコピーしてください';
      });
    } else {
      button.textContent = '手動でコピーしてください';
    }
  });
  return button;
}

function stepNode(step) {
  var li = el('li', {}, [el('span', { text: step.text || '' })]);
  if (step.code) {
    li.appendChild(el('div', { class: 'code' }, [
      el('code', { text: step.code }),
      copyButton(step.code)
    ]));
  }
  return li;
}

function renderDetail(item, genres) {
  var box = document.getElementById('detail');
  box.textContent = '';
  document.title = item.title + ' | AI Tool Studio';

  var genre = genres.filter(function (g) { return g.id === item.genre; })[0];

  var meta = el('div', { class: 'detail-meta' }, [badge(item.type)]);
  if (genre) {
    meta.appendChild(el('a', {
      class: 'genre-label',
      href: 'index.html#genre-' + genre.id,
      text: genre.label
    }));
  }
  box.appendChild(meta);
  box.appendChild(el('h1', { text: item.title }));
  if (item.summary) box.appendChild(el('p', { class: 'lead', text: item.summary }));

  if (item.url && item.thumb) {
    box.appendChild(el('a', {
      class: 'preview',
      href: item.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': item.title + ' を開く'
    }, [el('img', { src: item.thumb, alt: item.title + ' の画面', width: '1280', height: '800' })]));
  }

  var actions = [];
  if (item.url) {
    actions.push(el('a', {
      class: 'btn',
      href: item.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      text: 'サイトを開く'
    }));
    actions.push(el('span', { class: 'url-note', text: item.url.replace(/^https?:\/\//, '').replace(/\/$/, '') }));
  }
  if (actions.length) box.appendChild(el('div', { class: 'actions' }, actions));

  if ((item.benefits || []).length) {
    box.appendChild(el('h2', { text: 'これでできること' }));
    box.appendChild(el('ul', { class: 'benefits' }, item.benefits.map(function (line) {
      return el('li', { text: line });
    })));
  }

  if ((item.steps || []).length) {
    box.appendChild(el('h2', { text: '導入手順' }));
    box.appendChild(el('ol', { class: 'steps' }, item.steps.map(stepNode)));
  }

  if ((item.downloads || []).length) {
    box.appendChild(el('h2', { text: '入手する' }));
    box.appendChild(el('div', { class: 'actions' }, item.downloads.map(function (file) {
      return el('a', { class: 'btn', href: file.path, download: '', text: file.label + ' をダウンロード' });
    })));
  }

  if ((item.tags || []).length) {
    box.appendChild(el('ul', { class: 'tag-list' }, item.tags.map(function (tag) {
      return el('li', { class: 'tag', text: tag });
    })));
  }

  if (item.updated) box.appendChild(el('p', { class: 'stamp', text: '最終更新：' + item.updated }));
}

function initItem() {
  var box = document.getElementById('detail');
  var id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    fail(box, '作品が指定されていません。一覧から選んでください。');
    return;
  }

  load()
    .then(function (data) {
      var item = data.items.filter(function (i) { return i.id === id; })[0];
      if (!item) {
        fail(box, 'この作品は見つかりませんでした。一覧から選び直してください。');
        return;
      }
      renderDetail(item, data.genres);
    })
    .catch(function (err) { fail(box, err.message); });
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('sections')) initIndex();
  if (document.getElementById('detail')) initItem();
});
