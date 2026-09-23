import { PLACES, STATION, UNITS, RANKS, AVATARS, MODES, SCENES, QUESTIONS } from "./content.js";

// ---------------------------------------------------------------- helpers
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const pad = (n) => String(n).padStart(2, "0");
const timeNow = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
/** "ל" + a definite place name: "החניון המרכזי" -> "לחניון המרכזי", "שכונת הגפן" -> "לשכונת הגפן". */
const toPlace = (name) => "ל" + (name.startsWith("ה") ? name.slice(1) : name);
const PRIORITY_NAMES = ["", "דחוף", "בינוני", "רגיל"];
const RUSH_SECONDS = 90;

// ---------------------------------------------------------------- persistence
const tauri = window.__TAURI__?.core;
const DEFAULT_PROFILE = { avatar: null, mode: "regular", points: 0, stars: 0, calls: 0, history: [] };
let profile = { ...DEFAULT_PROFILE };

async function loadProfile() {
  try {
    const raw = tauri ? await tauri.invoke("load_progress") : localStorage.getItem("moked100") || "{}";
    profile = { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch (e) { console.warn("load failed", e); }
}
async function saveProfile() {
  const data = JSON.stringify(profile);
  try {
    if (tauri) await tauri.invoke("save_progress", { data });
    else localStorage.setItem("moked100", data);
  } catch (e) { console.warn("save failed", e); }
}

const avatar = () => AVATARS.find((a) => a.id === profile.avatar) || AVATARS[0];
const gender = () => avatar().gender;
const mode = () => MODES.find((m) => m.id === profile.mode) || MODES[0];
const inMode = (id) => mode().id === id;

function rankFor(points) {
  let r = RANKS[0];
  for (const x of RANKS) if (points >= x.min) r = x;
  return r;
}
function rankIndex(points) { return RANKS.indexOf(rankFor(points)); }
const rankName = (r) => (gender() === "f" && r.f ? r.f : r.name);

// ---------------------------------------------------------------- audio
let LINES = {};
let muted = false;
const voice = new Audio();
const fx = new Audio();
let voiceToken = 0;

function sfx(name, loop = false) {
  if (muted) return;
  fx.src = `assets/audio/sfx_${name}.mp3`;
  fx.loop = loop;
  fx.currentTime = 0;
  fx.play().catch(() => {});
}
function stopSfx() { fx.pause(); fx.loop = false; }

function showSubtitle(text) {
  const el = $("subtitle");
  if (!text) { el.hidden = true; return; }
  el.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = text;
  el.appendChild(span);
  el.hidden = false;
}

/** Uses the feminine recording of a line when the chosen officer is a woman. */
function lineId(id) { return gender() === "f" && LINES[id + "_f"] ? id + "_f" : id; }

/** Speaks one narration line; resolves when it ends (or right away when muted).
 *  A guard timer resolves anyway if the file stalls, so a bad audio file can never freeze the game. */
function say(id) {
  id = lineId(id);
  const token = ++voiceToken;
  showSubtitle(LINES[id] || "");
  return new Promise((resolve) => {
    if (muted) { setTimeout(() => { if (token === voiceToken) showSubtitle(""); resolve(); }, 900); return; }
    let guard = setTimeout(() => done(), 20000);
    const done = () => {
      clearTimeout(guard);
      if (token !== voiceToken) return;   // a newer line took over: this one is void
      showSubtitle("");
      resolve();
    };
    voice.src = `assets/audio/${id}.mp3`;
    voice.onended = done;
    voice.onerror = done;
    voice.onloadedmetadata = () => {
      if (token !== voiceToken || !isFinite(voice.duration)) return;
      clearTimeout(guard);
      guard = setTimeout(done, voice.duration * 1000 + 2500);
    };
    voice.play().catch(done);
  });
}
function stopVoice() { voiceToken++; voice.pause(); showSubtitle(""); }
const speaking = () => !voice.paused && !voice.ended;

// ---------------------------------------------------------------- event log
function log(text, cls = "") {
  const li = document.createElement("li");
  if (cls) li.className = cls;
  const t = document.createElement("time");
  t.textContent = timeNow();
  li.append(t, document.createTextNode(text));
  const ul = $("event-log");
  ul.prepend(li);
  while (ul.children.length > 40) ul.lastChild.remove();
}

// ---------------------------------------------------------------- map
const SVG = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, text) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

function buildMap() {
  const map = $("map");
  map.innerHTML = "";
  // ground
  map.append(el("rect", { x: 0, y: 0, width: 960, height: 560, fill: "#0a1322" }));
  // river + green areas
  map.append(el("path", { d: "M 900 0 C 880 120, 930 200, 900 300 S 940 480, 905 560 L 960 560 L 960 0 Z", class: "map-water" }));
  map.append(el("rect", { x: 700, y: 250, width: 170, height: 150, rx: 24, class: "map-green" }));
  map.append(el("rect", { x: 220, y: 420, width: 160, height: 100, rx: 24, class: "map-green" }));
  // blocks
  const blocks = [
    [40, 40, 200, 150], [40, 240, 200, 150], [300, 40, 150, 130], [500, 40, 170, 130], [300, 230, 300, 150],
    [660, 40, 190, 150], [480, 420, 100, 100], [40, 420, 150, 100], [640, 440, 220, 100],
  ];
  for (const [x, y, w, h] of blocks) map.append(el("rect", { x, y, width: w, height: h, rx: 8, class: "map-block" }));
  // roads
  const roads = [
    ["M 0 210 H 960", "map-road-main"], ["M 0 405 H 960", "map-road-main"],
    ["M 270 0 V 560", "map-road-main"], ["M 620 0 V 560", "map-road-side"], ["M 470 0 V 560", "map-road-side"],
    ["M 0 30 H 960", "map-road-side"], ["M 800 0 V 560", "map-road-side"],
  ];
  for (const [d, cls] of roads) map.append(el("path", { d, class: `map-road ${cls}` }));
  for (const d of ["M 0 210 H 960", "M 0 405 H 960", "M 270 0 V 560"]) map.append(el("path", { d, class: "map-road-dash" }));
  // station
  const st = el("g", { transform: `translate(${STATION.x} ${STATION.y})` });
  st.append(el("rect", { x: -34, y: -30, width: 68, height: 60, rx: 10, fill: "#132b57", stroke: "#3b82f6", "stroke-width": 2 }));
  st.append(el("text", { class: "station-icon", y: -2 }, STATION.icon));
  st.append(el("text", { class: "station-label", y: 46 }, STATION.name));
  map.append(st);
  // places
  for (const p of Object.values(PLACES)) {
    const g = el("g", { class: "place", transform: `translate(${p.x} ${p.y})`, "data-id": p.id });
    g.append(el("circle", { class: "place-ring", r: 44 }));
    g.append(el("text", { class: "place-icon", y: 1 }, p.icon));
    g.append(el("text", { class: "place-label", y: 70 }, p.name));
    g.append(el("text", { class: "place-sub", y: 90 }, p.sub));
    g.addEventListener("click", () => onPlaceClick(p.id));
    g.addEventListener("pointerenter", () => onPlaceHover(p.id));
    map.append(g);
  }
  map.append(el("g", { id: "map-overlay" }));
}

function placeNode(id) { return $("map").querySelector(`.place[data-id="${id}"]`); }
function clearMapMarks() {
  for (const n of $("map").querySelectorAll(".place")) n.classList.remove("hint", "target", "wrong", "disabled");
  $("map-overlay").innerHTML = "";
  $("map-hint").textContent = "";
}

function markIncident(placeId) {
  const p = PLACES[placeId];
  placeNode(placeId).classList.add("target");
  $("map-overlay").append(el("circle", { class: "incident-pulse", cx: p.x, cy: p.y, r: 30 }));
}

/** Moves the unit icon from the station to the place; resolves on arrival. */
function animateDispatch(unit, placeId, ms = 4000) {
  const p = PLACES[placeId];
  const ov = $("map-overlay");
  ov.append(el("path", { class: "route", d: `M ${STATION.x} ${STATION.y} L ${p.x} ${p.y}` }));
  const m = el("text", { class: "unit-marker", x: STATION.x, y: STATION.y }, unit.icon);
  ov.append(m);
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < .5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
      m.setAttribute("x", STATION.x + (p.x - STATION.x) * e);
      m.setAttribute("y", STATION.y + (p.y - STATION.y) * e);
      $("dispatch-progress").style.width = `${k * 100}%`;
      if (k < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

// ---------------------------------------------------------------- UI bits
function showStep(id) {
  for (const s of document.querySelectorAll(".step")) s.hidden = true;
  $(id).hidden = false;
  $("step-idle").parentElement.scrollTop = 0;
}

function refreshHeader() {
  const rank = rankName(rankFor(profile.points));
  $("officer-avatar").textContent = avatar().icon;
  $("officer-rank").textContent = rank;
  $("officer-points").textContent = profile.points;
  $("officer-stars").textContent = profile.stars;
  $("stat-calls").textContent = profile.calls;
  $("stat-stars").textContent = profile.stars;
  $("stat-rank").textContent = rank;
  $("stat-mode").textContent = mode().name;
}

function renderUnitStatus(busyId = null) {
  const ul = $("unit-status");
  ul.innerHTML = "";
  for (const u of Object.values(UNITS)) {
    const li = document.createElement("li");
    if (u.id === busyId) li.classList.add("busy");
    li.innerHTML = `<span class="dot"></span><span>${u.icon} ${u.name}</span><span class="code">${u.code}</span>`;
    ul.append(li);
  }
}

// ---------------------------------------------------------------- game state
const game = {
  scene: null,
  incident: 0,
  score: {},
  placeTries: 0,
  unitTries: 0,
  queueTries: 0,
  answerTime: 0,
  ringStart: 0,
  hintTimer: null,
  busy: false,
  queue: [],       // simultaneous calls waiting (multi mode)
  timer: null,     // countdown interval (rush mode)
  timeLeft: 0,
  timedOut: false,
};

const scenePool = () => (inMode("night") ? SCENES.filter((s) => s.night) : SCENES);

function pickScene(exclude = []) {
  const recent = profile.history.slice(-4);
  const all = scenePool();
  let pool = all.filter((s) => !recent.includes(s.id) && !exclude.includes(s.id));
  if (!pool.length) pool = all.filter((s) => !exclude.includes(s.id));
  return shuffle(pool.length ? pool : all)[0];
}

/** Three calls at once, one of each priority when possible, so exactly one is the most urgent. */
function pickBatch() {
  const recent = profile.history.slice(-4);
  const pool = scenePool().filter((s) => !recent.includes(s.id));
  const batch = [];
  for (const p of [1, 2, 3]) {
    const s = shuffle(pool.filter((x) => x.priority === p))[0];
    if (s) batch.push(s);
  }
  while (batch.length < 3) {
    const s = pickScene(batch.map((x) => x.id));
    if (!s || batch.includes(s)) break;
    batch.push(s);
  }
  return shuffle(batch);
}

// ---------------------------------------------------------------- flow
async function startShift() {
  $("screen-login").hidden = true;
  $("screen-main").hidden = false;
  document.body.dataset.mode = mode().id;
  $("shift-status").textContent = mode().name;
  game.queue = [];
  refreshHeader();
  renderUnitStatus();
  log(`המשמרת התחילה. עמדה 04 פעילה. מצב: ${mode().name}`, "hi");
  await say("cmd_intro");
  if (LINES["intro_" + mode().id]) { await wait(300); await say("intro_" + mode().id); }
  await wait(600);
  nextCall();
}

async function nextCall() {
  clearMapMarks();
  stopTimer();
  game.incident += 1;
  game.score = {};
  game.placeTries = 0;
  game.unitTries = 0;
  game.queueTries = 0;
  game.timeLeft = 0;
  game.timedOut = false;
  const d = new Date();
  $("incident-id").textContent = `#${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(profile.calls + 1)}`;
  showStep("step-idle");
  await wait(1500 + Math.random() * 1500);
  if (inMode("multi")) {
    if (game.queue.length === 0) game.queue = pickBatch();
    if (game.queue.length >= 2) { showQueue(); return; }
    game.scene = game.queue.shift();
  } else {
    game.scene = pickScene();
  }
  ringPhone();
}

function ringPhone() {
  showStep("step-ring");
  sfx("ring", true);
  game.ringStart = performance.now();
  log("קריאה נכנסת בקו 3", "hi");
  say("ring");
}

function showQueue() {
  const list = $("queue-list");
  list.innerHTML = "";
  $("queue-feedback").textContent = "";
  for (const s of game.queue) {
    const card = document.createElement("div");
    card.className = "queue-card";
    card.innerHTML = `<div class="queue-icon">${s.callerIcon}</div>
      <div class="queue-body"><div class="queue-name">${s.callerName}</div><div class="queue-code">${s.code}</div></div>
      <span class="priority-badge priority-${s.priority}">${PRIORITY_NAMES[s.priority]}</span>`;
    card.addEventListener("click", () => onQueueClick(s, card));
    list.append(card);
  }
  showStep("step-queue");
  sfx("ring", true);
  game.ringStart = performance.now();
  log(`${game.queue.length} קריאות נכנסו בבת אחת`, "hi");
  say("queue_intro");
}

async function onQueueClick(scene, card) {
  if (game.busy) return;
  game.queueTries += 1;
  sfx("click");
  const top = Math.min(...game.queue.map((s) => s.priority));
  if (scene.priority !== top) {
    card.classList.add("wrong");
    setTimeout(() => card.classList.remove("wrong"), 500);
    const fb = $("queue-feedback");
    fb.className = "feedback bad";
    fb.textContent = "יש קריאה דחופה יותר על הקו";
    sfx("wrong");
    say("queue_wrong");
    return;
  }
  game.busy = true;
  stopSfx();
  card.classList.add("chosen");
  game.score.priority = game.queueTries === 1 ? 10 : game.queueTries === 2 ? 5 : 0;
  game.queue = game.queue.filter((s) => s !== scene);
  game.scene = scene;
  log(`הקריאה הדחופה נבחרה: ${scene.code}`, game.score.priority ? "ok" : "");
  sfx("correct");
  await say("queue_ok");
  game.busy = false;
  answerCall();
}

async function answerCall() {
  stopSfx();
  game.answerTime = (performance.now() - game.ringStart) / 1000;
  game.score.speed = inMode("training") ? 10 : game.answerTime <= 6 ? 10 : game.answerTime <= 15 ? 5 : 0;
  const s = game.scene;
  $("caller-icon").textContent = s.callerIcon;
  $("caller-name").textContent = s.callerName;
  $("caller-text").textContent = LINES["call_" + s.id] || "";
  const pb = $("priority-badge");
  pb.className = `priority-badge priority-${s.priority}`;
  pb.textContent = PRIORITY_NAMES[s.priority];
  showStep("step-call");
  log(`השיחה נענתה תוך ${game.answerTime.toFixed(1)} שניות`, game.score.speed ? "ok" : "");
  if (inMode("rush")) startTimer();
  await say("greeting");
  await say("call_" + s.id);
}

// rush mode countdown
function startTimer() {
  const el = $("timer");
  el.hidden = false;
  el.classList.remove("low");
  game.timedOut = false;
  const t0 = performance.now();
  clearInterval(game.timer);
  let lastSec = -1;
  const tick = () => {
    game.timeLeft = Math.max(0, RUSH_SECONDS - (performance.now() - t0) / 1000);
    const sec = Math.ceil(game.timeLeft);
    el.textContent = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
    if (game.timeLeft <= 15) {
      el.classList.add("low");
      if (sec !== lastSec && sec > 0 && !speaking()) sfx("tick");
    }
    lastSec = sec;
    if (game.timeLeft <= 0) {
      clearInterval(game.timer);
      game.timer = null;
      game.timedOut = true;
      log("הזמן נגמר, בלי בונוס זמן", "bad");
      say("time_up");
    }
  };
  tick();
  game.timer = setInterval(tick, 250);
}
function stopTimer() {
  clearInterval(game.timer);
  game.timer = null;
  $("timer").hidden = true;
}

async function watchCamera() {
  const s = game.scene;
  const v = $("cctv");
  const place = PLACES[s.place];
  $("cam-label").textContent = `CAM ${pad(Object.keys(PLACES).indexOf(s.place) + 1)}`;
  $("video-title").textContent = `${s.code} · ${place.name}`;
  v.src = `assets/video/${s.id}.mp4`;
  v.poster = `assets/video/${s.id}.jpg`;
  v.loop = true;
  v.muted = true;
  showStep("step-video");
  log(`מצלמת אבטחה נפתחה: ${place.name}`);
  v.play().catch(() => {});
  await say("watch");
}

async function askPlace() {
  $("cctv").pause();
  showStep("step-place");
  $("place-feedback").textContent = "";
  $("map-hint").textContent = "← לחצו על מקום האירוע";
  await say("pick_place");
  clearTimeout(game.hintTimer);
  game.hintTimer = setTimeout(() => {
    if (!$("step-place").hidden) { placeNode(game.scene.place).classList.add("hint"); say("hint_place"); }
  }, inMode("training") ? 6000 : 12000);
}

/** Reads the place name aloud on hover, for children who cannot read yet. */
function onPlaceHover(placeId) {
  if ($("step-place").hidden || game.busy || speaking()) return;
  say("place_" + placeId);
}

async function onPlaceClick(placeId) {
  if ($("step-place").hidden || game.busy) return;
  game.placeTries += 1;
  sfx("click");
  if (placeId === game.scene.place) {
    clearTimeout(game.hintTimer);
    game.score.place = game.placeTries === 1 ? 30 : game.placeTries === 2 ? 15 : 5;
    game.busy = true;
    clearMapMarks();
    markIncident(placeId);
    const fb = $("place-feedback");
    fb.className = "feedback ok";
    fb.textContent = `קיבלתי: ${PLACES[placeId].name}`;
    log(`מקום האירוע סומן: ${PLACES[placeId].name}`, "ok");
    sfx("correct");
    await say("correct");
    game.busy = false;
    askUnit();
  } else {
    const n = placeNode(placeId);
    n.classList.add("wrong");
    setTimeout(() => n.classList.remove("wrong"), 700);
    const fb = $("place-feedback");
    fb.className = "feedback bad";
    fb.textContent = "שלילי, זה לא מקום האירוע";
    sfx("wrong");
    say("wrong_place");
    if (game.placeTries >= (inMode("training") ? 1 : 2)) placeNode(game.scene.place).classList.add("hint");
  }
}

function askUnit() {
  const list = $("unit-list");
  list.innerHTML = "";
  $("unit-feedback").textContent = "";
  for (const u of Object.values(UNITS)) {
    const card = document.createElement("div");
    card.className = "unit-card";
    card.dataset.id = u.id;
    card.innerHTML = `<button class="speak" title="הקראה">🔊</button><div class="icon">${u.icon}</div><div class="name">${u.name}</div><div class="code">${u.code}</div><div class="desc">${u.desc}</div>`;
    card.querySelector(".speak").addEventListener("click", (e) => { e.stopPropagation(); say("unit_" + u.id); });
    card.addEventListener("click", () => onUnitClick(u.id, card));
    list.append(card);
  }
  showStep("step-unit");
  say("pick_unit");
}

async function onUnitClick(unitId, card) {
  if (game.busy) return;
  game.unitTries += 1;
  sfx("click");
  const s = game.scene;
  const best = unitId === s.unit;
  const ok = s.okUnits.includes(unitId);
  if (!best && !ok && game.unitTries < 3) {
    card.classList.add("wrong");
    setTimeout(() => card.classList.remove("wrong"), 500);
    const fb = $("unit-feedback");
    fb.className = "feedback bad";
    fb.textContent = `${UNITS[unitId].name} לא מתאים לאירוע הזה`;
    sfx("wrong");
    say("wrong_unit");
    if (inMode("training") || game.unitTries >= 2) $("unit-list").querySelector(`[data-id="${s.unit}"]`).classList.add("hint");
    return;
  }
  game.busy = true;
  card.classList.add("chosen");
  game.score.unit = best ? 30 : ok ? 20 : 10;
  if (game.unitTries > 1) game.score.unit = Math.max(5, game.score.unit - 10 * (game.unitTries - 1));
  const unit = UNITS[unitId];
  log(`${unit.code} (${unit.name}) נשלח ${toPlace(PLACES[s.place].name)}`, best ? "ok" : "");
  renderUnitStatus(unitId);
  await dispatch(unit);
}

async function dispatch(unit) {
  showStep("step-dispatch");
  $("dispatch-text").textContent = `${unit.code} בדרך ${toPlace(PLACES[game.scene.place].name)}...`;
  $("dispatch-progress").style.width = "0%";
  sfx("siren");
  say("dispatched");
  await animateDispatch(unit, game.scene.place, 4500);
  stopSfx();
  sfx("radio");
  log(`${unit.code} הגיע לאירוע`, "ok");
  await say("arrived");
  game.busy = false;
  startReport();
}

// ---------------------------------------------------------------- report
let reportIdx = 0;
let reportTries = 0;
function startReport() {
  reportIdx = 0;
  game.score.report = 0;
  showStep("step-report");
  askQuestion();
}

function askQuestion() {
  const q = QUESTIONS[reportIdx];
  const s = game.scene;
  reportTries = 0;
  $("report-progress").textContent = `שאלה ${reportIdx + 1} מתוך ${QUESTIONS.length}`;
  $("report-question").textContent = q.label;
  const others = shuffle(SCENES.filter((x) => x.id !== s.id && x[q.key].text !== s[q.key].text)).slice(0, inMode("training") ? 2 : 3);
  const options = shuffle([{ scene: s, correct: true }, ...others.map((o) => ({ scene: o, correct: false }))]);
  const box = $("report-options");
  box.innerHTML = "";
  for (const o of options) {
    const a = o.scene[q.key];
    const div = document.createElement("div");
    div.className = "option";
    div.innerHTML = `<span class="icon">${a.icon}</span><span>${a.text}</span><button class="speak" title="הקראה">🔊</button>`;
    div.querySelector(".speak").addEventListener("click", (e) => { e.stopPropagation(); say(`opt_${o.scene.id}_${q.key}`); });
    div.addEventListener("click", () => onAnswer(o.correct, div));
    box.append(div);
  }
  say(q.line);
}

async function onAnswer(correct, div) {
  if (game.busy) return;
  reportTries += 1;
  sfx("click");
  if (!correct) {
    div.classList.add("wrong");
    setTimeout(() => div.classList.remove("wrong"), 500);
    sfx("wrong");
    say("wrong");
    return;
  }
  game.busy = true;
  div.classList.add("right");
  game.score.report += reportTries === 1 ? 10 : reportTries === 2 ? 5 : 2;
  sfx("correct");
  await say("correct");
  game.busy = false;
  reportIdx += 1;
  if (reportIdx < QUESTIONS.length) askQuestion();
  else finishIncident();
}

async function finishIncident() {
  const s = game.scene;
  stopTimer();
  showStep("step-done");
  $("done-text").textContent = LINES["done_" + s.id] || "";
  log(`אירוע ${s.code} נסגר`, "ok");
  renderUnitStatus();
  sfx("radio");
  await wait(400);
  await say("done_" + s.id);
  await say("report_done");
}

// ---------------------------------------------------------------- commander
async function commanderReview() {
  const sc = game.score;
  const rows = [
    ["מהירות מענה לשיחה", sc.speed || 0, 10],
    ["סימון מקום האירוע", sc.place || 0, 30],
    ["בחירת הכוח המתאים", sc.unit || 0, 30],
    ["דוח אירוע", sc.report || 0, 30],
  ];
  if (inMode("multi")) rows.push(["סדר עדיפויות", sc.priority || 0, 10]);
  if (inMode("rush")) {
    sc.time = game.timedOut ? 0 : Math.min(15, Math.ceil(game.timeLeft / 6));
    rows.push(["בונוס זמן", sc.time, 15]);
  }
  if (inMode("night")) rows.push(["בונוס משמרת לילה", 10, 10]);
  const total = rows.reduce((a, r) => a + r[1], 0);
  const max = rows.reduce((a, r) => a + r[2], 0);
  const pct = (total / max) * 100;
  const stars = pct >= 85 ? 3 : pct >= 60 ? 2 : 1;
  const before = rankIndex(profile.points);
  profile.points += total;
  profile.stars += stars;
  profile.calls += 1;
  profile.history.push(game.scene.id);
  if (profile.history.length > 20) profile.history.shift();
  const after = rankIndex(profile.points);
  await saveProfile();

  $("score-rows").innerHTML = rows.map(([k, v, m]) => `<tr><td>${k}</td><td dir="ltr">${v} / ${m}</td></tr>`).join("");
  $("score-total").textContent = `${total} / ${max}`;
  const starsEl = $("commander-stars");
  starsEl.innerHTML = "";
  $("commander-text").textContent = LINES[lineId("cmd_" + stars)] || "";
  const ru = $("rankup");
  ru.hidden = after <= before;
  if (after > before) ru.textContent = `קידום בדרגה: ${rankName(RANKS[after])}`;
  $("modal-commander").hidden = false;
  sfx("fanfare");
  for (let i = 0; i < 3; i++) {
    await wait(450);
    const sp = document.createElement("span");
    sp.className = i < stars ? "on" : "off";
    sp.textContent = "★";
    starsEl.append(sp);
    if (i < stars) sfx("star");
  }
  refreshHeader();
  log(`המפקד אישר את הדוח: ${stars} כוכבים, ${total} נקודות`, "hi");
  await say("cmd_" + stars);
  if (after > before) {
    log(`קידום בדרגה: ${rankName(RANKS[after])}`, "hi");
    await say("cmd_rankup");
    await say("rank_" + after);
  }
}

// ---------------------------------------------------------------- login
function buildLogin() {
  const list = $("avatar-list");
  list.innerHTML = "";
  for (const a of AVATARS) {
    const card = document.createElement("div");
    card.className = "avatar-card" + (profile.avatar === a.id ? " selected" : "");
    card.innerHTML = `<div class="icon">${a.icon}</div><div class="name">${a.name}</div>`;
    card.addEventListener("click", () => {
      profile.avatar = a.id;
      for (const c of list.children) c.classList.remove("selected");
      card.classList.add("selected");
      $("btn-start").disabled = false;
      renderLoginStats();
      sfx("click");
    });
    list.append(card);
  }
  const modes = $("mode-list");
  modes.innerHTML = "";
  for (const m of MODES) {
    const card = document.createElement("div");
    card.className = "mode-card" + (mode().id === m.id ? " selected" : "");
    card.innerHTML = `<div class="icon">${m.icon}</div><div class="name">${m.name}</div><div class="desc">${m.desc}</div>`;
    card.addEventListener("click", () => {
      profile.mode = m.id;
      for (const c of modes.children) c.classList.remove("selected");
      card.classList.add("selected");
      sfx("click");
    });
    modes.append(card);
  }
  $("btn-start").disabled = !profile.avatar;
  renderLoginStats();
}

function renderLoginStats() {
  $("login-stats").textContent = profile.calls
    ? `דרגה: ${rankName(rankFor(profile.points))} · ${profile.points} נקודות · ${profile.stars} כוכבים · ${profile.calls} אירועים`
    : "עוד אין אירועים בתיק. המשמרת הראשונה מחכה.";
}

// ---------------------------------------------------------------- init
async function init() {
  try { LINES = await (await fetch("data/lines.json")).json(); } catch (e) { console.warn("lines", e); }
  await loadProfile();
  buildLogin();
  buildMap();
  setInterval(() => { $("clock").textContent = timeNow(); }, 500);
  $("clock").textContent = timeNow();

  $("btn-start").addEventListener("click", () => { sfx("click"); startShift(); });
  $("btn-answer").addEventListener("click", answerCall);
  $("btn-watch").addEventListener("click", () => { sfx("click"); watchCamera(); });
  $("btn-after-video").addEventListener("click", () => { sfx("click"); askPlace(); });
  $("btn-commander").addEventListener("click", () => { sfx("click"); commanderReview(); });
  $("btn-next").addEventListener("click", () => { stopVoice(); $("modal-commander").hidden = true; sfx("click"); nextCall(); });
  $("btn-mute").addEventListener("click", () => {
    muted = !muted;
    $("btn-mute").textContent = muted ? "🔇" : "🔊";
    if (muted) { stopVoice(); stopSfx(); }
  });
  $("btn-logout").addEventListener("click", async () => {
    stopVoice(); stopSfx(); stopTimer(); clearTimeout(game.hintTimer);
    $("cctv").pause();
    game.queue = [];
    await saveProfile();
    delete document.body.dataset.mode;
    $("screen-main").hidden = true;
    $("screen-login").hidden = false;
    buildLogin();
  });
  // welcome line when the login screen is first shown (needs a user gesture in browsers; fine in Tauri)
  document.body.addEventListener("pointerdown", () => { if (!$("screen-login").hidden && !voice.src) say("welcome"); }, { once: true });
}

init();
