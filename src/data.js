// Game content: stats, items, PSI, enemies, NPCs, interiors and story flags.
window.LQ = window.LQ || {};

// Total experience needed to *reach* each level (index = level).
LQ.EXP_TABLE = [0, 0, 12, 32, 64, 110, 175, 260, 370, 510, 690, 920, 1200, 1550, 2000];
LQ.MAX_LEVEL = LQ.EXP_TABLE.length - 1;

LQ.newPlayer = function (name) {
  return {
    name: name || 'Laker',
    level: 1, exp: 0, money: 20,
    maxHp: 34, hp: 34, maxPp: 12, pp: 12,
    off: 8, def: 5, spd: 6,
    psi: [],
    goods: ['cookie', 'cookie', 'coffee'],
    equipped: {},
  };
};

LQ.LEVEL_UP = { hp: [6, 9], pp: [2, 4], off: [2, 3], def: [1, 2], spd: [1, 2] };
LQ.PSI_LEARN = { 2: 'lifeup_a', 3: 'laker_a', 5: 'shield_a', 6: 'laker_b', 7: 'lifeup_b' };

// ------------------------------------------------------------ PSI
LQ.PSI = {
  lifeup_a: { name: 'Lifeup α', pp: 5, kind: 'heal', amount: [28, 38], text: 'A gentle warmth spreads through you.' },
  lifeup_b: { name: 'Lifeup β', pp: 10, kind: 'heal', amount: [85, 100], text: 'You feel a soothing Laker-blue light.' },
  laker_a: { name: 'PSI Laker α', pp: 6, kind: 'attack', amount: [26, 36], text: 'A wave of Laker blue crashes down!' },
  laker_b: { name: 'PSI Laker β', pp: 12, kind: 'attack', amount: [62, 80], text: 'A tidal wave of Lake Michigan water appears!' },
  shield_a: { name: 'Shield α', pp: 6, kind: 'shield', text: 'A shimmering shield surrounds you!' },
};

// ------------------------------------------------------------ goods
// kind: heal | pp | both | attack | equip | key
LQ.ITEMS = {
  cookie: { name: 'Cookie', kind: 'heal', hp: 8, price: 4, desc: 'A chocolate chip cookie. Still warm-ish.' },
  apple: { name: 'Michigan Apple', kind: 'heal', hp: 16, price: 6, desc: 'Crisp. Grown about 20 miles from here.' },
  pizza: { name: 'Pizza Slice', kind: 'heal', hp: 30, price: 12, desc: 'A big floppy slice of pepperoni.' },
  sub: { name: 'Sub Sandwich', kind: 'heal', hp: 60, price: 24, desc: 'A footlong. Fuel for finals week.' },
  coffee: { name: 'Coffee', kind: 'pp', pp: 10, price: 8, desc: 'Strong coffee. Restores PP.' },
  energy: { name: 'Energy Drink', kind: 'both', hp: 20, pp: 8, price: 16, desc: 'Tastes like a battery. Works, though.' },
  rocket: { name: 'Bottle Rocket', kind: 'attack', damage: [28, 40], price: 18, desc: 'Fire it at an enemy. Battle only.' },
  hoodie: { name: 'GVSU Hoodie', kind: 'equip', slot: 'body', def: 4, price: 40, desc: 'Laker blue. Defense +4.' },
  bat: { name: 'Laker Baseball Bat', kind: 'equip', slot: 'weapon', off: 6, price: 0, desc: 'Signed by the team. Offense +6.' },
  cap: { name: 'Laker Cap', kind: 'equip', slot: 'head', def: 5, price: 0, desc: 'A Laker blue ball cap. Defense +5.' },
  stamp_bell: { name: 'Carillon Stamp', kind: 'key', desc: 'A passport stamp of the Cook Carillon Tower.' },
  stamp_pond: { name: 'Pond Stamp', kind: 'key', desc: 'A passport stamp of Zumberge Pond. There is a goose in it.' },
  stamp_stadium: { name: 'Stadium Stamp', kind: 'key', desc: 'A passport stamp of Lubbers Stadium.' },
  goggles: { name: 'Lab Goggles', kind: 'equip', slot: 'head', def: 3, price: 0, desc: 'Safety first! Defense +3.' },
  pin: { name: 'Laker Pin', kind: 'equip', slot: 'charm', off: 2, def: 2, price: 0, desc: 'A library staff pin. Offense +2, Defense +2.' },
  jersey: { name: 'Laker Jersey', kind: 'equip', slot: 'body', def: 7, price: 0, desc: 'A real game jersey. Defense +7.' },
  lakercard: { name: 'Lakercard', kind: 'key', desc: 'Someone\'s student ID. The photo looks very tired.' },
  gameball: { name: 'Game Ball', kind: 'key', desc: 'The football from Lubbers Stadium. Slightly chewed.' },
  score: { name: 'Carillon Score', kind: 'key', desc: 'Sheet music for the Cook Carillon. The melody feels important.' },
  key: { name: 'Tower Key', kind: 'key', desc: 'An old brass key labeled "CARILLON".' },
};

