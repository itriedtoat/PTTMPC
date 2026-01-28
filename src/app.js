/* 
  src/app.js
  Consolidated module containing the app logic moved from script.js.
  This file contains the full game logic, UI wiring, shop, leaderboard, and helpers.
*/

const messages = [
  "oh come on",
  "why would they click the button",
  "really? again?",
  "you clicked it. congratulations.",
  "stop. please. you're doing great though.",
  "this button has feelings.",
  "no refunds.",
  "we are all buttons in the end.",
  "that's one small click for you.",
  "the prophecy is fulfilled.",
  "and another one bites the dust.",
  "you must be curious, I see.",
  "clicks well spent.",
  "the button applauds.",
  "are you trying to collect messages?",
  "unexpected satisfaction unlocked.",
  "there's always one more click...",
  "this is getting intense.",
  "legendary click.",
  "you clicked what now?"
];

const btn = document.getElementById('clickBtn');
const msg = document.getElementById('message');
const scoreEl = document.getElementById('score');
const scoreWrap = document.getElementById('scoreWrap');
const shopBtn = document.getElementById('shopBtn');
const shopModal = document.getElementById('shopModal');
const shopList = document.getElementById('shopList');
const closeShop = document.getElementById('closeShop');
const rebirthBtn = document.getElementById('rebirthBtn');

let lastIndex = -1;
let complaints = 0;
let perClick = 1;
let clickMultiplier = 1;
let autoClickers = 0;
let autoClickInterval = null;

let currentUser = localStorage.getItem('ct_user') || null;
const LEADER_KEY = 'ct_leaderboard';

// helper: load/save leaderboard (array of {name, complaints, spent, rebirths})
function loadLeaderboard(){ try{ return JSON.parse(localStorage.getItem(LEADER_KEY)) || []; }catch(e){ return []; } }
function saveLeaderboard(list){ localStorage.setItem(LEADER_KEY, JSON.stringify(list)); }

function ensureUser(){
  if(currentUser) return currentUser;
  const name = (prompt('Enter your username for leaderboard (max 20 chars):','Player') || 'Player').slice(0,20);
  currentUser = name;
  localStorage.setItem('ct_user', currentUser);
  // ensure user exists in leaderboard
  const list = loadLeaderboard();
  if(!list.find(l=>l.name===currentUser)){
    list.push({ name: currentUser, complaints: 0, spent: 0, rebirths: 0 });
    saveLeaderboard(list);
  }
  return currentUser;
}
function updateLeaderEntry(){
  if(!currentUser) return;
  const list = loadLeaderboard();
  let entry = list.find(l=>l.name===currentUser);
  if(!entry){ 
    entry = { name: currentUser, complaints, spent: 0, rebirths: 0 };
    list.push(entry);
  }
  entry.complaints = complaints;
  if(typeof entry.rebirths !== 'number') entry.rebirths = 0;
  saveLeaderboard(list);
}

function renderLeaderboardPanel(){
  const list = loadLeaderboard().slice();
  // determine most rebirths
  const maxRebirth = list.reduce((m,u)=> Math.max(m, (u.rebirths||0)), 0);
  const topRebirthUsers = list.filter(u=> (u.rebirths||0) === maxRebirth && maxRebirth > 0).map(u=>u.name);
  // sort by complaints desc
  list.sort((a,b)=> b.complaints - a.complaints);
  const wrap = document.createElement('div');
  wrap.className = 'leader-panel';
  let topRebirthHtml = '';
  if(maxRebirth > 0){
    topRebirthHtml = `<div style="margin-bottom:8px;color:var(--muted);font-size:13px;">Most rebirths: <strong>${topRebirthUsers.join(', ')}</strong> (${maxRebirth})</div>`;
  }
  // added Save button (id="savePlace") next to close so user can save their current score to the leaderboard
  wrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"><strong>Global Leaderboard</strong><div style="display:flex;gap:8px;align-items:center;"><button id="savePlace" class="btn mini" title="Save your current score">Save</button><button id="closeLeader" class="btn mini">✕</button></div></div>${topRebirthHtml}<div class="leader-list"></div>`;
  const listEl = wrap.querySelector('.leader-list');
  if(list.length === 0){
    listEl.innerHTML = '<div style="padding:12px;color:var(--muted)">No entries yet. Open leaderboard to register.</div>';
  } else {
    list.forEach((r, i)=>{
      const row = document.createElement('div');
      row.className = 'leader-row';
      row.innerHTML = `<div><div class="name">${i+1}. ${r.name}</div><div class="meta">${(r.complaints||0).toLocaleString()} complaints • Rebirths: ${(r.rebirths||0)}</div></div><div style="text-align:right"><div style="font-weight:700">$${(r.spent||0).toLocaleString()}</div><div class="meta">spent</div></div>`;
      listEl.appendChild(row);
    });
  }
  return wrap;
}

