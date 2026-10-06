// Earthbound-style battles: first-person view, warped psychedelic
// background, and the rolling HP meter (you only go down when the meter
// finishes rolling to zero, so a fast win can save you from a mortal blow).
window.LQ = window.LQ || {};

// ------------------------------------------------------------ background
LQ.BattleBG = class {
  constructor(cfg) {
    this.cfg = cfg;
    this.canvas = document.createElement('canvas');
    this.canvas.width = LQ.W;
    this.canvas.height = LQ.H;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(LQ.W, LQ.H);
    this.pal = cfg.colors.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    this.patA = LQ.BattleBG.pattern(cfg.pattern);
    this.patB = LQ.BattleBG.pattern(cfg.pattern === 'rings' ? 'stripes' : 'rings');
  }
  static pattern(kind) {
    const p = new Uint8Array(64 * 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        let v;
        switch (kind) {
          case 'stripes': v = Math.floor((x + y) / 8) % 3; break;
          case 'checker': v = (((x >> 3) + (y >> 3)) % 2) + ((x >> 4) % 2); break;
          case 'rings': v = Math.floor(Math.hypot(x - 32, y - 32) / 5) % 3; break;
          case 'waves': v = Math.floor((y + 6 * Math.sin(x / 64 * Math.PI * 4)) / 6 + 30) % 3; break;
          case 'dots': {
            const dx = (x % 16) - 8, dy = (y % 16) - 8;
            v = dx * dx + dy * dy < 20 ? 2 : ((x >> 4) + (y >> 4)) % 2;
            break;
          }
          default: v = (x >> 3) % 3;
        }
        p[y * 64 + x] = v;
      }
    return p;
  }
  render(t) {
    const { dist, speed } = this.cfg;
    const d = this.img.data, pal = this.pal;
    const cyc = Math.floor(t * speed / 12);
    const scroll = Math.floor(t * speed * 0.5);
    for (let y = 0; y < LQ.H; y++) {
      let offA = 0, offB = 0, sy = y;
      const wave = Math.sin(y / 14 + t * 0.05 * speed);
      if (dist === 'horiz') { offA = Math.round(wave * 14); offB = Math.round(-wave * 8); }
      else if (dist === 'interlace') { offA = Math.round(wave * 16) * (y % 2 ? 1 : -1); offB = Math.round(wave * 6); }
      else if (dist === 'vert') { sy = Math.round(y + Math.sin(y / 20 + t * 0.04 * speed) * 10); offB = Math.round(wave * 6); }
      const rowA = ((sy + scroll) & 63) * 64;
      const rowB = ((y - scroll) & 63) * 64;
      for (let x = 0; x < LQ.W; x++) {
        const a = (this.patA[rowA + ((x + offA + scroll) & 63)] + cyc) % 3;
        const b = (this.patB[rowB + ((x + offB) & 63)] + cyc + 1) % 3;
        const i = (y * LQ.W + x) * 4;
        const ca = pal[a], cb = pal[b];
        d[i] = (ca[0] * 3 + cb[0]) >> 2;
        d[i + 1] = (ca[1] * 3 + cb[1]) >> 2;
        d[i + 2] = (ca[2] * 3 + cb[2]) >> 2;
        d[i + 3] = 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
};

// ------------------------------------------------------------ leveling
// Raise the player's level for any experience they've banked. Returns the
// lines to show; function entries play the level-up jingle when reached.
LQ.levelUps = function (p) {
  const lines = [];
  while (p.level < LQ.MAX_LEVEL && p.exp >= LQ.EXP_TABLE[p.level + 1]) {
    p.level++;
    const g = (k) => LQ.rand(LQ.LEVEL_UP[k][0], LQ.LEVEL_UP[k][1]);
    const hp = g('hp'), pp = g('pp'), off = g('off'), df = g('def'), spd = g('spd');
    p.maxHp += hp; p.maxPp += pp; p.off += off; p.def += df; p.spd += spd;
    lines.push(() => LQ.Sound.levelUp());
    lines.push(p.name + ' reached level ' + p.level + '!');
    lines.push('Offense +' + off + ', Defense +' + df + ', Speed +' + spd + '.');
    lines.push('Max HP +' + hp + ', Max PP +' + pp + '.');
    const learn = LQ.PSI_LEARN[p.level];
    if (learn && !p.psi.includes(learn)) {
      p.psi.push(learn);
      lines.push(p.name + ' realized the power of ' + LQ.PSI[learn].name + '!');
    }
  }
  return lines;
};

// ------------------------------------------------------------ battle
LQ.Battle = class {
  constructor(game, enemyType, opts) {
    opts = opts || {};
    this.game = game;
    this.p = game.player;
    const def = LQ.ENEMIES[enemyType];
    this.type = enemyType;
    this.def = def;
    this.enemy = { name: def.name, hp: def.hp, maxHp: def.hp, off: def.off, def: def.def, spd: def.spd, level: def.level, boss: !!def.boss };
    this.bg = new LQ.BattleBG(def.bg);
    this.sprite = LQ.getEnemySprite(def.art, 2);
    this.flash = LQ.tintSprite(this.sprite, '#ffffff');
    this.t = 0;
    this.hpRoll = this.p.hp;
    this.ppRoll = this.p.pp;
    this.queue = [];
    this.msg = null;
    this.mode = 'queue';     // queue | command | goods | psi | done
    this.cursor = 0;
    this.subCursor = 0;
    this.enemyFlash = 0;
    this.enemyAlpha = 1;
    this.shake = 0;
    this.defending = false;
    this.shieldTurns = 0;
    this.scoreUsed = false;
    this.result = null;
    this.mortal = false;

    if (!def.boss && this.p.level >= def.level + 5) {
      this.say('You encountered ' + this.article() + def.name + '.');
      this.say('YOU WON! (It was no match for you.)');
      this.push(() => this.victory(true));
    } else {
      this.say(def.boss ? 'The ' + def.name + ' blocks your path!' : 'You encountered ' + this.article() + def.name + '!');
      if (opts.advantage === 'player') this.say('You got the jump on it!');
      if (opts.advantage === 'enemy') { this.say('The ' + def.name + ' attacked from behind!'); this.push(() => this.enemyTurn()); }
      this.push(() => this.openCommand());
    }
  }

  article() { return /^[AEIOU]/.test(this.def.name) ? 'an ' : 'a '; }
  say(text) { this.queue.push({ msg: text }); }
  push(fn) { this.queue.push({ fn }); }
  // Insert steps right after the current one (used by actions).
  sayNow(lines) { this.queue.unshift(...lines.map((l) => (typeof l === 'function' ? { fn: l } : { msg: l }))); }

  openCommand() {
    if (this.result) return;
    this.mode = 'command';
    this.defending = false;
  }

  // ---------------------------------------------------------- turn logic
  runTurn(action) {
    this.mode = 'queue';
    const playerFirst = this.p.spd + LQ.rand(0, 4) >= this.enemy.spd + LQ.rand(0, 4) || action.type === 'defend';
    const steps = [];
    const enemyStep = () => { if (!this.result) this.enemyTurn(); };
    const playerStep = () => { if (!this.result) this.playerAction(action); };
    if (playerFirst) steps.push(playerStep, enemyStep); else steps.push(enemyStep, playerStep);
    steps.push(() => {
      if (this.shieldTurns > 0) this.shieldTurns--;
      if (!this.result) this.openCommand();
    });
    steps.forEach((s) => this.push(s));
  }

  damageRoll(atk, def, mult) {
    const base = Math.max(1, atk * 2 - def);
    return Math.max(1, Math.round(base * mult * (0.75 + Math.random() * 0.5)));
  }

  hitEnemy(dmg) {
    this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
    this.enemyFlash = 16;
    LQ.Sound.hit();
  }

  playerAction(a) {
    const name = this.p.name;
    const e = this.enemy;
    if (a.type === 'bash') {
      const off = this.p.off + this.game.equipBonus('off');
      const lines = [name + ' attacks!'];
      if (LQ.chance(1 / 16)) { lines.push('Just missed!'); this.sayNow(lines); return; }
      let dmg, smash = LQ.chance(1 / 14);
      if (smash) { dmg = Math.round(off * 4 * (0.9 + Math.random() * 0.2)); }
      else dmg = this.damageRoll(off, e.def, 1);
      lines.push(() => { this.hitEnemy(dmg); if (smash) LQ.Sound.smash(); });
      lines.push(smash ? 'SMAAAASH!! ' + dmg + ' HP of damage to the ' + e.name + '!' : dmg + ' HP of damage to the ' + e.name + '!');
      lines.push(() => this.checkEnemyDown());
      this.sayNow(lines);
    } else if (a.type === 'defend') {
      this.defending = true;
      this.sayNow([name + ' is guarding.']);
    } else if (a.type === 'run') {
      if (e.boss) { this.sayNow([name + ' tried to run away...', 'But there is no escaping this!']); return; }
      const ok = LQ.chance(0.45 + (this.p.spd - e.spd) * 0.06);
      if (ok) this.sayNow([name + ' tried to run away...', 'And got away safely!', () => this.finish('run')]);
      else this.sayNow([name + ' tried to run away...', 'But the ' + e.name + ' blocked the way!']);
    } else if (a.type === 'psi') {
      const psi = LQ.PSI[a.id];
      this.p.pp -= psi.pp;
      const lines = [name + ' tried ' + psi.name + '!', () => LQ.Sound.psi(), psi.text];
      if (psi.kind === 'attack') {
        const dmg = LQ.rand(psi.amount[0], psi.amount[1]);
        lines.push(() => this.hitEnemy(dmg), dmg + ' HP of damage to the ' + e.name + '!', () => this.checkEnemyDown());
      } else if (psi.kind === 'heal') {
        const amt = LQ.rand(psi.amount[0], psi.amount[1]);
        lines.push(() => { this.healPlayer(amt); LQ.Sound.heal(); }, name + ' recovered ' + amt + ' HP!');
      } else if (psi.kind === 'shield') {
        lines.push(() => { this.shieldTurns = 4; });
      }
      this.sayNow(lines);
    } else if (a.type === 'goods') {
      this.useGoods(a.index);
    }
  }

  useGoods(index) {
    const id = this.p.goods[index];
    const it = LQ.ITEMS[id];
    const name = this.p.name;
    const e = this.enemy;
    if (id === 'score') {
      if (e.boss && !this.scoreUsed) {
        this.scoreUsed = true;
        this.sayNow([
          name + ' held up the Carillon Score and hummed the true melody!',
          () => LQ.Sound.bell(),
          'The ' + e.name + ' shuddered! Its bells are falling back into tune!',
          () => { e.def = 0; e.off = Math.round(e.off * 0.7); this.hitEnemy(60); },
          '60 HP of damage! Its defense dropped to nothing!',
          () => this.checkEnemyDown(),
        ]);
      } else {
        this.sayNow([name + ' looked at the Carillon Score.', e.boss ? 'The melody is already ringing in the air.' : 'Nothing happened.']);
      }
      return;
    }
    if (it.kind === 'key' || it.kind === 'equip') {
      this.sayNow([name + ' fumbled with the ' + it.name + '.', 'There is no time for that now!']);
      return;
    }
    this.p.goods.splice(index, 1);
    const lines = [name + ' used the ' + it.name + '.'];
    if (it.kind === 'attack') {
      const dmg = LQ.rand(it.damage[0], it.damage[1]);
      lines.push(() => this.hitEnemy(dmg), 'It exploded! ' + dmg + ' HP of damage to the ' + e.name + '!', () => this.checkEnemyDown());
    } else {
      if (it.hp) lines.push(() => { this.healPlayer(it.hp); LQ.Sound.heal(); }, name + ' recovered ' + it.hp + ' HP!');
      if (it.pp) lines.push(() => { this.p.pp = Math.min(this.p.maxPp, this.p.pp + it.pp); }, name + ' recovered ' + it.pp + ' PP!');
    }
    this.sayNow(lines);
  }

  healPlayer(amt) {
    // Healing raises the target; the meter rolls up toward it.
    const base = Math.max(this.p.hp, Math.ceil(this.hpRoll));
    this.p.hp = Math.min(this.p.maxHp, base + amt);
    if (this.p.hp > 0) this.mortal = false;
  }

  enemyTurn() {
    const e = this.enemy;
    const pool = this.def.actions.filter((a) => !a.rare || LQ.chance(0.25));
    const act = LQ.pick(pool);
    const lines = ['The ' + e.name + ' ' + act.text];
    if (act.steal) {
      const amt = Math.min(this.game.player.money, act.steal);
      lines.push(() => { this.game.player.money -= amt; }, amt > 0 ? 'You paid $' + amt + '. Ouch.' : 'But you are broke. It looks disappointed.');
    }
    if (act.power > 0) {
      if (LQ.chance(1 / 20)) {
        lines.push('You dodged it quickly!');
      } else {
        const def = this.p.def + this.game.equipBonus('def');
        let dmg = this.damageRoll(e.off, def, act.power);
        if (this.defending) dmg = Math.max(1, Math.floor(dmg / 2));
        if (this.shieldTurns > 0) dmg = Math.max(1, Math.floor(dmg / 2));
        lines.push(() => {
          this.p.hp = Math.max(0, this.p.hp - dmg);
          this.shake = 12;
          LQ.Sound.hurt();
          if (this.p.hp === 0) this.mortal = true;
        });
        lines.push(this.p.name + ' took ' + dmg + ' HP of damage!');
        lines.push(() => { if (this.mortal) this.sayNow(['Mortal damage! Finish this fast!']); });
      }
    }
    this.sayNow(lines);
  }

  checkEnemyDown() {
    if (this.enemy.hp > 0) return;
    this.result = 'win';
    this.queue = [];
    this.sayNow([
      () => { this.dying = 1; },
      'You defeated the ' + this.enemy.name + '!',
      () => this.victory(false),
    ]);
  }

  victory(instant) {
    this.result = 'win';
    // Freeze the rolling meter where it is: that is your HP now.
    this.p.hp = Math.max(1, this.p.hp, Math.ceil(this.hpRoll));
    this.mortal = false;
    const def = this.def;
    const p = this.p;
    LQ.Sound.win();
    const lines = [];
    p.exp += def.exp;
    p.money += def.money;
    lines.push(p.name + ' gained ' + def.exp + ' exp. points.');
    lines.push('Found $' + def.money + '.');
    if (def.drop && LQ.chance(def.drop[1]) && p.goods.length < 14) {
      p.goods.push(def.drop[0]);
      lines.push('The ' + def.name + ' left behind a ' + LQ.ITEMS[def.drop[0]].name + '!');
    }
    lines.push(...LQ.levelUps(p));
    if (this.game.onEnemyDefeated) this.game.onEnemyDefeated(this.type);
    lines.push(() => this.finish('win'));
    if (instant) this.sayNow(lines); else this.queue.push(...lines.map((l) => (typeof l === 'function' ? { fn: l } : { msg: l })));
  }

  finish(result) {
    this.result = result;
    this.mode = 'done';
    if (result === 'run') this.p.hp = Math.max(1, this.p.hp, Math.ceil(this.hpRoll));
    this.game.endBattle(result);
  }

  // ---------------------------------------------------------- update
  update() {
    this.t++;
    if (this.enemyFlash > 0) this.enemyFlash--;
    if (this.shake > 0) this.shake--;
    if (this.dying) this.enemyAlpha = Math.max(0, this.enemyAlpha - 0.04);

    // Rolling meters: HP rolls about 15 per second, faster when healing.
    const target = this.p.hp;
    if (this.result !== 'win' && this.result !== 'run') {
      if (this.hpRoll > target) this.hpRoll = Math.max(target, this.hpRoll - 0.25);
      else if (this.hpRoll < target) this.hpRoll = Math.min(target, this.hpRoll + 0.6);
    }
    if (this.ppRoll > this.p.pp) this.ppRoll = Math.max(this.p.pp, this.ppRoll - 0.5);
    else if (this.ppRoll < this.p.pp) this.ppRoll = Math.min(this.p.pp, this.ppRoll + 0.5);

    if (this.hpRoll <= 0 && !this.result) {
      this.result = 'lose';
      this.queue = [];
      this.msg = null;
      this.mode = 'queue';
      this.sayNow([this.p.name + ' got hurt and collapsed...', () => this.finish('lose')]);
    }

    const I = LQ.Input;
    if (this.mode === 'queue') {
      if (!this.msg) {
        // Run function steps until we hit a message.
        while (this.queue.length && this.queue[0].fn) {
          const s = this.queue.shift();
          s.fn();
          if (this.mode !== 'queue') return;
        }
        if (this.queue.length) {
          const s = this.queue.shift();
          this.msg = { lines: LQ.wrapText(s.msg, 216), shown: 0, total: s.msg.length, hold: 0 };
        }
      } else {
        const m = this.msg;
        if (m.shown < m.total) {
          m.shown += 2;
          if (this.t % 3 === 0) LQ.Sound.text();
          if (I.hit('ok')) m.shown = m.total;
        } else {
          m.hold++;
          if (I.hit('ok') || m.hold > 70) this.msg = null;
        }
      }
      return;
    }

    if (this.mode === 'command') {
      const cmds = this.commands();
      if (I.hit('right')) { this.cursor = (this.cursor + 1) % cmds.length; LQ.Sound.cursor(); }
      if (I.hit('left')) { this.cursor = (this.cursor + cmds.length - 1) % cmds.length; LQ.Sound.cursor(); }
      if (I.hit('down') && this.cursor + 3 < cmds.length) { this.cursor += 3; LQ.Sound.cursor(); }
      if (I.hit('up') && this.cursor >= 3) { this.cursor -= 3; LQ.Sound.cursor(); }
      if (I.hit('ok')) {
        LQ.Sound.select();
        const c = cmds[this.cursor];
        if (c === 'Bash') this.runTurn({ type: 'bash' });
        else if (c === 'Defend') this.runTurn({ type: 'defend' });
        else if (c === 'Run') this.runTurn({ type: 'run' });
        else if (c === 'Goods') { if (this.p.goods.length) { this.mode = 'goods'; this.subCursor = 0; } }
        else if (c === 'PSI') { if (this.p.psi.length) { this.mode = 'psi'; this.subCursor = 0; } }
      }
      return;
    }

    if (this.mode === 'goods' || this.mode === 'psi') {
      const list = this.mode === 'goods' ? this.p.goods : this.p.psi;
      if (I.hit('down')) { this.subCursor = (this.subCursor + 1) % list.length; LQ.Sound.cursor(); }
      if (I.hit('up')) { this.subCursor = (this.subCursor + list.length - 1) % list.length; LQ.Sound.cursor(); }
      if (I.hit('cancel')) { this.mode = 'command'; LQ.Sound.cancel(); }
      if (I.hit('ok')) {
        if (this.mode === 'goods') { LQ.Sound.select(); this.runTurn({ type: 'goods', index: this.subCursor }); }
        else {
          const psi = LQ.PSI[list[this.subCursor]];
          if (this.p.pp < psi.pp) { LQ.Sound.cancel(); }
          else { LQ.Sound.select(); this.runTurn({ type: 'psi', id: list[this.subCursor] }); }
        }
      }
    }
  }

  commands() { return ['Bash', 'Goods', 'PSI', 'Defend', 'Run']; }

  // ---------------------------------------------------------- draw
  draw(ctx) {
    ctx.drawImage(this.bg.render(this.t), 0, 0);
    const sx = this.shake ? LQ.rand(-3, 3) : 0;
    ctx.save();
    ctx.translate(sx, 0);

    // Enemy
    const spr = this.sprite;
    const ex = Math.floor((LQ.W - spr.width) / 2);
    const ey = Math.floor(108 - spr.height / 2) + Math.round(Math.sin(this.t / 20) * 2);
    if (this.enemyAlpha > 0) {
      ctx.globalAlpha = this.enemyAlpha;
      const blink = this.enemyFlash > 0 && Math.floor(this.enemyFlash / 2) % 2 === 0;
      ctx.drawImage(blink ? this.flash : spr, ex, ey);
      ctx.globalAlpha = 1;
    }

    // Text / command window at the top.
    if (this.mode === 'command' || this.mode === 'goods' || this.mode === 'psi') {
      LQ.drawWindow(ctx, 8, 8, 240, 44);
      const cmds = this.commands();
      cmds.forEach((c, i) => {
        const cx = 26 + (i % 3) * 76, cy = 16 + Math.floor(i / 3) * 16;
        const dim = (c === 'PSI' && !this.p.psi.length) || (c === 'Goods' && !this.p.goods.length);
        LQ.drawText(ctx, c, cx, cy, dim ? LQ.COLORS.textDim : LQ.COLORS.text);
        if (i === this.cursor && this.mode === 'command') LQ.drawCursor(ctx, cx - 10, cy, this.t);
      });
    } else if (this.msg) {
      LQ.drawWindow(ctx, 8, 8, 240, 44);
      let left = this.msg.shown;
      this.msg.lines.slice(0, 3).forEach((line, i) => {
        const part = line.slice(0, Math.max(0, left));
        left -= line.length + 1;
        LQ.drawText(ctx, part, 18, 16 + i * LQ.LINE_HEIGHT, LQ.COLORS.text);
      });
    }

    if (this.mode === 'goods' || this.mode === 'psi') this.drawList(ctx);

    ctx.restore();
    this.drawStatus(ctx);
  }

  drawList(ctx) {
    const isGoods = this.mode === 'goods';
    const ids = isGoods ? this.p.goods : this.p.psi;
    const rows = Math.min(ids.length, 6);
    const start = LQ.clamp(this.subCursor - 5, 0, Math.max(0, ids.length - 6));
    LQ.drawWindow(ctx, 40, 56, 176, rows * 14 + 14);
    for (let i = 0; i < rows; i++) {
      const id = ids[start + i];
      const y = 63 + i * 14;
      if (isGoods) {
        LQ.drawText(ctx, LQ.ITEMS[id].name, 58, y, LQ.COLORS.text);
      } else {
        const psi = LQ.PSI[id];
        const can = this.p.pp >= psi.pp;
        LQ.drawText(ctx, psi.name, 58, y, can ? LQ.COLORS.text : LQ.COLORS.textDim);
        LQ.drawText(ctx, psi.pp + ' PP', 176, y, can ? LQ.COLORS.text : LQ.COLORS.textDim);
      }
      if (start + i === this.subCursor) LQ.drawCursor(ctx, 46, y, this.t);
    }
  }

  drawStatus(ctx) {
    const x = 88, y = 156;
    const bob = this.mortal ? (Math.floor(this.t / 6) % 2 ? 1 : 0) : 0;
    LQ.drawWindow(ctx, x, y - bob, 80, 60, this.mortal ? { windowFill: '#601020' } : null);
    LQ.drawText(ctx, this.p.name.slice(0, 10), x + 10, y + 7 - bob, LQ.COLORS.text);
    LQ.drawText(ctx, 'HP', x + 10, y + 25, LQ.COLORS.text);
    LQ.drawText(ctx, 'PP', x + 10, y + 41, LQ.COLORS.text);
    LQ.drawOdometer(ctx, x + 32, y + 21, this.hpRoll);
    LQ.drawOdometer(ctx, x + 32, y + 37, this.ppRoll);
  }
};

// Three rolling digits in little cells, like the slot-machine meter in Earthbound.
LQ.drawOdometer = function (ctx, x, y, value) {
  const v = Math.max(0, value);
  const CW = 8;
  ctx.fillStyle = '#181820';
  ctx.fillRect(x, y, CW * 3 + 2, 14);
  for (let d = 0; d < 3; d++) {
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(x + 1 + d * CW, y + 1, CW - 1, 12);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y + 1, CW * 3 + 2, 12);
  ctx.clip();
  const whole = Math.floor(v);
  const frac = v - whole;
  for (let d = 0; d < 3; d++) {
    const place = 10 ** (2 - d);
    const digit = Math.floor(whole / place) % 10;
    const dx = x + 2 + d * CW;
    // The ones column always rolls; higher columns roll as the one below wraps.
    const rolling = d === 2 || (whole % place === place - 1 && frac > 0);
    const off = rolling ? Math.round(frac * 12) : 0;
    const showDigit = whole >= place || d === 2 ? String(digit) : '';
    const nextDigit = whole + 1 >= place || d === 2 ? String((digit + 1) % 10) : '';
    LQ.drawText(ctx, showDigit, dx, y + 3 + off, '#181820');
    if (rolling && off > 0) LQ.drawText(ctx, nextDigit, dx, y + 3 + off - 12, '#181820');
  }
  ctx.restore();
};
