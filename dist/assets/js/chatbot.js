(() => {
  'use strict';
  const config = window.OM_CHAT_CONFIG;
  if (!config || !window.HTMLDialogElement) return;

  const robotMarkup = '<span class="robot3d" aria-hidden="true"><span class="robot3d-face"><i></i><i></i></span></span>';
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'nav-chat-button';
  launcher.setAttribute('aria-label', 'เปิดแชทผู้ช่วย ' + config.brand);
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'om-chat-dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.innerHTML = robotMarkup + '<span class="chat-launcher-copy"><b>คุยกับบอต 💙</b><small>BLUE BUDDY · FAQ</small></span><span class="chat-ready-dot" aria-hidden="true"></span>';
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
    <header class="chat-dialog-header">${robotMarkup}<div class="chat-dialog-title"><h2 id="om-chat-title"></h2><p>BLUE BUDDY · ผู้ช่วยตอบคำถามทั่วไป</p></div><button type="button" class="chat-close" aria-label="ปิดแชท">×</button></header>
    <div class="chat-privacy" id="om-chat-privacy"><span aria-hidden="true">◈</span> ไม่บันทึกประวัติ · ข้อความหายเมื่อรีเฟรชหรือเปลี่ยนหน้า</div>
    <div class="chat-tools"><span>คำตอบจากข้อมูลที่เตรียมไว้ ไม่ใช่ AI สนทนาอิสระ</span><button type="button" class="chat-reset">เริ่มใหม่</button></div>
    <div class="chat-messages" role="log" aria-label="บทสนทนากับผู้ช่วย" aria-live="polite" aria-relevant="additions"></div>
    <p class="chat-prompt-caption">ถามเรื่องโอห์ม นักเตะ โค้ช ความฝัน หรือช่องทางติดต่อได้ครับ</p>
    <form class="chat-compose"><label class="sr-only" for="om-chat-input">ข้อความถึงผู้ช่วย</label><input id="om-chat-input" name="message" type="text" placeholder="พิมพ์คำถามของคุณ…" autocomplete="off" maxlength="500" required><button type="submit" aria-label="ส่งข้อความ">↗</button></form>
    <p class="chat-footer">โหมดนี้ไม่ส่งข้อความของคุณไปเก็บในฐานข้อมูล</p>`;
  document.body.append(dialog);
  dialog.querySelector('#om-chat-title').textContent = config.brand;
  const log = dialog.querySelector('.chat-messages');
  const form = dialog.querySelector('form');
  const input = dialog.querySelector('input');
  const send = form.querySelector('button');
  let opened = false;
  let busy = false;
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
    label.textContent = role === 'user' ? 'คุณ' : 'BLUE BUDDY · ตอบอัตโนมัติ';
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
    ['contact-om', 'ช่องทางติดต่อ']
  ];
  function showQuickReplies() {
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
    scrollToLatest();
  }
  function reset() {
    epoch++;
    busy = false;
    send.disabled = false;
    log.replaceChildren();
    input.value = '';
    message('bot', `สวัสดีครับ 💙 ยินดีต้อนรับสู่ ${config.brand}\nผมคือ Blue Buddy ผู้ช่วยตอบคำถามเกี่ยวกับโอห์ม ลองเลือกหัวข้อด้านล่างหรือพิมพ์ถามได้เลยครับ`);
    showQuickReplies();
  }
  function matchTopic(text) {
    const q = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (/(เก็บ|บันทึก|ประวัติ|privacy|ข้อมูลส่วนตัว)/.test(q)) return 'privacy';
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
    if (topic === 'privacy') return 'เวอร์ชันนี้ไม่บันทึกประวัติแชทครับ ข้อความอยู่เฉพาะหน้าที่เปิดอยู่และจะหายเมื่อรีเฟรชหรือเปลี่ยนหน้า ไม่มีการส่งข้อความของคุณไปเก็บใน Supabase หรือส่งให้บริการ AI ครับ';
    if (topic === 'handoff') return 'ตอนนี้เป็นโหมดตอบคำถามทั่วไป ยังรับฝากข้อความไม่ได้ครับ หากอยากคุยกับโอห์มโดยตรง แวะไปที่ Facebook: https://www.facebook.com/wanatsarutcp/ หรือ TikTok: https://www.tiktok.com/@ohmwntsrut ได้เลยครับ 💙';
    if (topic === 'greeting') return 'สวัสดีครับ 💙 ผมคือ Blue Buddy ผู้ช่วยของอ้ายโอห์ม อยากรู้จักโอห์ม หรือถามเรื่องนักเตะ โค้ช และความฝันได้เลยครับ';
    if (topic === 'thanks') return 'ยินดีครับ 💙 มีเรื่องไหนอยากรู้เกี่ยวกับโอห์ม เลือกคำถามด้านล่างได้เลยนะครับ';
    if (topic && knowledge.has(topic)) return knowledge.get(topic).answer;
    return 'ตอนนี้ผมตอบได้เฉพาะข้อมูลเกี่ยวกับโอห์มที่เตรียมไว้ครับ ยังไม่ได้เชื่อม AI หรือข่าวฟุตบอลสด ลองถามเรื่องนักเตะที่ชอบ ความฝัน หรือช่องทางติดต่อจากปุ่มด้านล่างได้เลยครับ 💙';
  }
  async function respond(text, selectedTopic) {
    if (busy) return;
    busy = true;
    send.disabled = true;
    const currentEpoch = epoch;
    log.querySelector('.chat-quick-replies')?.remove();
    message('user', text);
    input.value = '';
    const typing = document.createElement('span');
    typing.className = 'chat-typing';
    typing.textContent = 'ผู้ช่วยกำลังเตรียมคำตอบ…';
    log.append(typing);
    scrollToLatest();
    await new Promise(resolve => setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280));
    if (epoch !== currentEpoch) return;
    typing.remove();
    message('bot', getAnswer(selectedTopic || matchTopic(text)));
    showQuickReplies();
    busy = false;
    send.disabled = false;
    if (dialog.open) input.focus({ preventScroll: true });
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