// ------------------------------------------------------------ enemies
// bg: battle background {pattern, colors, dist, speed}
LQ.ENEMIES = {
  squirrel: {
    name: 'Spiteful Squirrel', art: 'squirrel', level: 1, hp: 14, off: 6, def: 2, spd: 9, exp: 4, money: 3, drop: ['apple', 0.15],
    bg: { pattern: 'stripes', colors: ['#f8c060', '#f87830', '#a83818'], dist: 'horiz', speed: 1 },
    actions: [
      { text: 'bites you!', power: 1.0 },
      { text: 'throws an acorn at you!', power: 0.8 },
      { text: 'chatters angrily. Nothing happened.', power: 0 },
    ],
  },
  goose: {
    name: 'Ornery Goose', art: 'goose', level: 2, hp: 24, off: 9, def: 4, spd: 7, exp: 8, money: 5, drop: ['cookie', 0.2],
    bg: { pattern: 'waves', colors: ['#88e0f8', '#3888d8', '#183878'], dist: 'horiz', speed: 1.5 },
    actions: [
      { text: 'charges with its wings out!', power: 1.2 },
      { text: 'pecks you!', power: 1.0 },
      { text: 'honks a terrible honk! It echoes across Zumberge Pond.', power: 0 },
    ],
  },
  book: {
    name: 'Overdue Book', art: 'book', level: 3, hp: 30, off: 11, def: 6, spd: 4, exp: 13, money: 9, drop: ['coffee', 0.2],
    bg: { pattern: 'checker', colors: ['#f8e8b0', '#c89858', '#704828'], dist: 'interlace', speed: 1 },
    actions: [
      { text: 'slams shut on you!', power: 1.1 },
      { text: 'flutters its pages menacingly.', power: 0 },
      { text: 'demands a late fee!', power: 0, steal: 3 },
    ],
  },
  scooter: {
    name: 'Runaway Scooter', art: 'scooter', level: 3, hp: 26, off: 12, def: 5, spd: 15, exp: 12, money: 10, drop: ['energy', 0.15],
    bg: { pattern: 'rings', colors: ['#a0f8a0', '#30c060', '#105830'], dist: 'horiz', speed: 2 },
    actions: [
      { text: 'zooms straight into you!', power: 1.3 },
      { text: 'beeps: "Battery low." Nothing happened.', power: 0 },
      { text: 'runs over your foot!', power: 0.9 },
    ],
  },
  sophomore: {
    name: 'Sleepless Sophomore', art: 'sophomore', level: 4, hp: 38, off: 12, def: 7, spd: 5, exp: 17, money: 14, drop: ['coffee', 0.3],
    bg: { pattern: 'dots', colors: ['#d0b0f8', '#8858d0', '#382068'], dist: 'vert', speed: 1 },
    actions: [
      { text: 'swings a heavy backpack!', power: 1.15 },
      { text: 'mumbles about an 8 a.m. class.', power: 0 },
      { text: 'yawns. It is contagious. You feel sleepy...', power: 0.4 },
    ],
  },
  drone: {
    name: 'Parking Ticket Drone', art: 'drone', level: 5, hp: 42, off: 14, def: 8, spd: 12, exp: 23, money: 18, drop: ['rocket', 0.2],
    bg: { pattern: 'stripes', colors: ['#f8f870', '#f8a830', '#383838'], dist: 'interlace', speed: 2 },
    actions: [
      { text: 'writes you a parking ticket!', power: 1.2 },
      { text: 'scans for your parking permit...', power: 0 },
      { text: 'divebombs you!', power: 1.4 },
    ],
  },
  cloud: {
    name: 'Lake-Effect Cloud', art: 'cloud', level: 6, hp: 56, off: 15, def: 8, spd: 9, exp: 31, money: 20, drop: ['energy', 0.25],
    bg: { pattern: 'rings', colors: ['#f8f8f8', '#a8c8e8', '#486890'], dist: 'vert', speed: 1.2 },
    actions: [
      { text: 'dumps a foot of lake-effect snow on you!', power: 1.4 },
      { text: 'rumbles ominously.', power: 0 },
      { text: 'whips up a freezing wind!', power: 1.1 },
    ],
  },
  mascot: {
    name: 'Hollow Costume', art: 'mascot', level: 6, hp: 62, off: 17, def: 9, spd: 8, exp: 35, money: 24, drop: ['sub', 0.25],
    bg: { pattern: 'checker', colors: ['#88a8f8', '#0032a0', '#f8f8f8'], dist: 'horiz', speed: 1.5 },
    actions: [
      { text: 'does an aggressively spirited cheer!', power: 1.3 },
      { text: 'flops around. Nobody is inside...', power: 0 },
      { text: 'tackles you like it is fourth down!', power: 1.5 },
    ],
  },
  bell: {
    name: 'Discordant Carillon', art: 'bell', level: 9, hp: 320, off: 19, def: 12, spd: 10, exp: 220, money: 120, boss: true,
    bg: { pattern: 'rings', colors: ['#f8d870', '#c03070', '#300850'], dist: 'interlace', speed: 2.5 },
    actions: [
      { text: 'tolls a sour note! The sound rattles your bones!', power: 1.4 },
      { text: 'chimes thirteen o\'clock! Time feels wrong.', power: 1.0 },
      { text: 'is swaying back and forth...', power: 0 },
      { text: 'BONGS with all of its might!', power: 2.0, rare: true },
    ],
  },
};

