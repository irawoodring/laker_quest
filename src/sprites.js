// Pixel art. Characters share one 16x24 template that gets recolored per NPC.
// Palette keys: k outline, c hat/top of hair, h hair, s skin, e eyes,
// t shirt, p pants, f shoes.
window.LQ = window.LQ || {};

LQ.HUMAN = {
  headDown: [
    '................',
    '.....kkkkkk.....',
    '....kcccccck....',
    '...kcccccccck...',
    '...khhhhhhhhk...',
    '...khsssssshk...',
    '...kssessessk...',
    '...kssessessk...',
    '...kssssssssk...',
    '....kssssssk....',
    '.....kkkkkk.....',
  ],
  headUp: [
    '................',
    '.....kkkkkk.....',
    '....kcccccck....',
    '...kcccccccck...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '....khhhhhhk....',
    '.....kkkkkk.....',
  ],
  headSide: [
    '................',
    '.....kkkkkk.....',
    '....kcccccck....',
    '...kcccccccck...',
    '...khhhhhhhhk...',
    '...khhhssssk....',
    '...khhssssesk...',
    '...khhssssesk...',
    '...khsssssssk...',
    '....kssssssk....',
    '.....kkkkkk.....',
  ],
  bodyFront: [
    '....kttttttk....',
    '...kttttttttk...',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..ksttttttttsk..',
    '...kppppppppk...',
    '...kppppppppk...',
  ],
  bodySide: [
    '.....kttttk.....',
    '....kttttttk....',
    '....kttttstk....',
    '....ktttsstk....',
    '....kttttttk....',
    '....kppppppk....',
    '....kppppppk....',
  ],
  legsFront: [
    ['....kppkkppk....', '....kppkkppk....', '....kffkkffk....', '...kfffkkfffk...', '...kkkk..kkkk...', '................'],
    ['....kppkkppk....', '....kppk.kffk...', '....kffk.kkkk...', '...kfffk........', '...kkkk.........', '................'],
    ['....kppkkppk....', '...kffk.kppk....', '...kkkk.kffk....', '........kfffk...', '.........kkkk...', '................'],
  ],
  legsSide: [
    ['.....kppppk.....', '.....kppppk.....', '.....kffffk.....', '.....kfffffk....', '.....kkkkkkk....', '................'],
    ['....kppkkppk....', '...kppk..kppk...', '...kffk..kffk...', '..kfffk..kfffk..', '..kkkkk..kkkkk..', '................'],
    ['.....kppppk.....', '.....kppkpk.....', '.....kffkfk.....', '....kfffkffk....', '....kkkkkkkk....', '................'],
  ],
};

// Returns {down:[3], up:[3], left:[3], right:[3]} canvases for a palette.
LQ.buildCharacter = function (colors) {
  const pal = {
    k: '#181820', e: '#181820',
    c: colors.hat || colors.hair, h: colors.hair, s: colors.skin || '#f4c8a0',
    t: colors.shirt, p: colors.pants, f: colors.shoes || '#503028',
  };
  const H = LQ.HUMAN;
  const frames = (head, body, legSet) =>
    legSet.map((legs) => LQ.makeSprite(head.concat(body, legs), pal));
  const right = frames(H.headSide, H.bodySide, H.legsSide);
  return {
    down: frames(H.headDown, H.bodyFront, H.legsFront),
    up: frames(H.headUp, H.bodyFront, H.legsFront),
    right,
    left: right.map(LQ.flipSprite),
  };
};

