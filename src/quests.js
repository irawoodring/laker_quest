// Side quests. Each quest is self-contained: who gives it, what you have to
// do, what it pays, and what the giver says at each stage.
//
// To add a quest, add an entry to LQ.QUESTS. The fields:
//   id, title       Shown in the quest log (X menu -> Quests).
//   giver           NPC id (from LQ.NPCS in data.js). Talking to them runs talk().
//   available(g)    Optional. Return false to hide the quest until something
//                   else has happened (for example, a main-story flag).
//   goal            One line per step, shown in the quest log.
//   reward          { exp, money, items: [...] } paid by g.completeQuest().
//   talk(g, q)      Returns the giver's lines (or null to fall back to their
//                   normal dialogue). q.step is undefined before the quest
//                   starts, then 0, 1, ... and 'done' afterwards.
//
// Helpers on g (the game) for quest scripts:
//   g.startQuest(id)           start at step 0
//   g.setQuestStep(id, n)      move to step n
//   g.completeQuest(id)        pay the reward; returns lines describing it
//   g.questKills(id, type)     enemies of `type` beaten since the quest started
//   g.has(item) / g.giveItem(item) / g.takeItem(item)
//
// Items to find on the map go in LQ.PICKUPS (bottom of this file).
window.LQ = window.LQ || {};

