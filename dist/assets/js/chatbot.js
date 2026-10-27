(() => {
  'use strict';
  const config = window.OM_CHAT_CONFIG;
  if (!config || !window.HTMLDialogElement) return;

  const robotMarkup = '<span class="robot3d" aria-hidden="true"><span class="robot3d-face"><i></i><i></i></span></span>';
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'nav-chat-button';
  launcher.setAttribute('aria-label', 'เปิดแชท Bot Chelsea');
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'om-chat-dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.innerHTML = robotMarkup + '<span class="chat-launcher-copy"><b>Bot Chelsea</b><small>FOOTBALL COMPANION</small></span><span class="chat-ready-dot" aria-hidden="true"></span>';
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const oldSocial = nav.querySelector('.nav-social');
  if (oldSocial) oldSocial.replaceWith(launcher); else nav.append(launcher);
  document.querySelector('header')?.classList.add('chat-site-header');

  const dialog = document.createElement('dialog');
  dialog.id = 'om-chat-dialog';
  dialog.className = 'chat-dialog';
  dialog.setAttribute('aria-labelledby', 'om-chat-title');
  dialog.setAttribute('aria-describedby', 'om-chat-privacy');
  dialog.innerHTML = `
    <header class="chat-dialog-header">${robotMarkup}<div class="chat-dialog-title"><h2 id="om-chat-title"></h2><p>BOT CHELSEA · เรื่องโอห์มและฟุตบอล</p></div><button type="button" class="chat-close" aria-label="ปิดแชท">×</button></header>
    <div class="chat-privacy" id="om-chat-privacy"><span aria-hidden="true">◈</span> ไม่บันทึกประวัติ · ข้อความหายเมื่อรีเฟรชหรือเปลี่ยนหน้า</div>
    <div class="chat-tools"><span>สกอร์จากผู้ให้บริการ · คาดการณ์ก่อนเริ่มแข่ง</span><button type="button" class="chat-reset">เริ่มใหม่</button></div>
    <div class="chat-messages" role="log" aria-label="บทสนทนากับผู้ช่วย" aria-live="polite" aria-relevant="additions"></div>
    <p class="chat-prompt-caption">ลองถาม “เชลซี พบ อาร์เซนอล 2026-11-01” หรือ “ผลบอลเมื่อวาน”</p>
    <form class="chat-compose"><label class="sr-only" for="om-chat-input">ข้อความถึงผู้ช่วย</label><input id="om-chat-input" name="message" type="text" placeholder="พิมพ์คำถามของคุณ…" autocomplete="off" maxlength="500" required><button type="submit" aria-label="ส่งข้อความ">↗</button></form>
    <p class="chat-footer">ไม่เก็บประวัติแชท · คำค้นฟุตบอลใช้ดึงข้อมูลผ่านผู้ให้บริการ</p>`;
  document.body.append(dialog);
  dialog.querySelector('#om-chat-title').textContent = 'Bot Chelsea';
  const log = dialog.querySelector('.chat-messages');
  const form = dialog.querySelector('form');
  const input = dialog.querySelector('input');
  const send = form.querySelector('button');
  let opened = false;
  let busy = false;
  let lastFixtureId = null;
  let footballAbort = null;
  const footballModule = import('./football-query.mjs');
  let epoch = 0;
  let knowledge = new Map(config.fallback.map(item => [item.slug, item]));

  // Deliberately keep the conversation only in this page's DOM: no storage,
  // Auth sessions, message insert calls, analytics, or outbound AI requests.
  function scrollToLatest() { log.scrollTop = log.scrollHeight; }
  function appendTextWithLinks(target, text) {
    const urlPattern = /https:\/\/[^\s<]+/g;
    let last = 0;
    for (const match of text.matchAll(urlPattern)) {
      target.append(document.createTextNode(text.slice(last, match.index)));
      const link = document.createElement('a');
      link.href = match[0];
      link.textContent = match[0];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      target.append(link);
      last = match.index + match[0].length;
    }
    target.append(document.createTextNode(text.slice(last)));
  }
  function message(role, text) {
    const row = document.createElement('div');
    row.className = 'chat-message' + (role === 'user' ? ' chat-message-user' : '');
    const label = document.createElement('span');
    label.className = 'chat-message-label';
    label.textContent = role === 'user' ? 'คุณ' : 'BOT CHELSEA · ตอบอัตโนมัติ';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    appendTextWithLinks(bubble, text);
    row.append(label, bubble);
    log.append(row);
    // Bound this transient DOM, including in unusually long conversations.
    while (log.childElementCount > 60) log.firstElementChild.remove();
    scrollToLatest();
  }
  const quickTopics = [
    ['about-om', 'รู้จักโอห์ม'], ['favorite-players', 'นักเตะที่ชอบ'],
    ['favorite-coaches', 'โค้ชที่ชอบ'], ['stamford-dream', 'ความฝันของโอห์ม'],
    ['contact-om', 'ช่องทางติดต่อ'], ['football-today', '⚽ บอลวันนี้'], ['football-live', '● กำลังแข่ง'], ['football-yesterday', 'ผลบอลเมื่อวาน'], ['football-prediction', 'โอกาสชนะ %']
  ];
  function showQuickReplies(autoScroll = true) {
    log.querySelector('.chat-quick-replies')?.remove();
    const choices = document.createElement('div');
    choices.className = 'chat-quick-replies';
    choices.setAttribute('aria-label', 'คำถามที่แนะนำ');
    quickTopics.forEach(([slug, title]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = title;
      button.addEventListener('click', () => respond(title, slug));
      choices.append(button);
    });
    log.append(choices);
    if (autoScroll) scrollToLatest();
  }
  function reset() {
    epoch++;
    footballAbort?.abort();
    lastFixtureId = null;
    busy = false;
    send.disabled = false;
    log.replaceChildren();
    input.value = '';
    message('bot', `สวัสดีครับ 💙 ยินดีต้อนรับสู่ ${config.brand}\nผมคือ Bot Chelsea ผู้ช่วยเรื่องโอห์มและฟุตบอล เลือกดูโปรแกรม ผลการแข่งขัน หรือค่าคาดการณ์ก่อนแข่งได้ครับ ข้อมูลฟุตบอลจะพร้อมเมื่อเชื่อมผู้ให้บริการแล้ว`);
    showQuickReplies();
  }
  function matchTopic(text) {
    const q = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (/(?:บอต|bot).*(?:ชื่อ|ใคร)|ชื่อ.*(?:บอต|bot)|^bot\s*chelsea$/i.test(q)) return 'bot-name';
    if (/(เก็บ|บันทึก|ประวัติ(?:แชท|สนทนา)|privacy|ข้อมูลส่วนตัว)/.test(q)) return 'privacy';
    if (/(ฝากข้อความ|คุยกับ.*โดยตรง|คนจริง|แอดมิน|ทักโอ|ทักโอม)/.test(q)) return 'handoff';
    if (/(ติดต่อ|ติดตาม|เฟซ|เฟส|facebook|tiktok|ติ๊ก|ติ้ก|โซเชียล|social)/.test(q)) return 'contact-om';
    if (/(โค้ช|โค๊ช|ทูเคิล|อลอนโซ|coach|tuchel|alonso)/.test(q)) return 'favorite-coaches';
    if (/(นักเตะ|ดร็อก|ดรอก|อาซาร์|อาซา|เทอร์รี|เทอรี่|hazard|drogba|terry|player)/.test(q)) return 'favorite-players';
    if (/(ฝัน|สแตม|สนาม|ลอนดอน|stamford|dream|london)/.test(q)) return 'stamford-dream';
    if (/(อายุ|กี่ปี|ตั้งแต่|เมื่อไหร่|เริ่มเชียร์|รู้จัก|ประวัติ|ใคร|เกี่ยวกับ|about|age)/.test(q)) return 'about-om';
    if (/(สวัสดี|หวัดดี|hello|hi\b|ดีครับ|ดีค่ะ|ทักทาย)/.test(q)) return 'greeting';
    if (/(ขอบคุณ|thank)/.test(q)) return 'thanks';
    return null;
  }
  function getAnswer(topic) {
    if (topic === 'bot-name') return 'ผมชื่อ Bot Chelsea ครับ 💙 เป็นผู้ช่วยอัตโนมัติของอ้ายโอห์ม ตอบข้อมูลเกี่ยวกับโอห์ม และค้นโปรแกรม สกอร์ หรือค่าคาดการณ์ก่อนแข่งเมื่อเชื่อมบริการข้อมูลฟุตบอลแล้วครับ';
    if (topic === 'privacy') return 'เวอร์ชันนี้ไม่บันทึกประวัติแชทครับ ข้อความอยู่เฉพาะหน้าที่เปิดอยู่และจะหายเมื่อรีเฟรชหรือเปลี่ยนหน้า ไม่มีการเก็บข้อความลง Supabase ครับ สำหรับคำถามฟุตบอล ระบบส่งเฉพาะวัน ชื่อทีม และรหัสคู่ที่เลือกไปยังบริการข้อมูลเพื่อค้นสกอร์ โดยไม่ส่งบทสนทนาทั้งหมดและไม่เรียกโมเดล AI ครับ';
    if (topic === 'handoff') return 'ตอนนี้เป็นโหมดตอบคำถามทั่วไป ยังรับฝากข้อความไม่ได้ครับ หากอยากคุยกับโอห์มโดยตรง แวะไปที่ Facebook: https://www.facebook.com/wanatsarutcp/ หรือ TikTok: https://www.tiktok.com/@ohmwntsrut ได้เลยครับ 💙';
    if (topic === 'greeting') return 'สวัสดีครับ 💙 ผมคือ Bot Chelsea ผู้ช่วยของอ้ายโอห์ม อยากรู้จักโอห์ม หรือถามเรื่องนักเตะ โค้ช และความฝันได้เลยครับ';
    if (topic === 'thanks') return 'ยินดีครับ 💙 มีเรื่องไหนอยากรู้เกี่ยวกับโอห์ม เลือกคำถามด้านล่างได้เลยนะครับ';
    if (topic && knowledge.has(topic)) return knowledge.get(topic).answer;
    return 'ลองถามเรื่องโอห์ม หรือดูฟุตบอลด้วยคำว่า “บอลวันนี้”, “ผลบอลเมื่อวาน” และ “เชลซี vs อาร์เซนอล YYYY-MM-DD” ได้ครับ หากอยากดูโอกาสชนะ ให้เลือกคู่ที่ยังไม่แข่งแล้วกดคาดการณ์ครับ 💙';
  }
  async function respond(text, selectedTopic, explicitRequest) {
    if (busy) return;
    busy = true;
    send.disabled = true;
    const currentEpoch = epoch;
    log.querySelector('.chat-quick-replies')?.remove();
    message('user', text);
    input.value = '';
    const typing = document.createElement('span');
    typing.className = 'chat-typing';
    typing.textContent = 'Bot Chelsea กำลังเตรียมข้อมูล…';
    log.append(typing);
    scrollToLatest();
    await new Promise(resolve => setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280));
    const faqTopic = selectedTopic || matchTopic(text);
    let footballResult = null;
    try {
      const request = explicitRequest || await footballRequest(text, selectedTopic, faqTopic);
      if (request) {
        typing.textContent = 'กำลังดึงข้อมูลฟุตบอล…';
        const result = await fetchFootball(request);
        if (epoch !== currentEpoch) return;
        typing.remove();
        footballResult = renderFootball(result, request);
      } else {
        if (epoch !== currentEpoch) return;
        typing.remove();
        message('bot', getAnswer(faqTopic));
      }
    } catch (error) {
      if (epoch !== currentEpoch) return;
      typing.remove();
      message('bot', error.message || 'โหลดข้อมูลฟุตบอลไม่สำเร็จครับ');
    }
    showQuickReplies(!footballResult);
    if (footballResult) log.scrollTop += footballResult.getBoundingClientRect().top - log.getBoundingClientRect().top - 10;
    busy = false;
    send.disabled = false;
    if (dialog.open) input.focus({ preventScroll: true });
  }
  async function footballRequest(text, selectedTopic, faqTopic) {
    if (selectedTopic && !selectedTopic.startsWith('football-')) return null;
    const strong = /(ผลบอล|สกอร์|โปรแกรมบอล|บอลวันนี้|บอลสด|บอลเมื่อวาน|ใคร.*(?:ชนะ|เตะ|แข่ง)|มีบอล|โอกาส.*ชนะ|คาดการณ์|เปอร์เซ็นต์|\svs\s)/iu.test(text);
    if (faqTopic && !selectedTopic?.startsWith('football-') && !strong) return null;
    const mod = await footballModule;
    const presets = { 'football-today': 'บอลวันนี้', 'football-live': 'บอลสด', 'football-yesterday': 'ผลบอลเมื่อวาน', 'football-prediction': 'คาดการณ์บอลวันนี้' };
    const plan = mod.parseFootballQuestion(presets[selectedTopic] || text);
    if (!plan.sport) return null;
    if (!plan.valid) throw new Error('วันที่ไม่ถูกต้องครับ ลองระบุ YYYY-MM-DD เช่น 2026-11-01');
    if (/คู่นี้|เกมนี้/iu.test(text) && !plan.teams.length) {
      if (!lastFixtureId) throw new Error('กรุณาเลือกคู่จากรายการด้วยปุ่ม “ดูผลคู่นี้” หรือ “คาดการณ์ %” ก่อนครับ');
      return { mode: plan.prediction ? 'prediction' : 'fixture', fixture: String(lastFixtureId) };
    }
    return { mode: 'fixtures', date: plan.date, teams: JSON.stringify(plan.teams), live: plan.live ? '1' : '0', finished: plan.finished ? '1' : '0', page: '1' };
  }
  async function fetchFootball(parameters) {
    const controller = new AbortController();
    footballAbort = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const url = new URL('/.netlify/functions/football', location.origin);
      Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
      const response = await fetch(url, { credentials: 'omit', signal: controller.signal, referrerPolicy: 'no-referrer' });
      let payload;
      try { payload = await response.json(); } catch { throw new Error('บริการสกอร์ยังไม่พร้อมบนเว็บไซต์นี้ครับ เจ้าของเว็บต้องอัปเดตส่วนบริการฟุตบอลก่อน'); }
      if (!response.ok) throw new Error(payload.error?.message || 'บริการฟุตบอลขัดข้องชั่วคราวครับ');
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('การโหลดข้อมูลใช้เวลานาน กรุณาลองใหม่อีกครั้งครับ');
      throw error;
    } finally { clearTimeout(timer); if (footballAbort === controller) footballAbort = null; }
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const statusText = { NS: 'ยังไม่เริ่ม', TBD: 'รอยืนยันเวลา', '1H': 'ครึ่งแรก', HT: 'พักครึ่ง', '2H': 'ครึ่งหลัง', ET: 'ต่อเวลา', BT: 'พักก่อนต่อเวลา', P: 'ยิงจุดโทษ', FT: 'จบเกม', AET: 'จบต่อเวลา', PEN: 'จบจุดโทษ', PST: 'เลื่อนแข่ง', CANC: 'ยกเลิก', SUSP: 'ระงับ', INT: 'หยุดชั่วคราว', ABD: 'ยุติการแข่งขัน', AWD: 'ตัดสินผล', WO: 'ชนะผ่าน', LIVE: 'กำลังแข่ง' };
  function fixtureCard(fixture, showActions = true) {
    const card = element('article', 'football-card');
    const league = element('div', 'football-league', fixture.league.country + ' · ' + fixture.league.name);
    const date = new Date(fixture.date);
    const time = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date) : 'ยังไม่ยืนยันเวลา';
    const status = element('span', 'football-status', (statusText[fixture.status] || fixture.status) + (fixture.elapsed != null && !fixture.finished ? ` ${fixture.elapsed}′` : ''));
    const scores = element('div', 'football-scoreline');
    scores.append(element('strong', '', fixture.home.name));
    const notStarted = ['NS', 'TBD', 'PST', 'CANC'].includes(fixture.status);
    scores.append(element('b', 'football-score', notStarted ? 'VS' : `${fixture.goals.home ?? '–'} : ${fixture.goals.away ?? '–'}`));
    scores.append(element('strong', '', fixture.away.name));
    card.append(league, status, scores, element('small', 'football-kickoff', time + ' · เวลาไทย'));
    if (fixture.penalties.home !== null && fixture.penalties.away !== null) card.append(element('small', 'football-penalties', `จุดโทษ ${fixture.penalties.home} : ${fixture.penalties.away}`));
    if (showActions) {
      const actions = element('div', 'football-card-actions');
      const detail = element('button', '', 'ดูผลคู่นี้'); detail.type = 'button';
      detail.addEventListener('click', () => { lastFixtureId = fixture.id; respond(`${fixture.home.name} vs ${fixture.away.name} — ดูผล`, null, { mode: 'fixture', fixture: String(fixture.id) }); });
      actions.append(detail);
      if (fixture.status === 'NS') {
        const prediction = element('button', 'football-predict', 'คาดการณ์ %'); prediction.type = 'button';
        prediction.addEventListener('click', () => { lastFixtureId = fixture.id; respond(`${fixture.home.name} vs ${fixture.away.name} — คาดการณ์`, null, { mode: 'prediction', fixture: String(fixture.id) }); });
        actions.append(prediction);
      }
      card.append(actions);
    }
    return card;
  }
  function renderFootball(data, request) {
    const block = element('div', 'football-results');
    if (data.kind === 'fixtures') {
      lastFixtureId = data.total === 1 ? data.fixtures[0]?.id : null;
      if (!data.total) {
        message('bot', `ไม่พบคู่ที่ตรงกับเงื่อนไขในข้อมูลผู้ให้บริการ${data.live ? 'ที่กำลังแข่ง' : ' วันที่ ' + data.date} ครับ ลองเปลี่ยนวันหรือใช้ชื่อทีมภาษาอังกฤษ เช่น Ajax vs PSV 2026-11-01 ทั้งนี้ไม่ได้หมายความว่าไม่มีการแข่งขันนอกความครอบคลุมของ API ครับ`);
        return;
      }
      block.append(element('p', 'football-summary', `${data.live ? 'คู่ที่กำลังแข่ง' : 'โปรแกรม / ผล วันที่ ' + data.date} · พบ ${data.total} คู่ · หน้า ${data.page}`));
      data.fixtures.forEach(fixture => block.append(fixtureCard(fixture)));
      if (data.hasMore) {
        const more = element('button', 'football-more', 'ดูคู่เพิ่มเติม →'); more.type = 'button';
        more.addEventListener('click', () => respond('ดูคู่เพิ่มเติม', null, { ...request, page: String(data.page + 1) }));
        block.append(more);
      }
    } else {
      lastFixtureId = data.fixture.id;
      block.append(fixtureCard(data.fixture, data.kind === 'fixture'));
      if (data.kind === 'prediction') {
        if (!data.available) block.append(element('p', 'football-note', data.reason));
        else {
          block.append(element('h3', 'football-prediction-title', 'โอกาสก่อนเริ่มแข่ง'));
          const sides = [['home', data.fixture.home.name + ' ชนะ'], ['draw', 'เสมอ'], ['away', data.fixture.away.name + ' ชนะ']];
          sides.forEach(([side, label]) => {
            const row = element('div', 'football-probability football-' + side);
            const line = element('div', 'football-probability-label');
            line.append(element('span', '', label), element('b', '', data.percentages[side] + '%'));
            const progress = element('progress', ''); progress.max = 100; progress.value = data.percentages[side]; progress.setAttribute('aria-label', label);
            row.append(line, progress); block.append(row);
          });
          block.append(element('p', 'football-note', `สำหรับ ${data.fixture.home.name}: ชนะ ${data.percentages.home}% · เสมอ ${data.percentages.draw}% · แพ้ ${data.percentages.away}%`));
          block.append(element('p', 'football-note', data.note));
        }
      }
    }
    const updated = new Date(data.fetchedAt);
    const time = Number.isFinite(updated.getTime()) ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(updated) : 'ไม่ทราบเวลา';
    block.append(element('small', 'football-source', `${data.source} · ดึงข้อมูล ${time} เวลาไทย\nครอบคลุมตามลีก/แพ็กเกจ อาจมีความล่าช้า`));
    log.append(block); return block;
  }
  let answersLoaded = false;
  async function loadPublishedAnswers() {
    if (answersLoaded) return;
    answersLoaded = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(config.supabaseUrl + '/rest/v1/bot_knowledge?select=slug,question,answer&is_published=eq.true', {
        method: 'GET',
        headers: { apikey: config.publishableKey },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Answers unavailable');
      const rows = await response.json();
      if (Array.isArray(rows)) rows.forEach(row => {
        if (typeof row.slug === 'string' && typeof row.answer === 'string' && row.answer.length <= 4000) knowledge.set(row.slug, row);
      });
    } catch {
      // The supplied website facts remain available without a network connection.
      answersLoaded = false;
    } finally { clearTimeout(timer); }
  }
  launcher.addEventListener('click', () => {
    if (!opened) { reset(); opened = true; }
    dialog.showModal();
    launcher.setAttribute('aria-expanded', 'true');
    loadPublishedAnswers();
    input.focus({ preventScroll: true });
  });
  dialog.querySelector('.chat-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.chat-reset').addEventListener('click', () => { reset(); input.focus(); });
  dialog.addEventListener('close', () => { launcher.setAttribute('aria-expanded', 'false'); launcher.focus({ preventScroll: true }); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  form.addEventListener('submit', event => { event.preventDefault(); const text = input.value.trim(); if (text && text.length <= 500) respond(text); });
})();
