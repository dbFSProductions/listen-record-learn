// The config that split Xerra's app.js at v130. A worked example: a fork needs
// its own, because its functions and pages differ.
//
// RANGES is read in file order. Each entry says "from the statement that
// declares this name, everything belongs to this module" until the next
// marker. A marker starting with @ matches a statement with no name by the
// text it starts with (a top-level addEventListener, the boot calls).
// OVERRIDE moves single names out of the range they fall in.
// HEAD is the one-line comment written at the top of each module.
const RANGES = [
  ['view','core'],['repliesBlock','replies'],['sayAloud','voices'],['glossedParagraphs','message'],['repliesRequest','replies'],
  ['pictureBlock','pictures'],['AUDIO_FILES_MAX','quick'],['shrinkImage','pictures'],['scoreClass','core'],
  ['@view.addEventListener("click"','app'],['STUDY_TICK_MS','streak'],['ADD_BY_SECTION','core'],['render','app'],
  ['LESSON_SIZE','practice'],['renderQuick','quick'],['renderXerrada','chat'],['firstLine','message'],['READER_TITLE','reader'],
  ['STORY_HUE','story-page'],['WIKI','reader'],['BOOK_WORDS_SHOWN','books'],['CHAT_SCENES','chat'],['canSpeak','voices'],
  ['wireChatStarter','chat'],['phraseRow','practice'],['interviewPayload','about'],['currentPhrase','drill'],
  ['renderComparison','score'],['showHistory','phrase'],['normaliseSentence','core'],['renderAdd','add'],['chatContext','ask'],
  ['composerField','add'],['editPhrase','phrase'],['SINGLE_WORD_SITUATION','add'],['PICTURE_BRIEF','pictures'],
  ['wireEditorAI','phrase'],['deckManagerPanel','deck-manager'],['assistantSpeedPanel','settings'],['@settings.load()','app'],
];
const OVERRIDE = { goHome:'app', PLAY_SVG:'core', CLOCK_SVG:'core', MIC_SVG:'core', noVoice:'voices' };
const HEAD = {
  app:'Xerra — the entry point: boot, the render dispatcher and the one delegated listener on the view.',
  core:'What every page shares: the DOM handles, `state`, small helpers, the deck field, sheets, folds, the tiles and the page head. Imports no page module at load time — keep it that way.',
  replies:'"You might hear back": the replies block under a card, fetching them, and keeping one as a card.',
  voices:'Saying things out loud from a page: sayAloud, the read-aloud row with Stop, the voice select, and the no-sound toast.',
  pictures:'The keyword mnemonic: the picture block, the gender cue, drawings (IndexedDB), and the prompts that invent or re-imagine a scene.',
  streak:'The streak: the study clock, the flame, the home strip and the streak page.',
  practice:'The home tiles, the Practice path and its lessons, the deck lists, search, and how a queue is built and started.',
  quick:'Real life: the ask box, the message box, and audio in / text out (Record, Upload a voice note).',
  message:'The reading page — a message, an article, a story, a page of a book: tap-a-word glosses, the gist gate, the quiz, keep, reply, the voice note.',
  reader:'Listen & read: the feeds, the folds, the story card, and Viquipèdia.',
  'story-page':'The hand-written stories and the multiple-choice quiz component the reading page shares.',
  books:'Books: pasted pages, imported EPUBs, the words looked up across pages.',
  chat:'Chat (key `xerrada`): the scenes, the starter card and the rehearsal conversation.',
  about:'About me: the interview and the cards it writes.',
  drill:'The drill: loading a card, the card itself, level two, road and quiet modes, the grammar gate, recording.',
  score:'After an attempt: the score card, word chips, and the waveform and pitch comparison canvases.',
  phrase:'The phrase sheet, the attempt history, and the editor with its AI rebuild.',
  ask:'The ask panel (`cardChatPanel`) that the drill, the sheet, the chat and the reading page all use.',
  add:'Add a phrase and Add a word.',
  'deck-manager':'Settings → Decks (tick, fold, delete) and the print page.',
  settings:'Settings, the speed and scorer panels, and the version panel.',
};


module.exports = { RANGES, OVERRIDE, HEAD };
