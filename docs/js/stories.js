// Hand-written stories with comprehension questions — Deb-o-lingo's Stories,
// ported as a shape and written fresh for this learner. A story is six to
// eight sentences from Fin's own week in Horta — the assaig, the market, the
// neighbour on the third floor, the band, the intercanvi — written out of the
// course's own vocabulary, so the cards get met again in a sentence that
// isn't the card. That is the reading half of knowing a phrase, and it is why
// these are written by hand rather than by the Worker: `/story` writes a
// passage on a subject, and it cannot know which cards you have.
//
// Harder than Deb's on purpose — "obviously harder" was the brief. Every tense
// the Grammar section drills turns up: the periphrastic past, the imperfect,
// the perfect, the pluperfect, the future, the conditional, the subjunctive
// after "vull que" and "si plogués" — and the little words do real work (hi,
// en, ho, li). The question is in Catalan too, with its English behind the
// answer, so reading the question is part of the test; Deb's are asked in
// English because for her the question must never be the obstacle.
//
// `answer` is the option that is right, by index as written here; the page
// shuffles the order it shows them in. `translation` is the English of the
// question, printed once that question has been answered. Each line's `en`
// is held back until every question is closed.
//
// Scores are kept by id in `xerra.stories` (store.js), so ids are stable the
// way phrase ids are: never renumber, append. Easiest first. Each story
// carries its language, so a Spanish set can follow without a second file.
//
// This file is hand-written and is not generated from SeedContent.swift: the
// native app has no stories, and a generator for content it will never show
// would be a second pipeline for nothing.