function showLeaderboard(){
  ensureUser();
  // create modal
  if(document.getElementById('leaderModal')) return;
  const modal = document.createElement('div');
  modal.id = 'leaderModal';
  modal.className = 'leader-modal';
  modal.setAttribute('aria-hidden','false');
  modal.innerHTML = '';
  const panel = renderLeaderboardPanel();
  modal.appendChild(panel);
  document.body.appendChild(modal);
  // close handler
  modal.addEventListener('click', (e)=> { if(e.target === modal) closeLeaderboard(); });
  panel.querySelector('#closeLeader').addEventListener('click', closeLeaderboard);

  // wire up Save button: ensures user's current complaints/spent/rebirths are stored
  const saveBtn = panel.querySelector('#savePlace');
  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      ensureUser();
      updateLeaderEntry();
      showMessage('Saved to leaderboard');
      // refresh panel so numbers update
      const newPanel = renderLeaderboardPanel();
      modal.replaceChild(newPanel, panel);
    });
  }
}
function closeLeaderboard(){
  const modal = document.getElementById('leaderModal');
  if(modal) modal.remove();
}

// when purchases happen, record spending
function recordSpending(amount){
  ensureUser();
  const list = loadLeaderboard();
  let entry = list.find(l=>l.name===currentUser);
  if(!entry){ entry = { name: currentUser, complaints, spent: 0 }; list.push(entry); }
  entry.spent = (entry.spent || 0) + amount;
  entry.complaints = complaints;
  saveLeaderboard(list);
}

// add sequence booster: typing MAKEITMORE boosts score x20
const BOOST_CODE = "MAKEITMORE";
let keyBuffer = "";
const TARGET = 9007199254740992; // 2^53 target that triggers panic

function handleKey(char){
  keyBuffer += char.toUpperCase();
  if(keyBuffer.length > BOOST_CODE.length) keyBuffer = keyBuffer.slice(-BOOST_CODE.length);
  if(keyBuffer === BOOST_CODE){
    // perform boost
    complaints = complaints * 20 || 20; // if zero, give initial 20
    scoreEl.textContent = complaints.toLocaleString();
    showMessage("BOOST ACTIVATED — Score x20!");
    // quick visual pulse
    btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
    // reveal score area
    scoreWrap.setAttribute('aria-hidden','false');
    // check for panic condition
    if(complaints >= TARGET) triggerPanic();
    // reset buffer to avoid repeated triggers
    keyBuffer = "";
  }
  // new secret code to open score editor
  if(keyBuffer.endsWith("ANNOYTHEM")){
    keyBuffer = "";
    showScoreEditor();
  }
}
window.addEventListener('keydown', (e) => {
  if(e.key && e.key.length === 1) handleKey(e.key);
});

function pickMessage(){
  if(messages.length === 0) return "";
  let idx;
  do {
    idx = Math.floor(Math.random() * messages.length);
  } while(messages.length > 1 && idx === lastIndex);
  lastIndex = idx;
  return messages[idx];
}

function showMessage(text){
  msg.classList.remove('show');
  // small timeout to allow CSS transition reset when same text repeats
  setTimeout(() => {
    msg.textContent = text;
    msg.classList.add('show');
  }, 60);
}

btn.addEventListener('click', () => {
  const text = pickMessage();
  showMessage(text);
  // increment complaints score and update UI
  const gain = Math.round(perClick * clickMultiplier);
  complaints += gain;
  scoreEl.textContent = complaints.toLocaleString();
  scoreWrap.setAttribute('aria-hidden','false');
  // subtle tiny scale feedback
  btn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(0.98)' }, { transform: 'scale(1)' }],
    { duration: 160, easing: 'ease-out' }
  );
  if(!isFinite(complaints)) triggerPanic();
});