LQ.QUESTS = [
  {
    id: 'goose',
    title: 'Goose Diplomacy',
    giver: 'grounds',
    goal: ['Defeat 3 Ornery Geese around Zumberge Pond.', 'Report back to the Groundskeeper.'],
    reward: { exp: 20, money: 30, items: ['sub'] },
    talk(g, q) {
      if (q.step === undefined) {
        g.startQuest('goose');
        return [
          'Hey, you look like you can handle yourself.',
          'The geese at Zumberge Pond have gone from rude to downright hostile. I can\'t even mow.',
          'Settle down three of them for me, would you? Nobody gets hurt. Mostly.',
          '@(New quest: Goose Diplomacy)',
        ];
      }
      if (q.step === 0) {
        const n = g.questKills('goose', 'goose');
        if (n < 3) return ['Geese settled so far: ' + n + ' of 3. They\'re all around the pond.'];
        g.setQuestStep('goose', 1);
      }
      if (q.step === 0 || q.step === 1) {
        return ['Three geese! The pond is almost peaceful.', 'Here, take my lunch. I wasn\'t going to eat it with geese watching anyway.'].concat(g.completeQuest('goose'));
      }
      return null;
    },
  },
  {
    id: 'lakercard',
    title: 'The Lost Lakercard',
    giver: 'kstudent',
    goal: ['Find the Lakercard dropped near the Transformational Link.', 'Bring the Lakercard back to the student in Kirkhof.'],
    reward: { exp: 20, money: 40, items: ['energy', 'energy'] },
    talk(g, q) {
      if (q.step === undefined) {
        g.startQuest('lakercard');
        return [
          'Oh no oh no oh no. I lost my Lakercard.',
          'I had it when I walked under the Transformational Link, by the Little Mac Bridge. Then a squirrel looked at me funny and I ran.',
          'Could you look for it? I can\'t get into my dorm without it.',
          '@(New quest: The Lost Lakercard)',
        ];
      }
      if (q.step === 0) return ['It has to be somewhere near the Transformational Link. That big steel arch south of the Little Mac Bridge.'];
      if (q.step === 1 && g.has('lakercard')) {
        g.takeItem('lakercard');
        return ['My Lakercard! You found it!', 'I owe you. Here, I bought these during finals week and never drank them.'].concat(g.completeQuest('lakercard'));
      }
      return null;
    },
  },
  {
    id: 'overdue',
    title: 'Overdue Notice',
    giver: 'librarian',
    available: (g) => g.has('score') || g.flags.bossBeaten,
    goal: ['Defeat 4 Overdue Books (in and around the library).', 'Report back to the Librarian.'],
    reward: { exp: 45, money: 20, items: ['pin'] },
    talk(g, q) {
      if (q.step === undefined) {
        g.startQuest('overdue');
        return [
          'One more thing, since you seem capable.',
          'Some of our overdue books have been terrorizing patrons. Inside the library and out on the lawns.',
          'Please... return four of them. Forcefully, if necessary.',
          '@(New quest: Overdue Notice)',
        ];
      }
      if (q.step === 0) {
        const n = g.questKills('overdue', 'book');
        if (n < 4) return ['Books returned: ' + n + ' of 4. Shh, they\'ll hear you coming.'];
        g.setQuestStep('overdue', 1);
      }
      if (q.step === 0 || q.step === 1) {
        return ['Four books, all accounted for. No late fees, just this once.', 'Take this pin. Staff only, but I\'ll make an exception.'].concat(g.completeQuest('overdue'));
      }
      return null;
    },
  },
  {
    id: 'gameball',
    title: 'Fourth and Long',
    giver: 'coach',
    available: (g) => !!g.flags.gotBat,
    goal: ['Find the game ball somewhere on the field at Lubbers Stadium.', 'Bring the game ball back to the Coach in the Fieldhouse.'],
    reward: { exp: 40, money: 25, items: ['jersey'] },
    talk(g, q) {
      if (q.step === undefined) {
        g.startQuest('gameball');
        return [
          'While you\'re out there... we lost the game ball.',
          'Some empty mascot costume ran off with it at Lubbers Stadium last night. Don\'t ask.',
          'It\'s got to still be on the field somewhere. Find it and I\'ll make it worth your while.',
          '@(New quest: Fourth and Long)',
        ];
      }
      if (q.step === 0) return ['Lubbers Stadium is just north of here. Check the field.'];
      if (q.step === 1 && g.has('gameball')) {
        g.takeItem('gameball');
        return ['That\'s our ball! Look at those laces.', 'You\'ve earned this. Wear it with pride.'].concat(g.completeQuest('gameball'));
      }
      return null;
    },
  },
  {
    id: 'coffee',
    title: 'River Coffee',
    giver: 'fisher',
    goal: ['Bring a Coffee to the angler on the Grand River.'],
    reward: { exp: 20, money: 15, items: ['rocket', 'rocket'] },
    talk(g, q) {
      if (q.step === undefined) {
        g.startQuest('coffee');
        return [
          'Been out here since dawn. Fish aren\'t biting, and I forgot my thermos.',
          'If you\'re ever passing by with a coffee, I\'d trade you something good for it.',
          '@(New quest: River Coffee)',
        ];
      }
      if (q.step === 0) {
        if (!g.has('coffee')) return ['Kirkhof\'s campus store sells coffee. So does the barista, but you can\'t carry a latte this far.'];
        g.takeItem('coffee');
        return ['Is that coffee? You\'re a lifesaver.', 'Here, I found these washed up on the bank. Point them away from your face.'].concat(g.completeQuest('coffee'));
      }
      return null;
    },
  },
  {
    id: 'pizza',
    title: 'Pizza Run',
    giver: 'neighbor',
    goal: ['Bring a Pizza Slice to the hungry neighbor in Allendale.'],
    reward: { exp: 25, money: 35, items: ['apple', 'apple'] },
    talk(g, q) {
      if (q.step === undefined) {
        g.startQuest('pizza');
        return [
          'You\'re one of those Grand Valley students, aren\'t you? Do me a favor.',
          'My delivery driver took one look at the geese on campus and turned around. With my pizza.',
          'Bring me a slice and I\'ll pay you back, plus a little extra. And some apples. I have so many apples.',
          '@(New quest: Pizza Run)',
        ];
      }
      if (q.step === 0) {
        if (!g.has('pizza')) return ['The campus store at Kirkhof sells pizza slices. Hurry, I\'m wasting away.'];
        g.takeItem('pizza');
        return ['Pizza! Still warm. Mostly.', 'Here\'s your money back, plus extra. And apples. Please take the apples.'].concat(g.completeQuest('pizza'));
      }
      return null;
    },
  },
];

// Items lying on the map. A pickup shows up only while its quest is at
// `step`; picking it up gives the item and moves the quest to the next step.
//   at: 'arch'           a couple of tiles south of the Transformational Link
//       'football'       the middle of the football field
//       { img: [x, y] }  GVSU campus map image pixels (see campus.js)
//       { tile: [x, y] } map tiles
LQ.PICKUPS = [
  { id: 'lakercard', quest: 'lakercard', step: 0, item: 'lakercard', at: 'arch',
    text: 'A Lakercard, face down on the walk. The photo looks very tired.' },
  { id: 'gameball', quest: 'gameball', step: 0, item: 'gameball', at: 'football',
    text: 'The game ball! It\'s been chewed on a little. Probably the squirrels.' },
];