// Where enemies wander on campus: {type, img: [x0, y0, x1, y1] in campus map
// image pixels (see campus.js), count}.
LQ.SPAWNS = [
  { type: 'squirrel', img: [415, 85, 535, 230], count: 8 },
  { type: 'squirrel', img: [416, 292, 482, 334], count: 3 },
  { type: 'squirrel', img: [330, 80, 410, 140], count: 2 },
  { type: 'goose', img: [390, 335, 432, 372], count: 4 },
  { type: 'goose', img: [400, 360, 470, 410], count: 3 },
  { type: 'scooter', img: [330, 150, 410, 330], count: 3 },
  { type: 'scooter', img: [330, 380, 420, 470], count: 2 },
  { type: 'book', img: [340, 300, 430, 400], count: 3 },
  { type: 'sophomore', img: [255, 420, 350, 512], count: 4 },
  { type: 'sophomore', img: [365, 420, 475, 600], count: 4 },
  { type: 'drone', img: [255, 330, 340, 430], count: 3 },
  { type: 'drone', img: [430, 66, 538, 110], count: 2 },
  { type: 'cloud', img: [470, 225, 536, 300], count: 3 },
  { type: 'cloud', img: [500, 300, 538, 500], count: 2 },
  { type: 'mascot', img: [222, 100, 330, 270], count: 3 },
  { type: 'mascot', img: [150, 340, 262, 420], count: 2 },
];

