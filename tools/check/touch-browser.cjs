// Touch controls on a phone (iPhone 13 viewport, real CDP touch events): the floating stick steers from
// where the thumb lands, wherever that is, walks on a short push and runs on a long one, turns back at once;
// a second finger jumps without stopping the walk; a cancelled touch is not a tap.
// usage: node tools/check/touch-browser.cjs [url]
const { launch, openGame, realErrors } = require('./common.cjs');
const url = process.argv[2] || `file://${process.cwd()}/index.html`;
let fails = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); if (!ok) fails++; };

(async () => {
  const b = await launch();
  const { ctx, page, errs, step } = await openGame(b, url, { mode: 'gl', mobile: true });
  const cdp = await ctx.newCDPSession(page), vp = page.viewportSize();
  // fingers: { id: [x, y] }; start and move list every finger down, as a real screen does
  const down = {};
  const send = type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.entries(down).map(([id, [x, y]]) => ({ id: +id, x, y })) });
  const start = (id, x, y) => { down[id] = [x, y]; return send('touchStart'); };
  const moveTo = (id, x, y) => { down[id] = [x, y]; return send('touchMove'); };
  const end = id => { const [x, y] = down[id]; delete down[id]; return cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, x, y }] }); };   // CDP lists the fingers that lift
  const st = () => page.evaluate(() => ({ x: player.x, y: player.y, run: player.run || 0, jump: player.jump || 0, rings: rings.length, dir: player.dir, face: player.face }));
  await step(30);

  // a thumb in the bottom-left corner, far from the knight, pushed up a little: he walks up, he does not run
  const tx = 70, ty = vp.height - 140;
  let s0 = await st();
  await start(1, tx, ty); await step(2);
  for (let k = 1; k <= 4; k++) { await moveTo(1, tx, ty - k * 8); await step(1); }
  await step(30);
  let s1 = await st();
  check('short push up from a corner walks up', s1.y < s0.y - 1 && Math.abs(s1.x - s0.x) < 1, `dx ${(s1.x - s0.x).toFixed(2)} dy ${(s1.y - s0.y).toFixed(2)}`);
  check('short push walks, does not run', s1.run < 0.2, `run ${s1.run.toFixed(2)}`);

  // pushed further the same way: he runs
  await moveTo(1, tx, ty - 70); await step(40);
  const s2 = await st();
  check('long push runs', s2.run > 0.6, `run ${s2.run.toFixed(2)}`);

  // a second finger taps while walking: he jumps, and keeps walking once it lifts
  await start(2, vp.width - 80, vp.height * 0.4); await step(3); await end(2); await step(2);
  const s3 = await st();
  check('second-finger tap jumps while walking', s3.jump > 0);
  await step(80);
  const s4a = await st(); await step(20); const s4 = await st();
  check('walk goes on after the second finger lifts', s4.y < s4a.y - 0.5, `dy ${(s4.y - s4a.y).toFixed(2)}`);

  // the thumb swings straight down past the rim: he turns and goes down within a few frames
  await moveTo(1, tx, ty + 40); await step(8);
  const s5a = await st(); await step(15); const s5 = await st();
  check('turning back is immediate', s5.y > s5a.y + 0.3 && s5.dir === 'down', `dy ${(s5.y - s5a.y).toFixed(2)} dir ${s5.dir}`);

  // the thumb comes back to the stick's centre: he stops
  const c = await page.evaluate(() => stick && [stick.ox, stick.oy]);
  await moveTo(1, c[0], c[1]); await step(10);
  const s6a = await st(); await step(10); const s6 = await st();
  check('thumb at the centre stops him', Math.hypot(s6.x - s6a.x, s6.y - s6a.y) < 0.05);
  await end(1); await step(20);
  check('stick is gone after the thumb lifts', await page.evaluate(() => stick === null && ptrs.size === 0));

  // a cancelled touch (the browser took it) does not send a gust
  const r0 = (await st()).rings;
  await start(3, 60, vp.height * 0.3); await step(2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); delete down[3]; await step(2);
  check('cancelled touch is not a tap', (await st()).rings === r0);

  // a plain tap on the field still gusts, a tap on the knight still jumps
  await start(4, 60, vp.height * 0.3); await step(3); await end(4); await step(2);
  check('tap on the field sends a gust', (await st()).rings > r0);
  await step(60);
  const kq = await page.evaluate(() => [(player.x - camX) * CW, (player.y - camY) * CH - 20]);
  await start(5, kq[0], kq[1]); await step(3); await end(5); await step(3);
  check('tap on the knight jumps', (await st()).jump > 0);

  // the HUD speaks touch on a phone
  const hint = await page.evaluate(() => [getComputedStyle(document.querySelector('.hint-touch')).display, getComputedStyle(document.querySelector('.hint-keys')).display]);
  check('touch hint shown, keyboard hint hidden', hint[0] !== 'none' && hint[1] === 'none', hint.join(' / '));

  if (process.env.SHOT) {
    await step(40); await start(6, tx, ty); await step(1); await moveTo(6, tx + 30, ty - 50); await step(20);
    await page.screenshot({ path: process.env.SHOT }); await end(6);
  }
  const re = realErrors(errs); check('no console errors', re.length === 0, re.slice(0, 3).join(' | '));
  await ctx.close(); await b.close();
  console.log(fails ? `${fails} failed` : 'all passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