export const STORIES = [
  {
    id: "conte-1",
    language: "ca-ES",
    title: "L'assaig",
    teaser: "Thursday evening, the faixa, and a three of seven",
    lines: [
      { text: "Dijous a la tarda, en Fin va a l'assaig de la colla.", en: "On Thursday afternoon, Fin goes to the colla's rehearsal." },
      { text: "Hi va amb bici, perquè el local és a prop de casa.", en: "He goes there by bike, because the hall is near his house." },
      { text: "Quan arriba, el cap de colla ja hi és i tothom es posa la faixa.", en: "When he arrives, the head of the colla is already there and everyone is putting on their sash." },
      { text: "—Avui faràs de lateral —li diu.", en: "'Today you'll be a lateral,' he tells him." },
      { text: "Primer fan una pinya, i després proven un tres de set.", en: "First they make a pinya, and then they try a three of seven." },
      { text: "Els nens pugen de pressa i baixen encara més de pressa.", en: "The children climb up fast and come down even faster." },
      { text: "Després de l'assaig, tothom va al bar de la cantonada a fer una cervesa.", en: "After the rehearsal, everyone goes to the bar on the corner for a beer." },
    ],
    questions: [
      { question: "Com va en Fin a l'assaig?", translation: "How does Fin get to the rehearsal?", options: ["A peu", "Amb bici", "Amb el metro"], answer: 1 },
      { question: "Què li diu el cap de colla?", translation: "What does the head of the colla tell him?", options: ["Avui no cal que vinguis", "Avui pujaràs a dalt", "Avui faràs de lateral"], answer: 2 },
      { question: "Què fan després de l'assaig?", translation: "What do they do after the rehearsal?", options: ["Van al bar a fer una cervesa", "Se'n van a casa", "Proven un altre castell"], answer: 0 },
    ],
  },
  {
    id: "conte-2",
    language: "ca-ES",
    title: "Al mercat",
    teaser: "Saturday morning: tomatoes, eggs, and the neighbour",
    lines: [
      { text: "Dissabte al matí, en Fin baixa al mercat d'Horta.", en: "On Saturday morning, Fin goes down to the Horta market." },
      { text: "Vol comprar tomàquets, però no en queden de madurs.", en: "He wants to buy tomatoes, but there are no ripe ones left." },
      { text: "—Si en vol per avui, agafi aquests —diu la dona de la parada—. Són més petits, però són més dolços.", en: "'If you want some for today, take these,' says the woman at the stall. 'They're smaller, but they're sweeter.'" },
      { text: "En Fin en compra mig quilo i també un manat de julivert.", en: "Fin buys half a kilo of them and a bunch of parsley too." },
      { text: "—Res més? —Sí, posi'm també una dotzena d'ous.", en: "'Anything else?' 'Yes, give me a dozen eggs as well.'" },
      { text: "En total són set euros amb cinquanta.", en: "Altogether it's seven euros fifty." },
      { text: "Quan surt, es troba la veïna del tercer, que també hi va cada dissabte.", en: "When he leaves, he runs into the neighbour from the third floor, who goes there every Saturday too." },
    ],
    questions: [
      { question: "Què vol comprar en Fin?", translation: "What does Fin want to buy?", options: ["Pomes", "Tomàquets", "Pa"], answer: 1 },
      { question: "Per què agafa els tomàquets petits?", translation: "Why does he take the small tomatoes?", options: ["Perquè són més barats", "Perquè són més grossos", "Perquè són més dolços"], answer: 2 },
      { question: "Quant paga en total?", translation: "How much does he pay altogether?", options: ["Set euros amb cinquanta", "Cinc euros", "Dotze euros"], answer: 0 },
      { question: "A qui es troba quan surt?", translation: "Who does he run into when he leaves?", options: ["El cap de colla", "La veïna del tercer", "La seva germana"], answer: 1 },
    ],
  },
  {
    id: "conte-3",
    language: "ca-ES",
    title: "La veïna del tercer",
    teaser: "Fifty years in the barri, and what it used to be",
    lines: [
      { text: "La veïna del tercer es diu Montserrat i fa cinquanta anys que viu al barri.", en: "The neighbour on the third floor is called Montserrat and she has lived in the barri for fifty years." },
      { text: "Abans, quan era petita, Horta era gairebé un poble: hi havia horts i camps on ara hi ha pisos.", en: "Before, when she was little, Horta was almost a village: there were allotments and fields where there are flats now." },
      { text: "—Jo anava a buscar aigua a la font —li explica a en Fin a l'ascensor.", en: "'I used to go and fetch water from the fountain,' she tells Fin in the lift." },
      { text: "A en Fin li agrada molt que li expliqui aquestes coses, perquè li agrada la història.", en: "Fin really likes her telling him these things, because he likes history." },
      { text: "—Un dia t'ensenyaré fotos d'aquella època —diu la Montserrat.", en: "'One day I'll show you photos from that time,' says Montserrat." },
      { text: "—M'encantaria. Quan vulgui —contesta ell.", en: "'I'd love that. Whenever you like,' he answers." },
    ],
    questions: [
      { question: "Quant de temps fa que la Montserrat viu al barri?", translation: "How long has Montserrat lived in the barri?", options: ["Cinc anys", "Quinze anys", "Cinquanta anys"], answer: 2 },
      { question: "Com era Horta quan ella era petita?", translation: "What was Horta like when she was little?", options: ["Gairebé un poble", "Una ciutat gran", "Un bosc"], answer: 0 },
      { question: "On anava a buscar aigua?", translation: "Where did she use to fetch water?", options: ["Al mercat", "A la font", "Al riu"], answer: 1 },
      { question: "Què li ensenyarà un dia?", translation: "What will she show him one day?", options: ["La seva casa", "Un llibre d'història", "Fotos d'aquella època"], answer: 2 },
    ],
  },
  {
    id: "conte-4",
    language: "ca-ES",
    title: "L'intercanvi",
    teaser: "Half an hour each way, and two corrections in the notebook",
    lines: [
      { text: "Cada dimarts, en Fin queda amb la Laia per fer un intercanvi de llengües: mitja hora en català i mitja hora en anglès.", en: "Every Tuesday, Fin meets Laia for a language exchange: half an hour in Catalan and half an hour in English." },
      { text: "Avui han quedat en un bar de Gràcia.", en: "Today they've arranged to meet in a bar in Gràcia." },
      { text: "—Com ha anat la setmana? —pregunta la Laia.", en: "'How has the week been?' asks Laia." },
      { text: "—Molta feina. Estic fet pols —diu en Fin—. Però dissabte vam fer una actuació a la plaça i va sortir bé.", en: "'Lots of work. I'm worn out,' says Fin. 'But on Saturday we did a performance in the square and it went well.'" },
      { text: "La Laia el corregeix dues vegades i ell ho apunta a la llibreta.", en: "Laia corrects him twice and he notes it down in his notebook." },
      { text: "—Parla'm més a poc a poc, si us plau —li demana ell quan ella explica el cap de setmana.", en: "'Speak to me more slowly, please,' he asks her when she talks about her weekend." },
      { text: "Quan acaben, ella li diu que cada vegada parla millor.", en: "When they finish, she tells him he speaks better every time." },
    ],
    questions: [
      { question: "Quan queden en Fin i la Laia?", translation: "When do Fin and Laia meet?", options: ["Cada dissabte", "Cada dimarts", "Cada dia"], answer: 1 },
      { question: "On han quedat avui?", translation: "Where have they arranged to meet today?", options: ["En un bar de Gràcia", "A Horta", "A la plaça"], answer: 0 },
      { question: "Què va fer en Fin dissabte?", translation: "What did Fin do on Saturday?", options: ["Un viatge", "Un examen", "Una actuació a la plaça"], answer: 2 },
      { question: "Què li demana en Fin a la Laia?", translation: "What does Fin ask Laia to do?", options: ["Que parli en anglès", "Que parli més a poc a poc", "Que li deixi la llibreta"], answer: 1 },
    ],
  },
  {
    id: "conte-5",
    language: "ca-ES",
    title: "La pluja",
    teaser: "Rain in the morning, sun at eleven, a wet square at one",
    lines: [
      { text: "Ahir havia de ser el dia de l'actuació a Sant Andreu.", en: "Yesterday was supposed to be the day of the performance in Sant Andreu." },
      { text: "Però al matí plovia, i el cap de colla va enviar un missatge al grup: «Si continua plovent, no actuarem.»", en: "But in the morning it was raining, and the head of the colla sent a message to the group: 'If it keeps raining, we won't perform.'" },
      { text: "Tothom esperava a casa mirant el cel.", en: "Everyone was waiting at home watching the sky." },
      { text: "A les onze va parar de ploure i va sortir el sol.", en: "At eleven it stopped raining and the sun came out." },
      { text: "Van actuar a la una, amb la plaça encara mullada.", en: "They performed at one, with the square still wet." },
      { text: "En Fin diu que va ser una de les millors actuacions de l'any.", en: "Fin says it was one of the best performances of the year." },
      { text: "Avui ha tornat a ploure, però ja no importa.", en: "Today it has rained again, but it doesn't matter any more." },
    ],
    questions: [
      { question: "On havia de ser l'actuació?", translation: "Where was the performance supposed to be?", options: ["A Horta", "A Sant Andreu", "A Gràcia"], answer: 1 },
      { question: "Què deia el missatge del cap de colla?", translation: "What did the head of the colla's message say?", options: ["Actuarem igualment", "L'actuació serà demà", "Si continua plovent, no actuarem"], answer: 2 },
      { question: "A quina hora va parar de ploure?", translation: "What time did it stop raining?", options: ["A les onze", "A la una", "A les set"], answer: 0 },
      { question: "Com va ser l'actuació, segons en Fin?", translation: "How was the performance, according to Fin?", options: ["Molt dolenta", "Una de les millors de l'any", "Massa curta"], answer: 1 },
    ],
  },
  {
    id: "conte-6",
    language: "ca-ES",
    title: "El concert",
    teaser: "The band, the festa major, and two songs in Catalan",
    lines: [
      { text: "En Fin també toca en una banda.", en: "Fin also plays in a band." },
      { text: "Assagen els dimecres en un local petit que hi ha sota un bar.", en: "They rehearse on Wednesdays in a small room under a bar." },
      { text: "Fa anys, a Anglaterra, tocava en una altra banda, però la va deixar quan va venir a viure a Barcelona.", en: "Years ago, in England, he used to play in another band, but he left it when he came to live in Barcelona." },
      { text: "Aquest divendres tenen un concert a la festa major del barri.", en: "This Friday they have a concert at the neighbourhood's festa major." },
      { text: "—Si tot va bé, tocarem una hora —diu el bateria.", en: "'If all goes well, we'll play for an hour,' says the drummer." },
      { text: "—I si plou? —pregunta en Fin. —Si plogués, ho faríem dins del centre cívic.", en: "'And if it rains?' asks Fin. 'If it rained, we'd do it inside the civic centre.'" },
      { text: "En Fin està una mica nerviós, perquè cantarà dues cançons en català.", en: "Fin is a little nervous, because he'll sing two songs in Catalan." },
    ],
    questions: [
      { question: "Quin dia assaja la banda?", translation: "Which day does the band rehearse?", options: ["Els dijous", "Els dimecres", "Els caps de setmana"], answer: 1 },
      { question: "Què va fer en Fin quan va venir a Barcelona?", translation: "What did Fin do when he came to Barcelona?", options: ["Va deixar la banda d'Anglaterra", "Va comprar una guitarra", "Va formar una banda nova"], answer: 0 },
      { question: "Què farien si plogués?", translation: "What would they do if it rained?", options: ["No tocarien", "Tocarien l'endemà", "Tocarien dins del centre cívic"], answer: 2 },
      { question: "Per què està nerviós en Fin?", translation: "Why is Fin nervous?", options: ["Perquè no ha assajat", "Perquè cantarà en català", "Perquè no coneix les cançons"], answer: 1 },
    ],
  },
  {
    id: "conte-7",
    language: "ca-ES",
    title: "A la biblioteca",
    teaser: "A book returned, a shorter one borrowed, and a card left on the counter",
    lines: [
      { text: "En Fin va a la biblioteca a tornar un llibre sobre la Guerra de Successió.", en: "Fin goes to the library to return a book about the War of Succession." },
      { text: "—L'ha acabat? —li pregunta la bibliotecària. —Sí, però hi ha capítols que he hagut de llegir dues vegades.", en: "'Have you finished it?' the librarian asks him. 'Yes, but there are chapters I've had to read twice.'" },
      { text: "Ella li recomana un altre llibre, més curt, sobre el setge de Barcelona del 1714.", en: "She recommends another book to him, a shorter one, about the siege of Barcelona in 1714." },
      { text: "—Aquest l'entendrà millor; és per a joves —li diu.", en: "'You'll understand this one better; it's for young people,' she tells him." },
      { text: "En Fin se l'emporta i també n'agafa un de poemes.", en: "Fin takes it with him and also picks up one of poems." },
      { text: "Quan surt, s'adona que s'ha deixat la targeta al taulell, i hi ha de tornar.", en: "When he leaves, he realises he has left his card on the counter, and has to go back." },
    ],
    questions: [
      { question: "Sobre què és el llibre que torna?", translation: "What is the book he returns about?", options: ["Els castells", "La Guerra de Successió", "Barcelona avui"], answer: 1 },
      { question: "Què li recomana la bibliotecària?", translation: "What does the librarian recommend?", options: ["Un llibre més curt sobre el setge del 1714", "Una novel·la en anglès", "Un diccionari"], answer: 0 },
      { question: "Què més agafa en Fin?", translation: "What else does Fin pick up?", options: ["Un diari", "Un mapa", "Un llibre de poemes"], answer: 2 },
      { question: "Què s'ha deixat al taulell?", translation: "What has he left on the counter?", options: ["La targeta", "El llibre", "Les claus"], answer: 0 },
    ],
  },
  {
    id: "conte-8",
    language: "ca-ES",
    title: "El missatge del grup",
    teaser: "No rehearsal Thursday, and a word to look up",
    lines: [
      { text: "Diumenge al vespre arriba un missatge al grup de la colla.", en: "On Sunday evening a message arrives in the colla's group." },
      { text: "«Hola a tothom! Us escric per avisar-vos que dijous no hi haurà assaig, perquè el local estarà tancat per obres.»", en: "'Hi everyone! I'm writing to let you know that on Thursday there will be no rehearsal, because the hall will be closed for building work.'" },
      { text: "«A partir de la setmana que ve tornarem a l'horari de sempre.»", en: "'From next week we'll be back to the usual timetable.'" },
      { text: "«Els que vulgueu venir a la calçotada de dissabte, apunteu-vos abans de dimecres. Us hi esperem a tots i totes!»", en: "'Those of you who want to come to Saturday's calçotada, sign up before Wednesday. We'll be expecting all of you there!'" },
      { text: "En Fin ho llegeix dues vegades i ho entén gairebé tot.", en: "Fin reads it twice and understands almost all of it." },
      { text: "Només ha de buscar què vol dir «calçotada».", en: "He only has to look up what 'calçotada' means." },
      { text: "S'hi apunta de seguida.", en: "He signs up for it straight away." },
    ],
    questions: [
      { question: "Per què no hi haurà assaig dijous?", translation: "Why will there be no rehearsal on Thursday?", options: ["Perquè plou", "Perquè el local estarà tancat per obres", "Perquè és festa"], answer: 1 },
      { question: "Quan tornaran a l'horari de sempre?", translation: "When will they go back to the usual timetable?", options: ["A partir de la setmana que ve", "Demà", "D'aquí a dos mesos"], answer: 0 },
      { question: "Abans de quin dia cal apuntar-se a la calçotada?", translation: "Before which day do you have to sign up for the calçotada?", options: ["Abans de dissabte", "Abans de diumenge", "Abans de dimecres"], answer: 2 },
      { question: "Quina paraula ha de buscar en Fin?", translation: "Which word does Fin have to look up?", options: ["Calçotada", "Assaig", "Horari"], answer: 0 },
    ],
  },
  {
    id: "conte-9",
    language: "ca-ES",
    title: "Al metge",
    teaser: "A bad back since Sunday, and a week of watching",
    lines: [
      { text: "En Fin té mal d'esquena des de l'última actuació.", en: "Fin has had a bad back since the last performance." },
      { text: "Demana hora al CAP i hi va dimarts al matí.", en: "He makes an appointment at the health centre and goes there on Tuesday morning." },
      { text: "—Des de quan li fa mal? —li pregunta la metgessa. —Des de diumenge. Vaig fer de lateral i vaig aguantar molt de pes.", en: "'Since when has it hurt?' the doctor asks him. 'Since Sunday. I was a lateral and I held a lot of weight.'" },
      { text: "—Hauria de descansar una setmana i no fer castells.", en: "'You should rest for a week and not do castells.'" },
      { text: "—Però dissabte tenim actuació… —Doncs que hi vagi a mirar, i prou.", en: "'But on Saturday we have a performance…' 'Then go and watch, and that's all.'" },
      { text: "Li recepta unes pastilles i li diu que torni si no millora.", en: "She prescribes him some tablets and tells him to come back if it doesn't improve." },
      { text: "En Fin surt pensant que serà difícil mirar sense fer res.", en: "Fin leaves thinking it will be hard to watch without doing anything." },
    ],
    questions: [
      { question: "Des de quan li fa mal l'esquena?", translation: "Since when has his back hurt?", options: ["Des de fa un mes", "Des de diumenge", "Des d'ahir"], answer: 1 },
      { question: "Què hauria de fer, segons la metgessa?", translation: "What should he do, according to the doctor?", options: ["Descansar una setmana", "Fer més exercici", "Anar a l'hospital"], answer: 0 },
      { question: "Què pot fer dissabte?", translation: "What can he do on Saturday?", options: ["Fer de lateral", "Pujar a dalt del castell", "Anar-hi a mirar"], answer: 2 },
      { question: "Quan ha de tornar al metge?", translation: "When does he have to go back to the doctor?", options: ["Cada setmana", "Si no millora", "Mai"], answer: 1 },
    ],
  },
  {
    id: "conte-10",
    language: "ca-ES",
    title: "Un any a Horta",
    teaser: "What he could say when he arrived, and what he'd like to say next year",
    lines: [
      { text: "Fa un any que en Fin viu a Horta, i aquesta setmana ho ha celebrat amb la colla.", en: "Fin has lived in Horta for a year, and this week he celebrated it with the colla." },
      { text: "Quan va arribar no entenia gairebé res: la gent parlava massa de pressa i ell només sabia dir «bon dia» i «gràcies».", en: "When he arrived he understood almost nothing: people spoke too fast and he could only say 'good morning' and 'thank you'." },
      { text: "Mai no havia pensat que acabaria fent castells.", en: "He had never thought he would end up doing castells." },
      { text: "El primer dia a l'assaig li van posar la faixa i li van dir: «Tu, a la pinya.»", en: "On the first day at rehearsal they put the sash on him and told him: 'You, in the pinya.'" },
      { text: "Ara ja entén les ordres, encara que de vegades es perdi quan tothom crida alhora.", en: "Now he understands the orders, even if he sometimes gets lost when everyone shouts at once." },
      { text: "Li agradaria que l'any que ve el seu català fos prou bo per fer una xerrada amb la Montserrat sense buscar cap paraula.", en: "He would like his Catalan to be good enough next year to have a chat with Montserrat without looking up a single word." },
      { text: "—Ja hi arribaràs —li diu la Laia—. En un any n'has après molt.", en: "'You'll get there,' Laia tells him. 'In a year you've learnt a lot of it.'" },
    ],
    questions: [
      { question: "Quant de temps fa que en Fin viu a Horta?", translation: "How long has Fin lived in Horta?", options: ["Un mes", "Cinc anys", "Un any"], answer: 2 },
      { question: "Què sabia dir quan va arribar?", translation: "What could he say when he arrived?", options: ["Només «bon dia» i «gràcies»", "Tot", "Res de res"], answer: 0 },
      { question: "Què li van dir el primer dia a l'assaig?", translation: "What did they tell him on the first day at rehearsal?", options: ["Tu, a dalt", "Tu, a la pinya", "Tu, a casa"], answer: 1 },
      { question: "Què li agradaria l'any que ve?", translation: "What would he like next year?", options: ["Deixar la colla", "Tornar a Anglaterra", "Parlar amb la Montserrat sense buscar cap paraula"], answer: 2 },
    ],
  },
];

export function storyById(id) {
  return STORIES.find((story) => story.id === id) ?? null;
}

export function storiesFor(language) {
  return STORIES.filter((story) => story.language === language);
}
