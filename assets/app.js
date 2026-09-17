'use strict';

var TYPE_LABEL = { skill: 'スキル', sheet: 'シート', link: 'リンク' };

function el(tag, props, children) {
  var node = document.createElement(tag);
  Object.keys(props || {}).forEach(function (key) {
    if (key === 'text') node.textContent = props[key];
    else if (key === 'class') node.className = props[key];
    else node.setAttribute(key, props[key]);
  });
  (children || []).forEach(function (child) { node.appendChild(child); });
  return node;
}

function typeBadge(type) {
  return el('span', {
    class: 'badge badge-' + type,
    text: TYPE_LABEL[type] || type
  });
}

function loadItems() {
  return fetch('items.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('items.json を読めませんでした（' + res.status + '）');
      return res.json();
    })
    .then(function (data) {
      return (data && data.items) || [];
    });
}

function showError(container, message) {
  container.textContent = '';
  container.appendChild(el('div', { class: 'empty', text: message }));
}

/* ---------- 一覧ページ ---------- */

function initIndex() {
  var grid = document.getElementById('grid');
  var count = document.getElementById('count');
  var search = document.getElementById('search');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var items = [];
  var filter = 'all';

  function matches(item, query) {
    if (!query) return true;
    var haystack = [item.title, item.summary]
      .concat(item.tags || [], item.benefits || [])
      .join(' ')
      .toLowerCase();
    return query.toLowerCase().split(/\s+/).every(function (word) {
      return haystack.indexOf(word) !== -1;
    });
  }

  function card(item) {
    var heading = el('h2', {}, [
      el('a', { href: 'item.html?id=' + encodeURIComponent(item.id), text: item.title })
    ]);
    var meta = el('div', { class: 'card-meta' }, [typeBadge(item.type)]);
    if (item.updated) meta.appendChild(el('span', { text: '更新 ' + item.updated }));
    return el('li', { class: 'card' }, [
      heading,
      el('p', { text: item.summary || '' }),
      meta
    ]);
  }

  function render() {
    var query = search.value.trim();
    var visible = items.filter(function (item) {
      return (filter === 'all' || item.type === filter) && matches(item, query);
    });

    grid.textContent = '';
    if (visible.length === 0) {
      count.textContent = '';
      grid.appendChild(el('li', { class: 'empty', text: '該当する作品はありません。検索の言葉を変えてみてください。' }));
      return;
    }
    count.textContent = visible.length + ' 件';
    visible.forEach(function (item) { grid.appendChild(card(item)); });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      filter = tab.dataset.type;
      tabs.forEach(function (other) {
        other.setAttribute('aria-selected', String(other === tab));
      });
      render();
    });
  });

  search.addEventListener('input', render);

  loadItems()
    .then(function (loaded) {
      items = loaded.slice().sort(function (a, b) {
        return String(b.updated || '').localeCompare(String(a.updated || ''));
      });
      render();
    })
    .catch(function (err) {
      showError(grid.parentNode, err.message);
    });
}

/* ---------- 詳細ページ ---------- */

function copyButton(text) {
  var button = el('button', { class: 'copy', type: 'button', text: 'コピー' });
  button.addEventListener('click', function () {
    var done = function () {
      button.textContent = 'コピーしました';
      setTimeout(function () { button.textContent = 'コピー'; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
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

function renderDetail(item) {
  var box = document.getElementById('detail');
  box.textContent = '';
  document.title = item.title + ' | AI Tool Studio';

  box.appendChild(typeBadge(item.type));
  box.appendChild(el('h1', { text: item.title }));
  if (item.summary) box.appendChild(el('p', { class: 'lead', text: item.summary }));

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

  var links = [];
  (item.downloads || []).forEach(function (file) {
    links.push(el('a', { class: 'btn', href: file.path, download: '', text: file.label + ' をダウンロード' }));
  });
  if (item.url) {
    links.push(el('a', {
      class: 'btn btn-ghost',
      href: item.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      text: '外部サイトを開く'
    }));
  }
  if (links.length) {
    box.appendChild(el('h2', { text: '入手する' }));
    box.appendChild(el('div', { class: 'downloads' }, links));
  }

  if ((item.tags || []).length) {
    box.appendChild(el('ul', { class: 'tag-list' }, item.tags.map(function (tag) {
      return el('li', { class: 'tag', text: tag });
    })));
  }

  if (item.updated) {
    box.appendChild(el('p', { class: 'detail-meta', text: '最終更新：' + item.updated }));
  }
}

function initItem() {
  var box = document.getElementById('detail');
  var id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    showError(box, '作品が指定されていません。一覧から選んでください。');
    return;
  }

  loadItems()
    .then(function (items) {
      var item = items.filter(function (candidate) { return candidate.id === id; })[0];
      if (!item) {
        showError(box, 'この作品は見つかりませんでした。一覧から選び直してください。');
        return;
      }
      renderDetail(item);
    })
    .catch(function (err) {
      showError(box, err.message);
    });
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('grid')) initIndex();
  if (document.getElementById('detail')) initItem();
});
