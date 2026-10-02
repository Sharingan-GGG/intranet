/*
 * celebrate.js — confetti + fireworks + congrats card. No dependencies.
 * Usage:
 *   <script src="celebrate.js"></script>
 *   button.addEventListener('click', e => celebrate({
 *     origin: e.currentTarget, name: 'Anjelica', title: 'Singapore Airlines Lounge Review',
 *     findings: 29, progress: '1 of 11 pages completed'
 *   }));
 * Options: duration (ms, 5000), intensity ('subtle'|'festive'|'epic'), backdrop (true), card (true)
 */
(function () {
  const COLORS = ['#4F46E5','#818CF8','#F59E0B','#FBBF24','#EC4899','#10B981','#38BDF8','#F97316','#FDE68A'];
  const FONT = "'IBM Plex Sans',system-ui,sans-serif";
  let cv, ctx, parts = [], running = false, endAt = 0, timers = [], bg, card;

  function injectStyles() {
    if (document.getElementById('ctg-celebrate-css')) return;
    const s = document.createElement('style'); s.id = 'ctg-celebrate-css';
    s.textContent = `@keyframes ctgPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
@keyframes ctgDraw{to{stroke-dashoffset:0}}
@keyframes ctgRing{0%{transform:scale(.8);opacity:.6}100%{transform:scale(1.9);opacity:0}}`;
    document.head.appendChild(s);
  }
  function ensureCanvas() {
    if (!cv) {
      cv = document.createElement('canvas');
      cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646';
      document.body.appendChild(cv); ctx = cv.getContext('2d');
      addEventListener('resize', resize);
    }
    resize();
  }
  function resize() { const d = devicePixelRatio || 1; cv.width = innerWidth*d; cv.height = innerHeight*d; ctx.setTransform(d,0,0,d,0,0); }
  const pick = () => COLORS[(Math.random()*COLORS.length)|0];

  function spawn(x, y, n, angle, spread, speed) {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random()-.5)*spread, v = speed*(.5+Math.random()*.7), sh = Math.random();
      parts.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, w: 6+Math.random()*7, h: 4+Math.random()*5,
        kind: sh < .55 ? 'rect' : sh < .8 ? 'circle' : 'ribbon', color: pick(),
        rot: Math.random()*6.28, vr: (Math.random()-.5)*.3, tilt: Math.random()*6.28, vt: .05+Math.random()*.12,
        drag: .985 - Math.random()*.01, g: .16+Math.random()*.08 });
    }
  }
  function launch(k) {
    const W = innerWidth, H = innerHeight, x = W*(.12+Math.random()*.76), ty = H*(.12+Math.random()*.3);
    parts.push({ kind:'rocket', x, y:H+10, vx:(Math.random()-.5)*1.2, vy:-Math.sqrt(2*.12*(H-ty)), g:.12, drag:1, trail:[], color:pick(), burst:60+(k*30|0) });
  }
  function explode(p) {
    const c2 = pick(), ring = Math.random() < .35;
    for (let i = 0; i < p.burst; i++) {
      const a = (i/p.burst)*6.283 + Math.random()*.1, v = ring ? 4.2 : 1+Math.random()*4.2;
      parts.push({ kind:'spark', x:p.x, y:p.y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, g:.05, drag:.965, color: i%3 ? p.color : c2, life:1, decay:.012+Math.random()*.012, trail:[] });
    }
    parts.push({ kind:'flash', x:p.x, y:p.y, life:1, decay:.08 });
  }
  function loop() {
    const W = innerWidth, H = innerHeight, now = performance.now();
    ctx.clearRect(0,0,W,H);
    const fade = Math.max(0, Math.min(1, (endAt-now)/1000)), born = [];
    parts = parts.filter(p => {
      if (p.kind === 'rocket') { if (p.vy >= -.6) { born.push(p); return false; } return true; }
      if (p.life !== undefined) return p.life > 0;
      return p.y < H+40 && p.x > -60 && p.x < W+60;
    });
    born.forEach(explode);
    for (const p of parts) {
      ctx.save();
      if (p.kind === 'flash') {
        ctx.globalCompositeOperation = 'lighter'; p.life -= p.decay;
        const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,70);
        g.addColorStop(0, `rgba(255,255,255,${.7*p.life*fade})`); g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x,p.y,70,0,6.28); ctx.fill();
      } else if (p.kind === 'rocket' || p.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        p.trail.push([p.x,p.y]); if (p.trail.length > (p.kind==='rocket'?10:6)) p.trail.shift();
        p.vx *= p.drag; p.vy = p.vy*p.drag + p.g; p.x += p.vx; p.y += p.vy;
        ctx.globalAlpha = (p.kind==='spark' ? p.life : 1)*fade;
        if (p.kind === 'spark') p.life -= p.decay;
        ctx.strokeStyle = p.color; ctx.lineCap = 'round'; ctx.lineWidth = p.kind==='rocket' ? 2.5 : 2;
        ctx.beginPath(); p.trail.forEach(([tx,ty],i) => i ? ctx.lineTo(tx,ty) : ctx.moveTo(tx,ty)); ctx.lineTo(p.x,p.y); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x,p.y,p.kind==='rocket'?2.4:1.4,0,6.28); ctx.fill();
      } else {
        p.vx *= p.drag; p.vy = Math.min(p.vy*p.drag + p.g, 5.5);
        p.x += p.vx + Math.sin(p.tilt)*.8; p.y += p.vy; p.rot += p.vr; p.tilt += p.vt;
        ctx.globalAlpha = fade; ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        const sy = Math.cos(p.tilt);
        if (p.kind === 'circle') { ctx.beginPath(); ctx.ellipse(0,0,p.h*.6,p.h*.6*Math.abs(sy)+.5,0,0,6.28); ctx.fill(); }
        else if (p.kind === 'ribbon') { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-p.w,0); ctx.quadraticCurveTo(0,8*sy,p.w,0); ctx.stroke(); }
        else ctx.fillRect(-p.w/2, -p.h/2*sy, p.w, p.h*sy);
      }
      ctx.restore();
    }
    if (now < endAt || (fade > 0 && parts.length)) requestAnimationFrame(loop);
    else { running = false; parts = []; ctx.clearRect(0,0,W,H); }
  }

  function showBackdrop(dur) {
    if (!bg) {
      bg = document.createElement('div');
      bg.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;opacity:0;transition:opacity .7s ease;background:radial-gradient(ellipse at 50% 30%,rgba(67,56,202,.82) 0%,rgba(30,27,75,.9) 55%,rgba(15,12,41,.94) 100%)';
      document.body.appendChild(bg);
    }
    requestAnimationFrame(() => bg.style.opacity = '1');
    timers.push(setTimeout(() => bg.style.opacity = '0', dur - 700));
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function showCard(o, dur) {
    card && card.remove();
    card = document.createElement('div');
    card.style.cssText = `position:fixed;left:50%;top:-240px;transform:translateX(-50%);opacity:0;transition:top .55s cubic-bezier(.2,1.4,.4,1),opacity .4s;z-index:2147483647;pointer-events:none;font-family:${FONT};color:#111827`;
    const heading = o.name ? `Congratulations, ${esc(o.name)}!` : 'Congratulations!';
    const body = o.title ? `<b style="color:#111827">${esc(o.title)}</b> is done${o.findings != null ? ` — ${esc(o.findings)} findings resolved` : ''}.` : esc(o.message || 'Nice work.');
    card.innerHTML = `<div style="background:#fff;border-radius:20px;box-shadow:0 24px 60px -12px rgba(49,46,129,.35),0 0 0 1px rgba(67,56,202,.08);padding:22px 28px 0;width:420px;max-width:90vw;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;overflow:hidden">
  <div style="position:relative;width:64px;height:64px;margin-bottom:6px">
    <span style="position:absolute;inset:0;border-radius:50%;background:#4F46E5;animation:ctgRing 1.4s ease-out infinite"></span>
    <span style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(135deg,#6366F1,#4338CA);display:flex;align-items:center;justify-content:center;animation:ctgPop .6s cubic-bezier(.2,1.4,.4,1) both">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" style="stroke-dasharray:24;stroke-dashoffset:24;animation:ctgDraw .45s .35s ease-out forwards"></path></svg>
    </span>
  </div>
  <span style="font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#4338CA">${esc(o.label || 'Audit complete')}</span>
  <span style="font-size:24px;font-weight:700;line-height:1.2">${heading}</span>
  <span style="font-size:15px;color:#4B5563;line-height:1.45;text-wrap:pretty">${body}</span>
  ${o.progress ? `<span style="font-size:13px;color:#6B7280;margin-top:4px">${esc(o.progress)}</span>` : ''}
  <div style="align-self:stretch;margin:18px -28px 0;height:4px;background:#EEF0FF"><div data-bar style="height:100%;width:100%;background:linear-gradient(90deg,#4F46E5,#F59E0B)"></div></div>
</div>`;
    document.body.appendChild(card);
    const bar = card.querySelector('[data-bar]');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      card.style.top = '28px'; card.style.opacity = '1';
      bar.style.transition = `width ${(dur-500)/1000}s linear`; bar.style.width = '0%';
    }));
    const c = card;
    timers.push(setTimeout(() => { c.style.top = '-240px'; c.style.opacity = '0'; }, dur - 500));
    timers.push(setTimeout(() => c.remove(), dur));
  }

  window.celebrate = function (o = {}) {
    const dur = o.duration ?? 5000;
    const k = { subtle:.9, festive:1.8, epic:2.8 }[(o.intensity || 'festive').toLowerCase()] || 1.8;
    injectStyles(); ensureCanvas();
    timers.forEach(clearTimeout); timers = [];
    const W = innerWidth, H = innerHeight;
    const r = o.origin && o.origin.getBoundingClientRect ? o.origin.getBoundingClientRect() : { left:W/2, top:H/2, width:0, height:0 };
    const later = (ms, f) => timers.push(setTimeout(f, ms));
    spawn(r.left + r.width/2, r.top + r.height/2, 90*k, -Math.PI/2, Math.PI*1.4, 13);
    later(250, () => { spawn(0, H, 110*k, -Math.PI/3, .7, 26); spawn(W, H, 110*k, -Math.PI*2/3, .7, 26); });
    later(900, () => { spawn(0, H*.8, 70*k, -Math.PI/3.4, .6, 22); spawn(W, H*.8, 70*k, -Math.PI*2/3.4*1.06, .6, 22); });
    for (let t = 400; t < dur-1600; t += 180) later(t, () => { for (let i = 0; i < 5*k; i++) spawn(Math.random()*W, -20, 1, Math.PI/2, .6, 2); });
    later(80, () => { launch(k); launch(k); launch(k); });
    for (let t = 300; t < dur-1300; t += 700/k) later(t, () => { launch(k); if (Math.random() < .6) launch(k); });
    if (o.backdrop !== false) showBackdrop(dur);
    if (o.card !== false) showCard(o, dur);
    endAt = performance.now() + dur;
    if (!running) { running = true; requestAnimationFrame(loop); }
  };
})();