// ------------------------------------------------------------ people
// look: colors for the character template.
LQ.LOOKS = {
  player: { hat: '#0032a0', hair: '#4a3020', skin: '#f4c8a0', shirt: '#f8f8f8', pants: '#0032a0', shoes: '#e04040' },
  ra: { hair: '#d8a848', skin: '#f4c8a0', shirt: '#30a060', pants: '#384868' },
  prof: { hair: '#c8c8c8', skin: '#e8b890', shirt: '#7a5a3a', pants: '#3a3a48' },
  librarian: { hair: '#281818', skin: '#9a6440', shirt: '#b04878', pants: '#2a2a38' },
  clerk: { hair: '#5a3a20', skin: '#f4c8a0', shirt: '#d0d0e0', pants: '#4a4a58' },
  coach: { hat: '#0032a0', hair: '#0032a0', skin: '#c88858', shirt: '#0032a0', pants: '#a8a8b8' },
  scientist: { hair: '#e8e8e8', skin: '#f4c8a0', shirt: '#f8f8f8', pants: '#3a5a8a' },
  cook: { hat: '#f8f8f8', hair: '#f8f8f8', skin: '#b07848', shirt: '#f8f8f8', pants: '#383838' },
  barista: { hair: '#a03020', skin: '#f4c8a0', shirt: '#2a6a3a', pants: '#2a2a2a' },
  student1: { hair: '#181818', skin: '#8a5a38', shirt: '#e05050', pants: '#3a4a7a' },
  student2: { hair: '#e8c868', skin: '#f8d0b0', shirt: '#7068d8', pants: '#5a5a5a' },
  student3: { hair: '#6a3a1a', skin: '#e0a878', shirt: '#f0c040', pants: '#2a3a5a' },
  student4: { hat: '#e05050', hair: '#2a1a10', skin: '#c08860', shirt: '#0032a0', pants: '#d8d0c0' },
  guide: { hair: '#a86030', skin: '#f4c8a0', shirt: '#0032a0', pants: '#d8c8a8' },
  roommate: { hair: '#f0a040', skin: '#f8d0b0', shirt: '#9050c0', pants: '#4a4a5a' },
  groundskeeper: { hat: '#e08030', hair: '#5a5a5a', skin: '#e0a878', shirt: '#e08030', pants: '#3a4a3a' },
  kid: { hat: '#e04040', hair: '#4a3020', skin: '#f4c8a0', shirt: '#f0e040', pants: '#4060c0' },
  neighbor: { hair: '#8a6a4a', skin: '#e0a878', shirt: '#c05050', pants: '#5a5a48', shoes: '#383028' },
  louie: { hat: '#0032a0', hair: '#0032a0', skin: '#f8f8f8', shirt: '#0032a0', pants: '#0032a0', shoes: '#f8f8f8' },
};

