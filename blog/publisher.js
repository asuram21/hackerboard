/* 위드시큐 블로그 자동 발행기 (티스토리 글쓰기 화면에서 실행)
 * 사용: await TPUB.run('<post 폴더 raw URL>', {mode:'draft'|'publish'})
 * post.json 형식은 blog/README.md 참고
 */
(function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const log = [];
  const say = m => { log.push(m); console.log('[TPUB] ' + m); };

  async function waitFor(fn, ms = 15000, step = 250) {
    const t = Date.now();
    while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(step); }
    return null;
  }

  // 편집기의 "사진" 첨부 메뉴가 여는 파일 입력을 가로채 파일을 넣는다
  function installClickHook() {
    if (window.__tpubHook) return;
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.type === 'file' && window.__tpubCapture) { window.__tpubCaptured = this; return; }
      return orig.apply(this, arguments);
    };
    window.__tpubHook = true;
  }

  function imageMarks() {
    return (tinymce.activeEditor.getContent().match(/\[##_Image\|[^\]]*?_##\]/g) || []);
  }

  async function uploadToEditor(blob, name) {
    const before = imageMarks().length;
    window.__tpubCapture = true; window.__tpubCaptured = null;
    const findItem = () => [...document.querySelectorAll('.mce-tistory-attach-item')].find(e => e.textContent.trim() === '사진');
    if (!findItem()) {  // 첨부 메뉴는 처음 열 때 만들어짐
      const opener = $('#mceu_0-open') || document.querySelector('.mce-i-image')?.closest('button');
      if (opener) { opener.click(); await waitFor(findItem, 3000, 100); }
    }
    const item = findItem();
    if (!item) throw new Error('사진 첨부 메뉴를 찾지 못함');
    item.click();
    const inp = await waitFor(() => window.__tpubCaptured, 5000, 100);
    window.__tpubCapture = false;
    if (!inp) throw new Error('파일 입력 가로채기 실패');
    const dt = new DataTransfer();
    dt.items.add(new File([blob], name, { type: blob.type || 'image/jpeg' }));
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    const ok = await waitFor(() => imageMarks().length > before, 30000);
    if (!ok) throw new Error('업로드 응답 없음: ' + name);
    const marks = imageMarks();
    return marks[marks.length - 1];
  }

  async function fetchBlob(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('이미지 받기 실패 ' + r.status + ' ' + url);
    return r.blob();
  }

  function setTitle(title) {
    const t = $('#post-title-inp');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, title);
    t.dispatchEvent(new Event('input', { bubbles: true }));
    t.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function setCategory(name) {
    $('#category-btn').click();
    await sleep(500);
    const want = name.trim();
    const span = [...document.querySelectorAll('span')].find(e => e.offsetParent &&
      e.textContent.replace(/^-\s*/, '').trim() === want);
    if (!span) throw new Error('카테고리 없음: ' + name);
    (span.closest('[role=option]') || span.parentElement).click();
    await sleep(300);
  }

  function currentTags() {
    return [...document.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && /^#\S/.test(e.textContent.trim()) && e.offsetParent)
      .map(e => e.textContent.trim().slice(1));
  }

  async function addTags(tags) {
    const inp = $('#tagText');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const tag of tags) {
      inp.focus();
      set.call(inp, tag);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      for (const type of ['keydown', 'keypress', 'keyup'])
        inp.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      await sleep(150);
    }
    return currentTags();
  }

  async function setThumbnail(blob) {
    const box = await waitFor(() => $('.box_thumb'), 5000);
    if (!box) throw new Error('대표이미지 영역 없음');
    const del = box.parentElement.querySelector('button[class*=del], .btn_del, .ico_del');
    const inp = box.querySelector('input[type=file]');
    if (!inp && del) { del.click(); await sleep(400); }
    const fin = $('.box_thumb input[type=file]');
    if (!fin) return '기존 대표이미지 유지';
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'thumb.jpg', { type: blob.type || 'image/jpeg' }));
    fin.files = dt.files;
    fin.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => $('.box_thumb .thumb_g'), 15000);
    return '대표이미지 설정';
  }

  async function run(base, opt = {}) {
    log.length = 0;
    if (!/\/manage\/newpost/.test(location.pathname)) throw new Error('글쓰기 화면이 아님');
    await waitFor(() => window.tinymce && tinymce.activeEditor && $('#post-title-inp'));
    base = base.replace(/\/?$/, '/');
    const post = await fetch(base + 'post.json', { cache: 'no-store' }).then(r => r.json());
    let html = await fetch(base + (post.body || 'body.html'), { cache: 'no-store' }).then(r => r.text());
    say('원고: ' + post.title);

    installClickHook();
    tinymce.activeEditor.setContent('');
    const blobs = {};
    // 대표이미지를 첫 업로드로 (티스토리는 첫 이미지를 대표로 잡음)
    for (const img of post.images || []) {
      blobs[img.key] = await fetchBlob(base + img.file);
      if (img.upload === false) continue;
      img.mark = await uploadToEditor(blobs[img.key], img.file.split('/').pop());
      say('업로드: ' + img.key);
    }
    for (const img of post.images || []) {
      const rep = img.mark || `<img src="${base + img.file}" alt="${img.alt || ''}" style="width:100%">`;
      html = html.split('{{' + img.key + '}}').join(rep);
    }
    const left = html.match(/\{\{[A-Za-z0-9_]+\}\}/g);
    if (left) throw new Error('채워지지 않은 자리표시: ' + left.join(','));
    tinymce.activeEditor.setContent(html);
    say('본문 ' + html.length + '자');

    setTitle(post.title);
    await setCategory(post.category);
    say('카테고리: ' + post.category);
    const tags = await addTags(post.tags || []);
    say('태그: ' + tags.join(', '));

    const mode = opt.mode || post.mode || 'draft';
    if (mode === 'draft') {
      const b = [...document.querySelectorAll('button')].find(e => e.offsetParent && /임시저장/.test(e.textContent));
      if (b) { b.click(); await sleep(1500); say('임시저장 완료'); }
      return { ok: true, mode, log: [...log] };
    }

    $('#publish-layer-btn').click();
    await sleep(800);
    const vis = { public: 'open20', protected: 'open15', private: 'open0' }[post.visibility || 'public'];
    $('#' + vis).click();
    await sleep(200);
    if (post.thumb && blobs[post.thumb]) say(await setThumbnail(blobs[post.thumb]));
    if (post.reserve) say('예약 발행은 아직 미지원: 즉시 발행 대신 중단');
    if (post.reserve) return { ok: false, mode, log: [...log] };
    if (opt.dryRun) { say('dryRun: 발행 직전 중단'); return { ok: true, mode, log: [...log] }; }
    $('#publish-btn').click();
    say('발행 요청');
    return { ok: true, mode, log: [...log] };
  }

  async function latest() {
    const j = await fetch('/manage/posts.json?category=-3&page=1&searchKeyword=&searchType=title&visibility=all').then(r => r.json());
    const p = (j.items || [])[0];
    return p && { id: p.id, title: p.title, visibility: p.visibility, category: p.category, url: p.permalink };
  }

  window.TPUB = { run, latest, log };
})();