// ------------------------------------------------------------ enemy art
// Each entry: rows + palette. Drawn 1x on the overworld, 2x in battle.
LQ.ENEMY_ART = {
  goose: {
    pal: { k: '#181820', b: '#26262e', w: '#f8f8f0', n: '#3a3a40', m: '#8a6a4a', d: '#4a3a2a', l: '#e0d4b8', y: '#2a2a2a', r: '#e04040' },
    rows: [
      '.....kkk................',
      '....kbbbk...............',
      '...kbrbbbk..............',
      'kkkbbwwwbk..............',
      'knnkbwwwbk..............',
      'kkk.kbbbbk..............',
      '.....kbbk...............',
      '.....kbbk...............',
      '.....kbbk...............',
      '.....kbbk......kkkk.....',
      '.....kbbkkkkkkkddddk....',
      '....kmmmmmmmmmmmdddk....',
      '...kmmmmmmmmmmmmmdddk...',
      '...kmmllmmmmmmmmmmddk...',
      '...kmllllmmmmmmmmmmdk...',
      '...kmlllllmmmmmmmmmk....',
      '....kllllllllmmmmmk.....',
      '.....kkllllllllkkk......',
      '.......kkkkkkkk.........',
      '........kyk..kyk........',
      '.......kyyk.kyyk........',
      '.......kkkk.kkkk........',
    ],
  },
  squirrel: {
    pal: { k: '#181820', m: '#9a6a3a', l: '#d8b088', d: '#6a4422', e: '#181820', w: '#f8f8f8', n: '#c86060' },
    rows: [
      '..............kkkk......',
      '.............kmmmmk.....',
      '............kmmddmmk....',
      '...kk......kmmdddmmmk...',
      '..kmmk....kmmdddddmmk...',
      '..kmmmkkk.kmmddddddmk...',
      '..kmwemmmkkmmddddddmk...',
      '.kmmeemmmmkmmmdddddmk...',
      'knmmmmmmmmkkmmmddddmk...',
      '.kkmmmmmmmk.kmmmdddmk...',
      '...kllllmmk.kmmmmmmk....',
      '...klllllmmkkmmmmmk.....',
      '...kllllllmmmmmmmk......',
      '...kllllllmmmmmmk.......',
      '...kkllllllmmmmmk.......',
      '....kllllllmmmmmk.......',
      '....kllllllmmmmmk.......',
      '....kmlllllmmmmk........',
      '...kmmkkkkkkmmmk........',
      '..kmmk.....kmmmmk.......',
      '..kkkk.....kkkkkk.......',
    ],
  },
  scooter: {
    pal: { k: '#181820', g: '#50d070', d: '#208040', s: '#b0b8c8', a: '#606878', w: '#f8f8f8', r: '#e03030', y: '#f8e040' },
    rows: [
      '..kkkkkkk...............',
      '..kgggggk...............',
      '..kkkkkkkk..............',
      '......kssk..............',
      '.....kssssk.............',
      '....kwwkwwk.............',
      '....kwkkwkk.............',
      '....kssssssk............',
      '....ksrrrrsk............',
      '.....kssssk.............',
      '......kssk..............',
      '......kssk..............',
      '......kssk..............',
      '......kssk..............',
      '......kssk..............',
      '......ksskkkkkkkkkkkk...',
      '......kgggggggggggggk...',
      '......kddddddddddddyk...',
      '....kkkkkkk.....kkkkkk..',
      '...kaaaaaaak...kaaaaaak.',
      '...kaksssakk...kaksssak.',
      '...kaaaaaaak...kaaaaaak.',
      '....kkkkkkk.....kkkkkk..',
    ],
  },
  book: {
    pal: { k: '#181820', r: '#c03838', d: '#802020', p: '#f0e8d0', l: '#c8c0a8', w: '#f8f8f8', e: '#181820', y: '#f8d040', f: '#f8f8f8' },
    rows: [
      '..kkkkkkkk..kkkkkkkk....',
      '.krrrrrrrrkkrrrrrrrrk...',
      'krrrrrrrrrrrrrrrrrrrrk..',
      'krrwwwkrrrrrrrrwwwkrrk..',
      'krrwwekrrrrrrrrwwekrrk..',
      'krrkkkkrrrrrrrrkkkkrrk..',
      'krrrrrrrrrrrrrrrrrrrrk..',
      'krrryyyyyyyyyyyyyyrrrk..',
      'krrrrrrrrrrrrrrrrrrrrk..',
      'krrkkkkkkkkkkkkkkkkrrk..',
      'krrkfkfkfkfkfkfkfkkrrk..',
      'krrkpppppppppppppppkrk..',
      'krrkpllllllllllllllkrk..',
      'krrkpppppppppppppppkrk..',
      'krrkfkfkfkfkfkfkfkfkrk..',
      'krrkkkkkkkkkkkkkkkkkrk..',
      'kdddddddddddddddddddddk.',
      '.kkkkkkkkkkkkkkkkkkkkk..',
    ],
  },
  drone: {
    pal: { k: '#181820', s: '#a8b0c0', a: '#606878', r: '#e03030', w: '#f8f8f8', y: '#f8e040', b: '#88c8f8' },
    rows: [
      'kkkkkkk.........kkkkkkk.',
      '...k...............k....',
      '..kak.............kak...',
      '..kakkkkkkkkkkkkkkkak...',
      '...kssssssssssssssk.....',
      '...ksbbbsssssssbbbsk....',
      '...ksbkbsssssssbkbsk....',
      '...ksbbbsssrsssbbbsk....',
      '...kssssssssssssssssk...',
      '....kaaaaaaaaaaaaaak....',
      '......kk.......kk.......',
      '.......kwwwwwwwk........',
      '.......kwyyyyywk........',
      '.......kwwwwwwwk........',
      '.......kwkkkkkwk........',
      '.......kwwwwwwwk........',
      '.......kwkkkwwwk........',
      '.......kwwwwwwwk........',
      '.......kkkkkkkkk........',
    ],
  },
  cloud: {
    pal: { k: '#181820', g: '#b8c0d0', d: '#7880a0', w: '#f8f8f8', e: '#181820', r: '#c03030', b: '#a0d8f8' },
    rows: [
      '.........kkkkk..........',
      '.......kkgggggkk........',
      '.....kkgggggggggkkkk....',
      '....kgggggggggggggggk...',
      '..kkggggggggggggggggkk..',
      '.kgggkkkgggggggkkkgggk..',
      'kggggkwekgggggkewkggggk.',
      'kgggggkkgggggggkkgggggk.',
      'kggggggggkkkkkggggggggk.',
      'kgggggggkrrrrrkgggggggk.',
      '.kdgggggkkkkkkkgggggdk..',
      '..kdddgggggggggggdddk...',
      '...kkkdddddddddddkkk....',
      '......kkkkkkkkkkk.......',
      '...b.......b.......b....',
      '..bwb.....bwb.....bwb...',
      '...b.......b.......b....',
      '.......b.......b........',
      '......bwb.....bwb.......',
      '.......b.......b........',
    ],
  },
  bell: {
    pal: { k: '#181820', y: '#d8a838', l: '#f8e080', d: '#8a6418', w: '#f8f8f8', e: '#181820', r: '#c02828', p: '#b060e0' },
    rows: [
      '..............kkkk..............',
      '.............kddddk.............',
      '.............kdkkdk.............',
      '...........kkkddddkkk...........',
      '.........kkyyyyyyyyyykk.........',
      '........kyyllyyyyyyyyyyk........',
      '.......kyyllyyyyyyyyyyyyk.......',
      '.......kylyyyyyyyyyyyyyyk.......',
      '......kyylyywwwyyyywwwyyyk......',
      '......kylyywwwekyykewwwyyk......',
      '......kylyyywwkkyykkwwyyyk......',
      '......kylyyyyyyyyyyyyyyyyk......',
      '.....kyylyyyyyyyyyyyyyyyyyk.....',
      '.....kylyyyykkkkkkkkkyyyyyk.....',
      '.....kylyyykrrrrrrrrrkyyyyk.....',
      '.....kylyyykrkwkkwkkrkyyyyk.....',
      '....kyylyyyykkkkkkkkkyyyyyyk....',
      '....kylyyyyyyyyyyyyyyyyyyyyk....',
      '....kylyyyyyyyyyyyyyyyyyyyyk....',
      '...kyylyyyyyyyyyyyyyyyyyyyyyk...',
      '...kylyyyyyyyyyyyyyyyyyyyyyyk...',
      '..kyylyyyyyyyyyyyyyyyyyyyyyyyk..',
      '..kylyyyyyyyyyyyyyyyyyyyyyyyyk..',
      '.kyylyyyyyyyyyyyyyyyyyyyyyyyyyk.',
      'kddddddddddddddddddddddddddddddk',
      'kddddddddddddddddddddddddddddddk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
      '..............kddk..............',
      '.............kddddk.............',
      '..............kkkk..............',
    ],
  },
};