// talk(game) returns an array of lines, or calls game helpers for actions.
// Lines starting with '@' are speaker-less narration.
LQ.NPCS = [
  // ---------- campus: north housing
  { id: 'ra', map: 'campus', img: [478, 146], look: 'ra', dir: 'down', name: 'RA Jordan',
    talk: (g) => {
      if (!g.flags.talkedRA) {
        g.flags.talkedRA = true;
        return [
          'Hey, ' + g.player.name + '! You slept through the whole thing?',
          'Last night at midnight the Cook Carillon rang THIRTEEN times. Out of tune, too.',
          'Ever since, campus has been... off. Squirrels picking fights. The geese are worse than usual. Which I didn\'t think was possible.',
          'Dr. Vanderwal from the physics department was asking for "a brave student" over at the Kirkhof Center.',
          'Kirkhof is southwest of here, in the middle of campus. Take North Campus Drive south. Kirkhof sits right next to the library, by the Cook Carillon.',
          '@(Press M to see the campus map.)',
        ];
      }
      if (g.flags.bossBeaten) return ['You fixed the bells?! I\'m putting this in the floor newsletter.'];
      return ['Kirkhof Center is southwest, in the middle of campus, next to the library. Be careful out there!', 'If you get hurt, Kleiner Commons has food. It\'s just southwest of here.'];
    } },
  { id: 'st1', map: 'campus', img: [440, 158], look: 'student1', dir: 'left', wander: true,
    talk: () => ['I heard the Fieldhouse coach is giving away gear to anybody brave enough to go outside.', 'The Fieldhouse is west of North Campus Drive, across from the D lots. Big building, you can\'t miss it.'] },
  { id: 'guide', map: 'campus', img: [350, 118], look: 'guide', dir: 'down', name: 'Tour Guide',
    talk: (g) => {
      g.flags.metGuide = true;   // unlocks the Laker Passport quest
      return [
        'Welcome to Grand Valley! Let me orient you.',
        'You\'re at the north entrance. Lake Michigan Drive, M-45, runs along the north edge of campus.',
        'The Grand River is to the east, past the ravines and the boathouse. Athletics are to the west: Lubbers Stadium, Kelly Family Sports Center, the Fieldhouse. The Meadows golf course is past the stadium.',
        'Academic buildings are in the middle. Housing is at the north end, here, and the south end: Laker Village, Niemeyer, the South Apartments and GVA down by Pierce Street.',
        'And the Cook Carillon Tower is right in the center, just north of Kirkhof, between the library and Cook-DeWitt.',
      ];
    } },
  // ---------- athletics
  { id: 'jock', map: 'campus', img: [262, 150], look: 'student4', dir: 'left', wander: true,
    talk: () => ['The stadium is haunted now. Well, haunted-ish. Our mascot costume is walking around WITHOUT anybody in it.', 'Anchor Up, I guess?'] },
  { id: 'golfer', map: 'campus', img: [195, 200], look: 'student2', dir: 'down',
    talk: () => ['Fore! ...Oh, sorry. I thought you were a squirrel.', 'They keep stealing my golf balls. I think they\'re organized.'] },
  // ---------- core
  { id: 'bridgekid', map: 'campus', img: [414, 280], look: 'student3', dir: 'up', wander: true,
    talk: () => ['That\'s the Little Mac Bridge. It crosses the ravine from the Padnos side over to the Arboretum.', 'Keep going south past Au Sable Hall and you hit Great Lakes Plaza.'] },
  { id: 'grounds', map: 'campus', img: [398, 364], look: 'groundskeeper', dir: 'right', name: 'Groundskeeper',
    talk: (g) => g.flags.bossBeaten
      ? ['The geese have calmed down. Relatively speaking.']
      : ['Don\'t go near the pond unless you\'re ready to scrap with a goose.', 'They hatched here. They think they own the place. Honestly? They might.'] },
  { id: 'st2', map: 'campus', img: [372, 374], look: 'student2', dir: 'down', wander: true,
    talk: () => ['I had a book in my backpack and it just... flew away. Toward the library. It was overdue, I guess.'] },
  { id: 'st3', map: 'campus', img: [405, 470], look: 'student1', dir: 'down', wander: true,
    talk: () => ['Everybody in south campus housing is up all night. The bells keep ringing at random times.', 'Some of the sophomores have gone feral.'] },
  { id: 'fisher', map: 'campus', img: [560, 114], look: 'groundskeeper', dir: 'right',
    talk: () => ['The Grand River. Flows all the way from Jackson down to Grand Haven and into Lake Michigan.', 'The ravines on campus all drain down here. Lately it\'s been snowing on just this one spot. In September.'] },
  // ---------- Allendale
  { id: 'neighbor', map: 'campus', tile: [50, 93], look: 'neighbor', dir: 'down', name: 'Neighbor',
    talk: () => ['Allendale\'s quiet. Well, it was, until the bells started going off at midnight.'] },
  // ---------- interiors
  { id: 'roommate', map: 'frey', x: 8, y: 4, look: 'roommate', dir: 'down', name: 'Roommate',
    talk: (g) => g.flags.talkedRA
      ? ['The RA said Kirkhof? Go! I\'ll hold down the fort. And by "fort" I mean "bed".']
      : ['Ugh, the bells woke me up at midnight. Thirteen times!', 'Our RA was looking for you. Jordan\'s right outside.'] },
  { id: 'prof', map: 'kirkhof', x: 6, y: 4, look: 'prof', dir: 'down', name: 'Dr. Vanderwal',
    talk: (g) => {
      if (g.flags.bossBeaten) return ['Remarkable work. The carillon is perfectly in tune. I\'ll be writing a paper about this. You\'ll be in the acknowledgments!'];
      if (!g.flags.metProf) {
        g.flags.metProf = true;
        return [
          'Ah! A student who is awake. Good.',
          'Listen. The Cook Carillon has 48 bronze bells. Last night they began ringing a melody that should not exist.',
          'Something has taken root in that tower. It is broadcasting discord across campus. Hence the geese.',
          'To set it right, you need two things.',
          'First, the original Carillon Score. The library keeps it in special collections. Ask at the Mary Idema Pew Library, right next door to the west.',
          'Second, the Tower Key. That\'s held by the office in Zumberge Hall, just east of here across Zumberge Pond.',
          'Get both, climb the tower, and play the true melody. It should... "re-tune" whatever is in there.',
          'Good luck. I would go myself, but I have office hours.',
        ];
      }
      if (!g.has('score')) return ['The library is right next door, to the west. Ask about the Carillon Score.'];
      if (!g.has('key')) return ['You have the score! Now the Tower Key. Zumberge Hall, east across the pond.'];
      return ['You have both! The tower is just north of Kirkhof, between the library and Cook-DeWitt. When you face it... use the score.'];
    } },
  { id: 'barista', map: 'kirkhof', x: 15, y: 3, look: 'barista', dir: 'down', name: 'Barista',
    talk: (g) => { g.offerInn('A large latte is $8. It fully restores HP and PP. Want one?', 8); return null; } },
  { id: 'shopkeep', map: 'kirkhof', x: 11, y: 3, look: 'clerk', dir: 'down', name: 'Campus Store',
    talk: (g) => { g.openShop('Welcome to the campus store!', ['cookie', 'pizza', 'coffee', 'energy', 'rocket', 'hoodie']); return null; } },
  { id: 'kstudent', map: 'kirkhof', x: 4, y: 8, look: 'student3', dir: 'right', wander: true,
    talk: () => ['Kirkhof is the student center. Food, study spots, and the campus store.', 'There\'s a phone over there. You can call home to save your progress.'] },
  { id: 'librarian', map: 'library', x: 9, y: 4, look: 'librarian', dir: 'down', name: 'Librarian',
    talk: (g) => {
      if (g.has('score') || g.flags.bossBeaten) return ['Shh. ...Okay, a little noise is fine. You did save campus, after all.'];
      if (!g.flags.metProf) return ['Welcome to the Mary Idema Pew Library. Please keep your voice down.', 'Also, some of our books have become... aggressive. Please keep your distance.'];
      g.giveItem('score');
      return [
        'The Carillon Score? Dr. Vanderwal called ahead.',
        'Here it is. It\'s the original arrangement, from when the tower was built in 1994.',
        '@' + g.player.name + ' received the Carillon Score!',
        'Please return it when you\'re done. And watch out for the overdue books on your way out.',
      ];
    } },
  { id: 'libstudent', map: 'library', x: 4, y: 9, look: 'student2', dir: 'up',
    talk: () => ['Shhhhh.', '...', 'The books started moving on their own around midnight. I\'ve been hiding in this study room since.'] },
  { id: 'registrar', map: 'zumberge', x: 7, y: 4, look: 'clerk', dir: 'down', name: 'Office Clerk',
    talk: (g) => {
      if (g.has('key') || g.flags.bossBeaten) return ['Please return the Tower Key when you\'re done. There\'s a form for that, too.'];
      if (!g.has('score')) return ['Tower Key? I can\'t release that without a valid reason.', 'Come back with proof you\'re on official carillon business. I don\'t know, sheet music or something.'];
      g.giveItem('key');
      return [
        'You have the Carillon Score? Then you\'re on official carillon business.',
        'Sign here... and here... and initial here...',
        '@' + g.player.name + ' received the Tower Key!',
        'The tower door is at the base, facing south. Good luck.',
      ];
    } },
  { id: 'coach', map: 'fieldhouse', x: 9, y: 4, look: 'coach', dir: 'down', name: 'Coach',
    talk: (g) => {
      if (g.flags.gotBat) return ['Keep your elbow up when you swing!'];
      g.flags.gotBat = true;
      g.giveItem('bat');
      return ['You\'re heading out there with all those critters? Take this.', '@' + g.player.name + ' received the Laker Baseball Bat! (It goes in your Goods. Use it to equip it.)'];
    } },
  { id: 'gymrat', map: 'fieldhouse', x: 4, y: 8, look: 'student4', dir: 'right', wander: true,
    talk: () => ['The Rec Center is open late. Just not THIS late.'] },
  { id: 'scientist', map: 'padnos', x: 7, y: 4, look: 'scientist', dir: 'down', name: 'Lab Tech',
    talk: (g) => {
      if (g.flags.gotGoggles) return ['Remember: safety first. And second.'];
      g.flags.gotGoggles = true;
      g.giveItem('goggles');
      return ['You\'re going to investigate the tower? You\'ll need eye protection. Obviously.', '@' + g.player.name + ' received the Lab Goggles!'];
    } },
  { id: 'cook', map: 'kleiner', x: 8, y: 3, look: 'cook', dir: 'down', name: 'Dining Staff',
    talk: (g) => { g.fullHeal(); return ['You look hungry! Here, have a plate. On the house.', '@' + g.player.name + '\'s HP and PP were fully restored!']; } },
  { id: 'kleinerst', map: 'kleiner', x: 4, y: 7, look: 'student1', dir: 'right', wander: true,
    talk: () => ['Kleiner\'s the dining spot for north campus. Down south there\'s the Blue Connection.'] },
  { id: 'alumni', map: 'alumni', x: 6, y: 4, look: 'guide', dir: 'down', name: 'Visitor Center',
    talk: (g) => {
      if (!g.flags.gotCookies) { g.flags.gotCookies = true; g.giveItem('cookie'); g.giveItem('cookie'); return ['Welcome to the Alumni House and Visitor Center! Have some cookies.', '@' + g.player.name + ' received 2 Cookies!']; }
      return ['Fun fact: Grand Valley was founded in 1960. The first classes were held in 1963.'];
    } },
];