/* SHOP: define powerups */
function ensureAutoInterval(){
  if(autoClickInterval) return;
  autoClickInterval = setInterval(()=> {
    if(autoClickers <= 0) return;
    complaints += autoClickers;
    scoreEl.textContent = complaints.toLocaleString();
  }, 1000);
}

const powerups = [
  { id: 'auto1', name: 'Auto-Clicker', desc: '+1 complaint / sec', cost: 100, apply(){ autoClickers += 1; ensureAutoInterval(); return true } },
  { id: 'auto5', name: 'Auto-5', desc: '+5 complaints / sec', cost: 420, apply(){ autoClickers += 5; ensureAutoInterval(); return true } },
  { id: 'auto10', name: 'Auto-10', desc: '+10 complaints / sec', cost: 900, apply(){ autoClickers += 10; ensureAutoInterval(); return true } },
  { id: 'double30', name: 'Double Clicks (30s)', desc: 'x2 per-click for 30s', cost: 500, apply(){ clickMultiplier = Math.max(2, clickMultiplier) ; setTimeout(()=> clickMultiplier = 1, 30000); return true } },
  { id: 'triple60', name: 'Triple Clicks (60s)', desc: 'x3 per-click for 60s', cost: 1800, apply(){ clickMultiplier = Math.max(3, clickMultiplier); setTimeout(()=> clickMultiplier = 1, 60000); return true } },
  { id: 'perma10', name: '+10 per click', desc: 'increase base click by +10', cost: 2000, apply(){ perClick += 10; return true } },
  { id: 'perma50', name: '+50 per click', desc: 'increase base click by +50', cost: 9000, apply(){ perClick += 50; return true } },
  { id: 'instant1000', name: 'Instant Complaints', desc: '+1,000 complaints instantly', cost: 2500, apply(){ complaints += 1000; scoreEl.textContent = complaints.toLocaleString(); return true } },
  { id: 'rebirthToken', name: 'Rebirth Token', desc: 'Grants +1 rebirth count (for leaderboard)', cost: 3500, apply(){ ensureUser(); const list = loadLeaderboard(); const entry = list.find(l=>l.name===currentUser); if(entry){ entry.rebirths = (entry.rebirths||0) + 1; saveLeaderboard(list); return true } return false } }
];

function renderShop(){
  shopList.innerHTML = '';
  powerups.forEach(p => {
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML = `<div><div><strong>${p.name}</strong></div><div class="meta">${p.desc}</div></div><div><div style="text-align:right">$${p.cost}</div><button class="buy" data-id="${p.id}">Buy</button></div>`;
    shopList.appendChild(el);
  });
  updateShopButtons();
}
function updateShopButtons(){
  shopList.querySelectorAll('.buy').forEach(btn=>{
    const id = btn.dataset.id;
    const p = powerups.find(x=>x.id===id);
    btn.disabled = (complaints < p.cost);
  });
}

shopList.addEventListener('click', (e)=>{
  const b = e.target.closest('button.buy');
  if(!b) return;
  const id = b.dataset.id;
  const p = powerups.find(x=>x.id===id);
  if(!p) return;
  if(complaints < p.cost) { showMessage("Not enough complaints"); return; }
  // purchase
  complaints -= p.cost;
  // record spending for leaderboard
  recordSpending(p.cost);
  scoreEl.textContent = complaints.toLocaleString();
  const ok = p.apply();
  showMessage(ok ? `Purchased: ${p.name}` : `${p.name} already active`);
  updateShopButtons();
});

// update leaderboard entry when score changes (clicks etc)
btn.addEventListener('click', ()=>{
  // after complaint updated in existing handler, update leaderboard entry
  updateLeaderEntry();
  // keep shop buttons in sync
  updateShopButtons();
});

shopBtn.addEventListener('click', ()=>{
  const expanded = shopModal.getAttribute('aria-hidden') === 'false';
  shopModal.setAttribute('aria-hidden', expanded ? 'true' : 'false');
  shopBtn.setAttribute('aria-expanded', String(!expanded));
  if(!expanded){ renderShop(); }
});
closeShop.addEventListener('click', ()=> { shopModal.setAttribute('aria-hidden','true'); shopBtn.setAttribute('aria-expanded','false'); });