LQ.enemySprites = {};
LQ.getEnemySprite = function (artKey, scale) {
  const key = artKey + '@' + (scale || 1);
  if (LQ.enemySprites[key]) return LQ.enemySprites[key];
  let spr;
  const art = LQ.ENEMY_ART[artKey];
  if (art) {
    spr = LQ.makeSprite(art.rows, art.pal, scale || 1);
  } else {
    // Human-shaped enemies reuse the character template.
    const human = LQ.HUMAN_ENEMIES[artKey];
    const ch = LQ.buildCharacter(human);
    const src = ch.down[0];
    spr = document.createElement('canvas');
    spr.width = src.width * (scale || 1);
    spr.height = src.height * (scale || 1);
    const cx = spr.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(src, 0, 0, spr.width, spr.height);
  }
  LQ.enemySprites[key] = spr;
  return spr;
};

LQ.HUMAN_ENEMIES = {
  sophomore: { hair: '#3a2a20', skin: '#b8d0a0', shirt: '#7a7a8a', pants: '#384868', shoes: '#282830' },
  mascot: { hat: '#0032a0', hair: '#0032a0', skin: '#d8e0f8', shirt: '#0032a0', pants: '#0032a0', shoes: '#f8f8f8' },
};

// Overworld-only sprites (no battle art needed).
LQ.makeSignSprite = function () {
  return LQ.makeSprite([
    '.kkkkkkkkkkkkkk.',
    'kwwwwwwwwwwwwwwk',
    'kwbbbbbbbbbbbbwk',
    'kwwwwwwwwwwwwwwk',
    'kwbbbbbbbbbbwwwk',
    'kwwwwwwwwwwwwwwk',
    '.kkkkkkkkkkkkkk.',
    '.......kk.......',
    '.......kk.......',
    '.......kk.......',
  ], { k: '#181820', w: '#f0f0f8', b: '#0032a0' });
};

LQ.makePhoneSprite = function () {
  return LQ.makeSprite([
    '..kkkkkkkkkk....',
    '.kssssssssssk...',
    '.kskkkkkkkksk...',
    '.ksk.gggg.ksk...',
    '.kskkkkkkkksk...',
    '.kssssssssssk...',
    '.kswkwkwkssskk..',
    '.kssssssssssk.k.',
    '.kswkwkwksssk.k.',
    '.kssssssssssk.k.',
    '.kswkwkwksssk.k.',
    '.kssssssssssk.k.',
    '..kkkkkkkkkk..k.',
    '..............k.',
  ], { k: '#181820', s: '#c8c8d0', w: '#f8f8f8', g: '#70e070' });
};

LQ.makeChestSprite = function () {
  return LQ.makeSprite([
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwk.',
    '.kwrrrrrrrrrrwk.',
    '.kwrrrrrrrrrrwk.',
    '.kwwwwwwwwwwwwk.',
    '.kbbbbbkkbbbbbk.',
    '.kbbbbbyybbbbbk.',
    '.kbbbbbkkbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '..kkkkkkkkkkkk..',
  ], { k: '#181820', w: '#f8f8f8', r: '#e06080', b: '#f0a0b8', y: '#f8e040' });
};