// ------------------------------------------------------------ interiors
// Exit leads back to the building door on campus.
LQ.INTERIORS = {
  frey: { id: 'frey', name: 'Frey Living Center', w: 12, h: 9, floor: 'carpet', phone: { x: 2, y: 2 },
    furniture: [{ type: 'bed', x: 1, y: 2, w: 2, h: 3 }, { type: 'bed', x: 9, y: 2, w: 2, h: 3 }, { type: 'desk', x: 4, y: 2, w: 2, h: 1 }, { type: 'plant', x: 10, y: 6, w: 1, h: 1 }] },
  kleiner: { id: 'kleiner', name: 'Kleiner Commons', w: 16, h: 10, floor: 'tile', phone: null,
    furniture: [{ type: 'counter', x: 5, y: 2, w: 7, h: 1 }, { type: 'table', x: 3, y: 5, w: 2, h: 1 }, { type: 'table', x: 7, y: 5, w: 2, h: 1 }, { type: 'table', x: 11, y: 5, w: 2, h: 1 }, { type: 'table', x: 11, y: 7, w: 2, h: 1 }] },
  kirkhof: { id: 'kirkhof', name: 'Kirkhof Center', w: 20, h: 12, floor: 'tile', phone: { x: 18, y: 8 },
    furniture: [{ type: 'counter', x: 10, y: 2, w: 3, h: 1 }, { type: 'counter', x: 14, y: 2, w: 3, h: 1 }, { type: 'machine', x: 17, y: 2, w: 1, h: 1 }, { type: 'table', x: 8, y: 6, w: 2, h: 1 }, { type: 'table', x: 12, y: 6, w: 2, h: 1 }, { type: 'table', x: 12, y: 8, w: 2, h: 1 }, { type: 'plant', x: 1, y: 2, w: 1, h: 1 }, { type: 'plant', x: 18, y: 10, w: 1, h: 1 }] },
  library: { id: 'library', name: 'Mary Idema Pew Library', w: 20, h: 14, floor: 'carpet', phone: null,
    furniture: [{ type: 'counter', x: 7, y: 2, w: 5, h: 1 }, { type: 'shelf', x: 2, y: 5, w: 4, h: 1 }, { type: 'shelf', x: 14, y: 5, w: 4, h: 1 }, { type: 'shelf', x: 2, y: 7, w: 4, h: 1 }, { type: 'shelf', x: 14, y: 7, w: 4, h: 1 }, { type: 'shelf', x: 14, y: 9, w: 4, h: 1 }, { type: 'table', x: 8, y: 7, w: 4, h: 1 }, { type: 'desk', x: 2, y: 10, w: 2, h: 1 }, { type: 'plant', x: 1, y: 2, w: 1, h: 1 }],
    enemies: [{ type: 'book', count: 3 }] },
  zumberge: { id: 'zumberge', name: 'Zumberge Hall', w: 14, h: 10, floor: 'wood', phone: { x: 12, y: 6 },
    furniture: [{ type: 'counter', x: 4, y: 2, w: 6, h: 1 }, { type: 'desk', x: 1, y: 5, w: 2, h: 1 }, { type: 'desk', x: 11, y: 3, w: 2, h: 1 }, { type: 'plant', x: 1, y: 2, w: 1, h: 1 }] },
  fieldhouse: { id: 'fieldhouse', name: 'Fieldhouse & Recreation Center', w: 18, h: 12, floor: 'wood', phone: { x: 16, y: 9 },
    furniture: [{ type: 'counter', x: 7, y: 2, w: 5, h: 1 }, { type: 'gym', x: 2, y: 4, w: 2, h: 1 }, { type: 'gym', x: 2, y: 6, w: 2, h: 1 }, { type: 'gym', x: 14, y: 4, w: 2, h: 1 }, { type: 'gym', x: 14, y: 6, w: 2, h: 1 }] },
  padnos: { id: 'padnos', name: 'Padnos Hall of Science', w: 14, h: 10, floor: 'tile', phone: null,
    furniture: [{ type: 'desk', x: 2, y: 2, w: 2, h: 1 }, { type: 'desk', x: 10, y: 2, w: 2, h: 1 }, { type: 'table', x: 4, y: 6, w: 6, h: 1 }, { type: 'machine', x: 12, y: 6, w: 1, h: 1 }] },
  alumni: { id: 'alumni', name: 'Alumni House & Visitor Center', w: 12, h: 9, floor: 'wood', phone: { x: 10, y: 3 },
    furniture: [{ type: 'counter', x: 4, y: 2, w: 4, h: 1 }, { type: 'plant', x: 1, y: 2, w: 1, h: 1 }, { type: 'table', x: 2, y: 5, w: 2, h: 1 }] },
};