// keep shop buttons state updated when score changes
const shopObserver = new MutationObserver(()=> updateShopButtons());
shopObserver.observe(scoreEl, { childList: true, characterData: true, subtree: true });

// Rebirth button: record a rebirth, reset complaints, update leaderboard and UI
// (Removed the full-screen/body-appended rebirth modal so only the in-menu rebirth modal is used)

// Rebirth modal creator extracted so it can be opened from main menu or in-game button
function openRebirthModal(){
  // avoid duplicate
  if(document.getElementById('rebirthModal')) return;
  const MIN_COMPLAINTS = 5000; // requirement to allow rebirth

  // try to insert modal into the main menu panel so it appears on the main menu
  const menuPanel = document.querySelector('#mainMenu .menu-panel');

  // If the menu panel is present but hidden (menu was closed) appending inside it would make the modal invisible.
  // Prefer the visible menuPanel only when it's actually displayed; otherwise fall back to document.body.
  let container;
  try {
    container = (menuPanel && getComputedStyle(menuPanel).display !== 'none' && document.getElementById('mainMenu')?.getAttribute('aria-hidden') === 'false')
      ? menuPanel
      : document.body;
  } catch (e) {
    container = document.body;
  }

  // create a contained modal element that lives inside the menu (not a full-screen overlay)
  const overlay = document.createElement('div');
  overlay.id = 'rebirthModal';
  overlay.style = 'display:flex;align-items:center;justify-content:center;position:relative;z-index:999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);color:var(--text);padding:16px;border-radius:12px;min-width:260px;max-width:100%;box-shadow:0 8px 20px rgba(0,0,0,0.08);border:1px solid rgba(0,0,0,0.04);margin-top:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong>Rebirth</strong><button id="closeRebirth" class="btn mini" type="button">✕</button>
      </div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:10px;">
        Rebirthing resets your complaints to 0 and grants a rebirth count recorded on the leaderboard.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;font-size:13px;color:var(--muted);">
        <div>Requirement: <strong>${MIN_COMPLAINTS.toLocaleString()} complaints</strong></div>
        <div class="meta">Your complaints: <strong id="rebirthCurrent">${complaints.toLocaleString()}</strong></div>
        <div class="meta">Total rebirths: <strong id="rebirthTotal">0</strong></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="confirmRebirth" class="btn mini" disabled>Rebirth</button>
        <button id="cancelRebirth" class="btn mini">Cancel</button>
      </div>
    </div>
  `;
  container.appendChild(overlay);

  const closeBtn = overlay.querySelector('#closeRebirth');
  const cancelBtn = overlay.querySelector('#cancelRebirth');
  const confirmBtn = overlay.querySelector('#confirmRebirth');
  const currentEl = overlay.querySelector('#rebirthCurrent');
  const totalEl = overlay.querySelector('#rebirthTotal');

  function refreshState(){
    currentEl.textContent = complaints.toLocaleString();
    const list = loadLeaderboard();
    const entry = currentUser ? list.find(l=>l.name===currentUser) : null;
    totalEl.textContent = (entry && entry.rebirths) ? entry.rebirths.toLocaleString() : '0';
    // ensure we compare numbers - sometimes complaints can be string in DOM; use numeric variable
    confirmBtn.disabled = (Number(complaints) < MIN_COMPLAINTS);
  }

  function close(){ overlay.remove(); }
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  // clicking outside the inner panel should close only if the click is on the overlay wrapper (safe since it's in-menu)
  overlay.addEventListener('click', (e)=> { if(e.target === overlay) close(); });

  const mo = new MutationObserver(refreshState);
  mo.observe(scoreEl, { childList: true, subtree: true, characterData: true });

  confirmBtn.addEventListener('click', () => {
    if(Number(complaints) < MIN_COMPLAINTS) return;
    ensureUser();
    const list = loadLeaderboard();
    let entry = list.find(l => l.name === currentUser);
    if(!entry){
      entry = { name: currentUser, complaints: 0, spent: 0, rebirths: 0 };
      list.push(entry);
    }
    entry.rebirths = (entry.rebirths || 0) + 1;
    complaints = 0;
    entry.complaints = 0;
    saveLeaderboard(list);
    scoreEl.textContent = '0';
    scoreWrap.setAttribute('aria-hidden','false');
    updateShopButtons();
    showMessage('Rebirth complete — leaderboard updated');
    mo.disconnect();
    close();
  });

  refreshState();
}

// Rebirth button: use the extracted function so it can be opened from multiple places
if(rebirthBtn){
  rebirthBtn.addEventListener('click', () => {
    openRebirthModal();
  });
}

function triggerPanic(){
  // create overlay container
  const overlay = document.createElement('div');
  overlay.className = 'panic';
  overlay.innerHTML = `<div class="panic-text">YOU HAVE ANNOYED THEM VERY MUCH</div><div id="panicScore" class="score">${complaints.toLocaleString()}</div>`;
  document.body.appendChild(overlay);
  // hide interactive controls
  document.querySelector('.center').style.visibility = 'hidden';
  // animate countdown back to 0 over ~4s
  const duration = 4000;
  const start = performance.now();
  const startVal = complaints;
  // If startVal reached the special TARGET, show the end message briefly then reset
  if(startVal >= TARGET){
    overlay.querySelector('#panicScore').textContent = 'the end. you make it loser';
    scoreEl.textContent = 'the end. you make it loser';
    setTimeout(() => {
      complaints = 0;
      scoreEl.textContent = '0';
      document.querySelector('.center').style.visibility = '';
      overlay.remove();
    }, 2000);
    return;
  }
  function frame(now){
    const t = Math.min(1, (now - start)/duration);
    const val = Math.round(startVal * (1 - t));
    overlay.querySelector('#panicScore').textContent = val.toLocaleString();
    if(t < 1){ requestAnimationFrame(frame); }
    else { // restore
      complaints = 0;
      scoreEl.textContent = '0';
      document.querySelector('.center').style.visibility = '';
      overlay.remove();
    }
  }
  requestAnimationFrame(frame);
}

// show an initial message after short delay
setTimeout(()=> showMessage("go on, click the button"), 700);

// create an in-page score editor modal
function showScoreEditor(){
  // prevent multiple editors
  if(document.getElementById('scoreEditor')) return;
  const overlay = document.createElement('div');
  overlay.id = 'scoreEditor';
  overlay.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.28);z-index:60;';
  overlay.innerHTML = `
    <div style="background:var(--bg);color:var(--text);padding:18px;border-radius:12px;min-width:280px;max-width:92%;box-shadow:0 10px 30px rgba(0,0,0,0.12);">
      <div style="font-weight:700;margin-bottom:8px;">Edit Complaints</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="scoreEditorInput" type="number" min="0" value="${complaints}" style="flex:1;padding:8px;border:1px solid #e7e7e7;border-radius:8px;font-size:16px;">
        <button id="scoreEditorSet" class="btn mini">Set</button>
        <button id="scoreEditorCancel" class="btn mini">Cancel</button>
      </div>
      <div id="scoreEditorNote" style="margin-top:8px;color:var(--muted);font-size:13px;">Enter a number (0 - 9007199254740991). Large values may trigger the panic screen.</div>
    </div>
  `;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#scoreEditorInput');
  const setBtn = overlay.querySelector('#scoreEditorSet');
  const cancelBtn = overlay.querySelector('#scoreEditorCancel');
  input.focus();
  function closeEditor(){ overlay.remove(); }
  cancelBtn.addEventListener('click', closeEditor);
  overlay.addEventListener('click', (e)=> { if(e.target === overlay) closeEditor(); });
  setBtn.addEventListener('click', ()=>{
    const v = Number(input.value);
    if(Number.isFinite(v) && v >= 0){
      complaints = Math.floor(v);
      scoreEl.textContent = complaints.toLocaleString();
      scoreWrap.setAttribute('aria-hidden','false');
      updateShopButtons();
      updateLeaderEntry();
      // trigger panic if infinite-ish (very large) or non-finite
      if(complaints >= TARGET) triggerPanic();
      closeEditor();
      showMessage('Complaints updated');
    } else {
      const note = overlay.querySelector('#scoreEditorNote');
      note.textContent = 'Invalid number — try again.';
      note.style.color = '#b00';
    }
  });
}

// Note: Top-left leaderboard button removed; leaderboard is available from main menu.

// Simplified main menu wiring: attach handlers immediately and ensure Play reliably hides the menu and focuses the game
(function wireMainMenu(){
  const mainMenu = document.getElementById('mainMenu');
  const menuPlay = document.getElementById('menuPlay');
  const menuSettings = document.getElementById('menuSettings');
  const menuDonate = document.getElementById('menuDonate');
  const menuInfo = document.getElementById('menuInfo');
  const menuUpdates = document.getElementById('menuUpdates');
  const menuMusic = document.getElementById('menuMusic');
  const returnMenuBtn = document.getElementById('returnMenu');

  // create audio instance for elevator music (looped)
  const musicAudio = new Audio('/Elevator Music.mp3');
  musicAudio.loop = true;
  let musicPlaying = false;

  // toggle music play/pause and update button state
  function toggleMusic(){
    if(!menuMusic) return;
    if(musicPlaying){
      musicAudio.pause();
      musicPlaying = false;
      menuMusic.setAttribute('aria-pressed','false');
      menuMusic.textContent = 'Music';
      showMessage('Music stopped');
    } else {
      // attempt to play (user gesture required in many browsers; clicking the menu satisfies that)
      musicAudio.play().then(()=>{
        musicPlaying = true;
        menuMusic.setAttribute('aria-pressed','true');
        menuMusic.textContent = 'Music';
        showMessage('Music playing');
      }).catch(()=> {
        showMessage('Unable to play music');
      });
    }
  }

  function openSettings(){
    if(document.getElementById('settingsModal')) return;
    const menuPanel = document.querySelector('#mainMenu .menu-panel');
    const container = menuPanel || document.body;
    const overlay = document.createElement('div');
    overlay.id = 'settingsModal';
    // if inserting into the menu panel, keep it compact and relative; otherwise fullscreen fallback
    if(menuPanel){
      overlay.style = 'position:relative;display:flex;align-items:center;justify-content:center;z-index:5;margin-top:8px;';
    } else {
      overlay.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.28);z-index:90;';
    }
    overlay.innerHTML = `<div style="background:var(--bg);color:var(--text);padding:16px;border-radius:12px;min-width:260px;max-width:92%;box-shadow:0 10px 30px rgba(0,0,0,0.12);"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>Settings</strong><button id="closeSettings" class="btn mini" type="button">✕</button></div><div style="color:var(--muted);font-size:14px;">No settings yet — coming soon.</div></div>`;
    container.appendChild(overlay);
    const closeBtn = overlay.querySelector('#closeSettings');
    function close(){ overlay.remove(); }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e)=> { if(e.target === overlay) close(); });
  }

  function openDonate(){
    if(document.getElementById('donateModal')) return;
    const menuPanel = document.querySelector('#mainMenu .menu-panel');
    const container = menuPanel || document.body;
    const overlay = document.createElement('div');
    overlay.id = 'donateModal';
    if(menuPanel){
      overlay.style = 'position:relative;display:flex;align-items:center;justify-content:center;z-index:5;margin-top:8px;';
    } else {
      overlay.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.28);z-index:92;';
    }
    overlay.innerHTML = `
      <div style="background:var(--bg);color:var(--text);padding:18px;border-radius:12px;min-width:300px;max-width:92%;box-shadow:0 10px 30px rgba(0,0,0,0.12);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong>Donate</strong><button id="closeDonate" class="btn mini" type="button">✕</button>
        </div>
        <div style="color:var(--muted);font-size:14px;margin-bottom:12px;">
          Support the project — any amount helps keep things running. You can also copy a link below.
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
          <input id="donateLink" readonly value="https://example.com/donate" style="flex:1;padding:8px;border:1px solid #e7e7e7;border-radius:8px;font-size:14px;">
          <button id="copyDonate" class="btn mini">Copy</button>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <a id="openDonateSite" href="https://example.com/donate" target="_blank" rel="noopener" class="btn mini">Open</a>
          <button id="dismissDonate" class="btn mini">Close</button>
        </div>
      </div>
    `;
    container.appendChild(overlay);
    const closeBtn = overlay.querySelector('#closeDonate');
    const dismissBtn = overlay.querySelector('#dismissDonate');
    const copyBtn = overlay.querySelector('#copyDonate');
    const input = overlay.querySelector('#donateLink');
    function close(){ overlay.remove(); }
    closeBtn.addEventListener('click', close);
    dismissBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e)=> { if(e.target === overlay) close(); });
    copyBtn.addEventListener('click', ()=>{
      try{
        navigator.clipboard.writeText(input.value);
        showMessage('Donate link copied');
      }catch(err){
        input.select();
        showMessage('Select and copy the link manually');
      }
    });
  }

  function openInfo(){
    if(document.getElementById('infoModal')) return;
    const menuPanel = document.querySelector('#mainMenu .menu-panel');
    const container = menuPanel || document.body;
    const overlay = document.createElement('div');
    overlay.id = 'infoModal';
    if(menuPanel){
      overlay.style = 'position:relative;display:flex;align-items:center;justify-content:center;z-index:5;margin-top:8px;';
    } else {
      overlay.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.28);z-index:93;';
    }
    overlay.innerHTML = `
      <div style="background:var(--bg);color:var(--text);padding:18px;border-radius:12px;min-width:320px;max-width:92%;box-shadow:0 10px 30px rgba(0,0,0,0.12);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong>Information</strong><button id="closeInfo" class="btn mini" type="button">✕</button>
        </div>
        <div style="color:var(--muted);font-size:14px;line-height:1.35;">
          Press This To Make People Complain is an interactive simulation by lazykittys that was developed to investigate the mechanics of automated response generation within user-initiated digital environments. The project centers on a single interactive element—a primary button—that, when activated, triggers the production of a structured complaint output. This mechanism allows users to directly observe how predefined system behaviors can be initiated through minimal input.

          <br><br>
          The simulation serves as a focused study on stimulus-response design, emphasizing how simple user actions can produce predictable and repeatable system outputs. By deliberately restricting the interface to a single point of interaction, the project isolates the relationship between user intent and automated reactions, making it possible to analyze system behavior without additional variables or external inputs.

          <br><br>
          Beyond its mechanical function, the project also examines broader concepts related to user engagement and behavioral patterns within digital interfaces. It highlights how even the most minimalistic interactions can generate meaningful feedback loops, offering insight into how users respond to and interact with reactive systems. Through this simplified environment, the simulation aims to provide a clearer understanding of how automated responses can be structured, deployed, and observed in controlled interactive contexts.
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
          <button id="dismissInfo" class="btn mini">Close</button>
        </div>
      </div>
    `;
    container.appendChild(overlay);
    const closeBtn = overlay.querySelector('#closeInfo');
    const dismissBtn = overlay.querySelector('#dismissInfo');
    function close(){ overlay.remove(); }
    closeBtn.addEventListener('click', close);
    dismissBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e)=> { if(e.target === overlay) close(); });
  }

  // Updates popup: only owner "lazykittys" can post; others see a wide warning when trying
  function openUpdates(){
    if(document.getElementById('updatesModal')) return;
    const menuPanel = document.querySelector('#mainMenu .menu-panel');
    const container = menuPanel || document.body;
    const overlay = document.createElement('div');
    overlay.id = 'updatesModal';
    // keep compact inside menu panel or fullscreen fallback
    if(menuPanel){
      overlay.style = 'position:relative;display:flex;align-items:center;justify-content:center;z-index:6;margin-top:8px;';
    } else {
      overlay.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.28);z-index:94;';
    }

    // read any saved update
    const saved = localStorage.getItem('game_updates') || '';

    overlay.innerHTML = `
      <div style="background:var(--bg);color:var(--text);padding:16px;border-radius:12px;min-width:300px;max-width:96%;box-shadow:0 10px 30px rgba(0,0,0,0.12);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong>Updates</strong><button id="closeUpdates" class="btn mini" type="button">✕</button>
        </div>
        <div id="updatesWarning" style="display:none;background:#fff9f0;border:1px solid #ffd8b0;padding:10px;border-radius:8px;margin-bottom:10px;color:#b35a00;font-weight:700;align-items:center;">
          ⚠️ You are not the owner of the game, only the owner can post updates.
        </div>
        <div style="margin-bottom:8px;color:var(--muted);font-size:13px;">Current update (read-only for non-owner):</div>
        <div id="currentUpdate" style="border:1px solid #eee;padding:10px;border-radius:8px;background:#fafafa;min-height:48px;margin-bottom:10px;white-space:pre-wrap;">${saved ? saved : 'No updates yet.'}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="updatesInput" type="text" placeholder="Enter update..." value="${saved ? saved.replace(/\"/g,'&quot;') : ''}" style="flex:1;padding:8px;border:1px solid #e7e7e7;border-radius:8px;font-size:14px;">
          <button id="postUpdate" class="btn mini">Post</button>
        </div>
      </div>
    `;
    container.appendChild(overlay);

    const closeBtn = overlay.querySelector('#closeUpdates');
    const postBtn = overlay.querySelector('#postUpdate');
    const input = overlay.querySelector('#updatesInput');
    const warning = overlay.querySelector('#updatesWarning');
    const currentEl = overlay.querySelector('#currentUpdate');

    function close(){ overlay.remove(); }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e)=> { if(e.target === overlay) close(); });

    // Posting logic: only username "lazykittys" allowed
    function tryPost(){
      // currentUser may be null; do not force prompt here
      if(currentUser !== 'lazykittys'){
        // show long wide warning banner
        warning.style.display = 'flex';
        // ensure post is blocked and visually communicate
        showMessage('Only the owner can post updates');
        return;
      }
      // owner flow: save update and reflect it
      const text = (input.value || '').trim();
      localStorage.setItem('game_updates', text);
      currentEl.textContent = text || 'No updates yet.';
      showMessage('Update posted');
    }

    postBtn.addEventListener('click', tryPost);
    input.addEventListener('keydown', (e)=> { if(e.key === 'Enter') { e.preventDefault(); tryPost(); } });

    // If current user is not owner, make the input editable but posting forbidden (warning shown when try)
    if(currentUser !== 'lazykittys'){
      // preemptively hide warning until they try to post
      warning.style.display = 'none';
    } else {
      // owner: ensure warning hidden
      warning.style.display = 'none';
    }
  }

  function playGame(){
    if(mainMenu) mainMenu.setAttribute('aria-hidden','true');
    // reveal in-game return button (it's a sibling element); mark aria-hidden false for clarity
    if(returnMenuBtn) { returnMenuBtn.setAttribute('aria-hidden','false'); }
    scoreWrap.setAttribute('aria-hidden','false');
    // ensure the primary click button is focusable and focused for immediate play
    if(btn && typeof btn.focus === 'function') { btn.focus({ preventScroll: true }); }
    showMessage('Have fun annoying people!');
  }

  // attach listeners unconditionally to avoid timing issues
  if(menuPlay){
    menuPlay.addEventListener('click', playGame);
    menuPlay.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playGame(); } });
  }
  if(menuSettings){
    menuSettings.addEventListener('click', openSettings);
    menuSettings.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSettings(); } });
  }
  // Donate button wiring
  if(menuDonate){
    menuDonate.addEventListener('click', openDonate);
    menuDonate.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDonate(); } });
  }
  // Info button wiring
  if(menuInfo){
    menuInfo.addEventListener('click', openInfo);
    menuInfo.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInfo(); } });
  }

  // Music button wiring (bottom-left)
  if(menuMusic){
    menuMusic.addEventListener('click', (e)=> { e.preventDefault(); toggleMusic(); });
    menuMusic.addEventListener('keydown', (e)=> { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMusic(); } });
  }

  // Rebirth button on main menu
  const menuRebirth = document.getElementById('menuRebirth');
  if(menuRebirth){
    menuRebirth.addEventListener('click', () => {
      // open the same rebirth modal used in-game
      openRebirthModal();
    });
    menuRebirth.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRebirthModal(); } });
  }

  // Return-to-menu button wiring (visible while playing)
  if(returnMenuBtn){
    returnMenuBtn.addEventListener('click', () => {
      if(mainMenu) mainMenu.setAttribute('aria-hidden','false');
      // hide the return button again
      returnMenuBtn.setAttribute('aria-hidden','true');
      // move focus into the menu for keyboard users
      const focusTarget = document.getElementById('menuPlay') || document.getElementById('menuInfo');
      if(focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus({ preventScroll: true });
      showMessage('Returned to menu');
    });
    returnMenuBtn.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); returnMenuBtn.click(); } });
  }

  // make sure the menu buttons are keyboard/touch friendly
  [menuPlay, menuSettings].forEach(el=>{
    if(!el) return;
    el.setAttribute('role','button');
    el.setAttribute('tabindex','0');
    el.style.touchAction = 'manipulation';
  });
})();
