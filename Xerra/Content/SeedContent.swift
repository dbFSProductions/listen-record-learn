import Foundation

/// Starter decks in Central (Barcelona) Catalan, built around cafés, work and
/// castells rather than a textbook's idea of a life.
///
/// `focusNote` names the specific sound each phrase drills. The recurring theme
/// is vowel reduction: in Central Catalan unstressed `a` and `e` both collapse
/// to a neutral schwa (ə), and unstressed `o` rises to `u`. Getting that wrong
/// is the single loudest tell that someone is reading Catalan as if it were
/// Spanish.
enum SeedContent {

    static var catalanStarterDecks: [Phrase] {
        sounds + greetings + cafe + tapes + market + work
            + castells + segon + pinya + arribada + ordres
    }

    // MARK: - Sounds

    static let sounds: [Phrase] = [
        Phrase(
            text: "Setze jutges d'un jutjat mengen fetge d'un penjat.",
            translation: "Sixteen judges of a court eat the liver of a hanged man. (The classic Catalan tongue twister.)",
            deck: "Sounds",
            focusNote: "The whole point is the voiced 'j' / 'tj' — like the 's' in English 'measure', never the Spanish jota."
        ),
        Phrase(
            text: "Pa amb tomàquet",
            translation: "Bread with tomato",
            deck: "Sounds",
            focusNote: "Both unstressed a's are schwa: 'pə əm tuˈmakət'. The final -et is 'ət', not 'et'."
        ),
        Phrase(
            text: "Aquesta setmana",
            translation: "This week",
            deck: "Sounds",
            focusNote: "Four vowels, three of them schwa: 'əˈkɛstə səˈmanə'. Only the stressed ones keep their colour."
        ),
        Phrase(
            text: "Vull anar a Girona.",
            translation: "I want to go to Girona.",
            deck: "Sounds",
            focusNote: "'ll' is a palatal l (like 'million'), not a Spanish 'y'. Girona starts soft, like 'measure'."
        ),
        Phrase(
            text: "Vint-i-vuit ampolles",
            translation: "Twenty-eight bottles",
            deck: "Sounds",
            focusNote: "Catalan keeps final consonants Spanish would soften. Say the 't' in vuit."
        ),
        Phrase(
            text: "La Marta menja peix els dilluns.",
            translation: "Marta eats fish on Mondays.",
            deck: "Sounds",
            focusNote: "'La Marta' with the article before a name — very Catalan. Final -a of Marta is schwa."
        ),
    ]

    // MARK: - Every day

    /// The porter, the neighbours, the person behind every counter. Ported
    /// from the sister app Deb-o-lingo's Spanish course and rewritten for
    /// Catalan — the phrases are the same day, the focusNotes are not.
    static let greetings: [Phrase] = [
        Phrase(
            text: "Bon dia.",
            translation: "Good morning.",
            deck: "Salutacions",
            focusNote: "Two words, one breath: 'bun DI-ə'. The unstressed o of 'bon' rises to u and the final -a of 'dia' is schwa."
        ),
        Phrase(
            text: "Bona tarda.",
            translation: "Good afternoon.",
            deck: "Salutacions",
            focusNote: "'BO-nə TAR-ðə'. Both final a's are schwa, and the d is soft — tongue on the teeth, nearer the 'th' of 'father' than an English d."
        ),
        Phrase(
            text: "Com està?",
            translation: "How are you? (formal)",
            deck: "Salutacions",
            focusNote: "The 'vostè' form — right for the porter until he switches first. 'kum əs-TA': the o reduces to u, and the stressed à stays wide open."
        ),
        Phrase(
            text: "Molt bé, gràcies. I vostè?",
            translation: "Very well, thanks. And you?",
            deck: "Salutacions",
            focusNote: "'Molt bé' runs together and the t vanishes before the b: 'mol-BE'. 'Gràcies' is two syllables in speech: 'GRA-siəs'."
        ),
        Phrase(
            text: "Fins després!",
            translation: "See you later!",
            deck: "Salutacions",
            focusNote: "'fins dəs-PRES' — the e of 'des-' is unstressed so it is a schwa, and both s's are pronounced. This is how you leave anywhere."
        ),
        Phrase(
            text: "Quina calor que fa avui!",
            translation: "It's so hot today!",
            deck: "Salutacions",
            focusNote: "'Calor' is kə-LO: unstressed a to schwa, and the final r is silent in Central Catalan. Weather is most of doorman conversation."
        ),
        Phrase(
            text: "Quin fred!",
            translation: "So cold!",
            deck: "Salutacions",
            focusNote: "The final d devoices to a t: 'FRET'. Catalan says that consonant out loud where Spanish 'frío' has nothing at all."
        ),
        Phrase(
            text: "Què tal el cap de setmana?",
            translation: "How was the weekend?",
            deck: "Salutacions",
            focusNote: "'Setmana' drops its t in speech: 'səm-MA-nə', two schwas around one full a."
        ),
        Phrase(
            text: "Que tingui un bon dia.",
            translation: "Have a good day.",
            deck: "Salutacions",
            focusNote: "The polite send-off, in the vostè form. 'Tingui' is TIN-gi — the u is silent, it is only there to keep the g hard."
        ),
        Phrase(
            text: "Igualment.",
            translation: "Likewise — you too.",
            deck: "Salutacions",
            focusNote: "i-gwal-MEN, with the final t swallowed after the n. The reply when he wishes you a good day first."
        ),
        Phrase(
            text: "Moltes gràcies.",
            translation: "Thank you very much.",
            deck: "Salutacions",
            focusNote: "MOL-təs GRA-siəs. Both words end in that same unstressed -əs; neither e is a full e."
        ),
        Phrase(
            text: "De res.",
            translation: "You're welcome.",
            deck: "Salutacions",
            focusNote: "'də RES' — the e of 'de' is a schwa, the e of 'res' is stressed and open. Two tiny words, two different e's."
        ),
        Phrase(
            text: "Perdoni, no ho entenc.",
            translation: "Sorry, I don't understand.",
            deck: "Salutacions",
            focusNote: "'No ho' runs together as 'no-u'. 'Entenc' ends in the ng of English 'sing', not a hard k: ən-TENG."
        ),
        Phrase(
            text: "Pot repetir-ho, si us plau?",
            translation: "Can you repeat that, please?",
            deck: "Salutacions",
            focusNote: "'Repetir-ho' is rə-pə-TI-ru: the infinitive r goes silent and the -ho hooks on as a u. 'Si us plau' runs together."
        ),
        Phrase(
            text: "Parlo una mica de català.",
            translation: "I speak a little Catalan.",
            deck: "Salutacions",
            focusNote: "'Parlo' ends in u: PAR-lu. 'Català' is kə-tə-LA — two schwas, then one wide-open stressed a. The phrase that makes everyone patient with you."
        ),
    ]

    // MARK: - Cafés and going out

    static let cafe: [Phrase] = [
        Phrase(
            text: "Bon dia! Que em pot posar un tallat, si us plau?",
            translation: "Morning! Could you get me a cortado, please?",
            deck: "Cafès i sortir",
            focusNote: "'si us plau' runs together as roughly 'si-us-plau' — don't over-separate it."
        ),
        Phrase(
            text: "Una canya i unes olives, gràcies.",
            translation: "A small beer and some olives, thanks.",
            deck: "Cafès i sortir",
            focusNote: "'gràcies' is two syllables in speech: 'GRA-siəs'."
        ),
        Phrase(
            text: "Que teniu menú del dia?",
            translation: "Do you have a set lunch menu?",
            deck: "Cafès i sortir",
            focusNote: "Starting a yes/no question with 'Que' is standard Catalan — keep the rising tone at the end."
        ),
        Phrase(
            text: "Per mi, l'amanida i el pollastre.",
            translation: "For me, the salad and the chicken.",
            deck: "Cafès i sortir",
            focusNote: "'l'amanida' elides into one word. 'll' in pollastre is that palatal l again."
        ),
        Phrase(
            text: "Que ens pots posar el compte, si us plau?",
            translation: "Could you bring us the bill, please?",
            deck: "Cafès i sortir",
            focusNote: "'ens' is barely there — 'əns'. Catalan weak pronouns are quick and unstressed."
        ),
        Phrase(
            text: "Està boníssim, de debò.",
            translation: "It's delicious, honestly.",
            deck: "Cafès i sortir",
            focusNote: "'de debò' — final ò is open and stressed. Let it ring."
        ),
        Phrase(
            text: "Quedem per fer un vermut diumenge?",
            translation: "Shall we meet for a vermouth on Sunday?",
            deck: "Cafès i sortir",
            focusNote: "'diumenge' is di-u-MEN-jə, four syllables, soft final g."
        ),
        Phrase(
            text: "Avui convido jo.",
            translation: "It's on me today.",
            deck: "Cafès i sortir",
            focusNote: "Unstressed o in 'convido' rises toward u: 'kumˈbiðu'."
        ),
        Phrase(
            text: "Un cafè amb llet, si us plau.",
            translation: "A coffee with milk, please.",
            deck: "Cafès i sortir",
            focusNote: "'Llet' opens with the palatal l of 'million', never a Spanish y. 'Amb' is barely there before a consonant: just 'əm'."
        ),
        Phrase(
            text: "Un cafè sol.",
            translation: "An espresso, black.",
            deck: "Cafès i sortir",
            focusNote: "'Sol' means the coffee comes alone. One clean o with no glide off the end, and a light forward l."
        ),
        Phrase(
            text: "Que em pot posar un descafeïnat?",
            translation: "Could I get a decaf?",
            deck: "Cafès i sortir",
            focusNote: "'Que em pot posar...?' is THE ordering formula — learn it once, order anything forever. The ï is its own syllable: dəs-kə-fə-i-NAT."
        ),
        Phrase(
            text: "Em pot cobrar, si us plau?",
            translation: "Can I pay, please?",
            deck: "Cafès i sortir",
            focusNote: "'Cobrar' loses its final r: ku-BRA. Said standing at the bar when you are ready to go."
        ),
        Phrase(
            text: "Un got d'aigua, si us plau.",
            translation: "A glass of water, please.",
            deck: "Cafès i sortir",
            focusNote: "'Got' keeps a crisp final t. 'Aigua' is AY-gwə — that last a is a schwa like every other unstressed one."
        ),
        Phrase(
            text: "Aigua amb gas... sense gas.",
            translation: "Sparkling water... still water.",
            deck: "Cafès i sortir",
            focusNote: "'Sense' is SEN-sə. You will be asked which one, every time — now you own both answers."
        ),
        Phrase(
            text: "Una copa de vi negre.",
            translation: "A glass of red wine.",
            deck: "Cafès i sortir",
            focusNote: "Red wine is 'negre', literally black, never 'vermell'. NE-grə, schwa on the end."
        ),
        Phrase(
            text: "Una copa de vi blanc... rosat.",
            translation: "A glass of white... of rosé.",
            deck: "Cafès i sortir",
            focusNote: "'Blanc' ends in a hard k sound: BLANK. Catalan pronounces that final consonant; Spanish hides it behind the -o of 'blanco'."
        ),
        Phrase(
            text: "Una copa de cava, si us plau.",
            translation: "A glass of cava, please.",
            deck: "Cafès i sortir",
            focusNote: "KA-βə — between vowels the v is a soft b in Central Catalan, and the final a is schwa. Arguably the most important sentence here."
        ),
        Phrase(
            text: "Que teniu taula per a dos?",
            translation: "Do you have a table for two?",
            deck: "Cafès i sortir",
            focusNote: "'Taula' is TAW-lə. Opening a yes/no question with 'Que' is standard Catalan — keep the tone rising at the end."
        ),
        Phrase(
            text: "Què em recomana?",
            translation: "What do you recommend?",
            deck: "Cafès i sortir",
            focusNote: "rə-ku-MA-nə: three unstressed vowels, three reductions — e to schwa, o to u, final a to schwa. Waiters love the question."
        ),
        Phrase(
            text: "Una altra, si us plau.",
            translation: "Another one, please.",
            deck: "Cafès i sortir",
            focusNote: "'Una altra' elides into 'u-NAL-trə'. 'Una altra' for a beer or a glass of wine, 'un altre' for a coffee."
        ),
    ]

    // MARK: - Tapes

    static let tapes: [Phrase] = [
        Phrase(
            text: "Unes braves, si us plau.",
            translation: "Some patatas bravas, please.",
            deck: "Tapes",
            focusNote: "'Unes' is U-nəs. The v is a b in Central Catalan: BRA-βəs, with the schwa in the ending."
        ),
        Phrase(
            text: "Una de truita.",
            translation: "One portion of tortilla.",
            deck: "Tapes",
            focusNote: "The potato omelette is 'truita' in Catalan: TRUY-tə. 'Una de...' works for anything on the board."
        ),
        Phrase(
            text: "Unes olives.",
            translation: "Some olives.",
            deck: "Tapes",
            focusNote: "u-LI-βəs — the first o is unstressed so it rises to u, the v softens to a b, and -es is schwa plus s."
        ),
        Phrase(
            text: "És per compartir.",
            translation: "It's for sharing.",
            deck: "Tapes",
            focusNote: "'És' is a clear open e. 'Compartir' drops its final r: kum-pər-TI. Four words that say you know how tapes work."
        ),
        Phrase(
            text: "De moment, res més.",
            translation: "Nothing else for now.",
            deck: "Tapes",
            focusNote: "'Moment' is mu-MEN: unstressed o to u, final t swallowed after the n. Buys you time before round two."
        ),
        Phrase(
            text: "M'ho pot posar per emportar?",
            translation: "Can you box this up for me to take away?",
            deck: "Tapes",
            focusNote: "'M'ho' is one syllable, 'mu'. 'Emportar' loses the final r: əm-pur-TA. THE sentence — worth overlearning until it is automatic."
        ),
        Phrase(
            text: "Em pot posar la resta per emportar?",
            translation: "Can I take the rest to go?",
            deck: "Tapes",
            focusNote: "'Resta' is RES-tə. For when it was too good to finish but too good to leave behind."
        ),
        Phrase(
            text: "Una caixa, si us plau.",
            translation: "A box, please.",
            deck: "Tapes",
            focusNote: "'Caixa' is KA-shə — 'ix' is the Catalan sh sound, nothing like a Spanish j."
        ),
        Phrase(
            text: "Me l'emporto.",
            translation: "I'll take it with me.",
            deck: "Tapes",
            focusNote: "It runs as one word, mə-ləm-POR-tu, with the final o a u. Also what you say in a shop once you have decided to buy the thing."
        ),
        Phrase(
            text: "Que teniu res per emportar?",
            translation: "Do you have anything to go?",
            deck: "Tapes",
            focusNote: "'Res' means 'anything' inside a question and 'nothing' in an answer. Clear open e, clear final s."
        ),
        Phrase(
            text: "Puc pagar amb targeta?",
            translation: "Can I pay by card?",
            deck: "Tapes",
            focusNote: "'Targeta' carries the voiced j of English 'measure': tər-ZHE-tə. Never the Spanish jota."
        ),
        Phrase(
            text: "Quant és?",
            translation: "How much is it?",
            deck: "Tapes",
            focusNote: "The t of 'quant' links straight onto the next word: 'kwan-TES'. For counters; at a table you ask for 'el compte' instead."
        ),
        Phrase(
            text: "Ha estat tot boníssim.",
            translation: "Everything was delicious.",
            deck: "Tapes",
            focusNote: "The h is silent and 'ha estat' runs together: 'a-əs-TAT'. The compliment every cook wants to hear."
        ),
        Phrase(
            text: "La propina està inclosa?",
            translation: "Is the tip included?",
            deck: "Tapes",
            focusNote: "pru-PI-nə — unstressed o to u again. Tipping here is small and optional, but the question earns you a smile."
        ),
        Phrase(
            text: "Adéu, fins aviat!",
            translation: "Bye — see you soon!",
            deck: "Tapes",
            focusNote: "'Adéu' stresses the é and ends in a clear w: ə-DEW. 'Aviat' is ə-βi-AT. Warmer than a plain adéu."
        ),
    ]

    // MARK: - The market

    static let market: [Phrase] = [
        Phrase(
            text: "Posi'm un quart de pernil.",
            translation: "A quarter kilo of ham, please.",
            deck: "El mercat",
            focusNote: "'Posi'm' is the counter-ordering word, the market cousin of 'em pot posar'. 'Pernil' is pər-NIL with a clear final l."
        ),
        Phrase(
            text: "Mig quilo de tomàquets.",
            translation: "Half a kilo of tomatoes.",
            deck: "El mercat",
            focusNote: "'Mig' ends in a tch sound: MITCH. 'Tomàquets' is tu-MA-kəts — the stressed à is the only full vowel in it."
        ),
        Phrase(
            text: "Em pot donar una barra de pa?",
            translation: "Can I get a baguette?",
            deck: "El mercat",
            focusNote: "'Barra' has the rolled rr, a quick drum-roll of the tongue. If it will not roll yet, a long tap passes."
        ),
        Phrase(
            text: "Una mica més, si us plau.",
            translation: "A bit more, please.",
            deck: "El mercat",
            focusNote: "'Mica' is MI-kə, 'més' has a closed é. For when they pause at the scale and look up at you."
        ),
        Phrase(
            text: "Així està bé.",
            translation: "That's fine like that.",
            deck: "El mercat",
            focusNote: "'Així' is ə-SHI — x doing the sh job again. The other answer to the scale-pause. You now control the scale."
        ),
        Phrase(
            text: "A quant va el tomàquet?",
            translation: "How much are the tomatoes (per kilo)?",
            deck: "El mercat",
            focusNote: "Prices by the kilo use 'a quant va...?'. The singular 'el tomàquet' means the produce, not one tomato."
        ),
        Phrase(
            text: "Res més, gràcies.",
            translation: "Nothing else, thanks.",
            deck: "El mercat",
            focusNote: "The answer to 'alguna cosa més?', which you will hear at every counter, every single time."
        ),
        Phrase(
            text: "Aquest, si us plau. No — aquell.",
            translation: "This one, please. No — that one.",
            deck: "El mercat",
            focusNote: "'Aquest' is ə-KET, the s silent. 'Aquell' ends in the palatal ll of 'million'. Pointing is allowed, expected and effective."
        ),
        Phrase(
            text: "M'ho pot tallar fi?",
            translation: "Can you slice it thin?",
            deck: "El mercat",
            focusNote: "'Tallar' has the palatal ll and drops its final r: tə-LLA. Essential for pernil and cheese, where thin is the whole point."
        ),
        Phrase(
            text: "Em pot donar una bossa?",
            translation: "Can I have a bag?",
            deck: "El mercat",
            focusNote: "'Bossa' is BO-sə — the double s stays sharp and unvoiced, unlike the buzzing single s of 'casa'."
        ),
        Phrase(
            text: "Està madur?",
            translation: "Is it ripe?",
            deck: "El mercat",
            focusNote: "mə-DU, soft d and a silent final r. For melons, avocados, and building trust with the fruit man."
        ),
        Phrase(
            text: "És per avui.",
            translation: "It's for eating today.",
            deck: "El mercat",
            focusNote: "'Avui' is ə-VUY, stressed on the end. Say when you will eat it and they will pick you the right one — this is the secret handshake."
        ),
        Phrase(
            text: "Quin està millor avui?",
            translation: "Which is best today?",
            deck: "El mercat",
            focusNote: "'Millor' has the palatal ll and a silent final r: mi-LLO. Vendors light up at this question."
        ),
        Phrase(
            text: "Fins dissabte.",
            translation: "See you Saturday.",
            deck: "El mercat",
            focusNote: "'Dissabte' is di-SAP-tə — the b hardens to a p before the t. Become a regular; it pays off in better tomatoes."
        ),
        Phrase(
            text: "Molt amable, gràcies!",
            translation: "Very kind of you — thanks!",
            deck: "El mercat",
            focusNote: "'Molt amable' links the t straight into the a: 'mol-tə-MA-blə'. The goodbye that makes them remember you tomorrow."
        ),
    ]

    // MARK: - Work

    static let work: [Phrase] = [
        Phrase(
            text: "Bon dia, com ha anat el cap de setmana?",
            translation: "Morning, how was your weekend?",
            deck: "Feina",
            focusNote: "'com ha anat' flows as one unit — the h is silent, the vowels link up."
        ),
        Phrase(
            text: "Tinc una reunió a les deu.",
            translation: "I have a meeting at ten.",
            deck: "Feina",
            focusNote: "'reunió' is four syllables with the stress right at the end: re-u-ni-Ó."
        ),
        Phrase(
            text: "Et passo el document aquest matí.",
            translation: "I'll send you the document this morning.",
            deck: "Feina",
            focusNote: "'Et' is a schwa — 'ət'. Don't give it a full English 'et'."
        ),
        Phrase(
            text: "Encara no ho tinc enllestit.",
            translation: "I haven't got it finished yet.",
            deck: "Feina",
            focusNote: "'ho' is just 'u'. 'enllestit' has the palatal ll in the middle."
        ),
        Phrase(
            text: "Estic fins dalt de feina.",
            translation: "I'm completely swamped with work.",
            deck: "Feina",
            focusNote: "Idiomatic — literally 'I'm up to the top of work'. Say it with feeling."
        ),
        Phrase(
            text: "Plego a les sis.",
            translation: "I finish work at six.",
            deck: "Feina",
            focusNote: "'plegar' for finishing work is very Catalan. Unstressed e is schwa: 'plə-GU'."
        ),
        Phrase(
            text: "Ho deixem per la setmana vinent?",
            translation: "Shall we leave it for next week?",
            deck: "Feina",
            focusNote: "'deixem' — the 'ix' is a 'sh' sound. Rising question intonation at the end."
        ),
        Phrase(
            text: "Podem parlar-ne demà, si et va bé.",
            translation: "We can talk about it tomorrow, if that works for you.",
            deck: "Feina",
            focusNote: "'parlar-ne' — the attached pronoun keeps the stress on 'lar'."
        ),
    ]

    // MARK: - Castells

    static let castells: [Phrase] = [
        Phrase(
            text: "Força, equilibri, valor i seny.",
            translation: "Strength, balance, courage and good sense. (The castellers' motto.)",
            deck: "Castells",
            focusNote: "'seny' ends in a palatal n — like the 'ny' in canyon, and it's the whole word's character."
        ),
        Phrase(
            text: "De quina colla ets?",
            translation: "Which colla are you with?",
            deck: "Castells",
            focusNote: "'colla' has the palatal ll. Short, quick question — keep it light."
        ),
        Phrase(
            text: "Vaig a fer pinya.",
            translation: "I'm going to join the base.",
            deck: "Castells",
            focusNote: "'fer pinya' also means to pull together as a group — the metaphor everyone uses."
        ),
        Phrase(
            text: "Han descarregat el tres de vuit!",
            translation: "They completed the three-of-eight cleanly!",
            deck: "Castells",
            focusNote: "'descarregat' means dismantled successfully — the better result than merely 'carregat'."
        ),
        Phrase(
            text: "El castell ha fet llenya.",
            translation: "The tower collapsed. (Literally: it made firewood.)",
            deck: "Castells",
            focusNote: "'llenya' — palatal ll at the start and palatal ny at the end. Two of Catalan's signature sounds in one word."
        ),
        Phrase(
            text: "Em lligues la faixa, si us plau?",
            translation: "Could you tie my sash for me?",
            deck: "Castells",
            focusNote: "'lligues' starts with the palatal ll. The faixa is what supports your back and gives others a foothold."
        ),
        Phrase(
            text: "L'enxaneta ha fet l'aleta.",
            translation: "The enxaneta raised their hand at the top.",
            deck: "Castells",
            focusNote: "'enxaneta' — the 'x' is a 'sh' sound: 'ən-shə-NE-tə'."
        ),
        Phrase(
            text: "Anem a l'assaig dimarts a les vuit.",
            translation: "We're going to rehearsal on Tuesday at eight.",
            deck: "Castells",
            focusNote: "'assaig' ends in a 'tch' sound: 'ə-SATCH'."
        ),
        Phrase(
            text: "Avui hi ha diada a la plaça.",
            translation: "There's a castells event in the square today.",
            deck: "Castells",
            focusNote: "'hi ha' is just 'i a'. The ç in plaça is a plain s."
        ),
        Phrase(
            text: "Puja amb compte, eh?",
            translation: "Climb carefully, all right?",
            deck: "Castells",
            focusNote: "'Puja' has the soft j. That trailing 'eh?' is everywhere in spoken Catalan."
        ),
        Phrase(
            text: "Sóc de la Colla Castellera d'Horta.",
            translation: "I'm with the Colla Castellera d'Horta.",
            deck: "Castells",
            focusNote: "'Horta' starts with a silent h — 'ORR-tə'. 'Colla' has the palatal ll."
        ),
    ]

    // MARK: - Calling from segon
    //
    // Said upward from the tronc down to the pinya, usually over noise and the
    // gralles. These are short, loud and imperative on purpose: length is your
    // enemy up there. Commands aimed at the pinya as a group take the plural
    // (-eu) ending — estrenyeu, aguanteu, afluixeu.

    static let segon: [Phrase] = [
        Phrase(
            text: "Més a la dreta.",
            translation: "More to the right.",
            deck: "Castells · Segon",
            focusNote: "'Més' has a closed é; everything unstressed around it is schwa — 'mes ə lə DRE-tə'."
        ),
        Phrase(
            text: "Més a l'esquerra.",
            translation: "More to the left.",
            deck: "Castells · Segon",
            focusNote: "Open è and a rolled rr: 'əs-KWE-rrə'. Let the r ring or it sounds like 'esquera'."
        ),
        Phrase(
            text: "Un pèl més, només un pèl.",
            translation: "A touch more, just a touch.",
            deck: "Castells · Segon",
            focusNote: "'pèl' is an open è — wider than the é in 'més'. The two vowels in this phrase are deliberately different."
        ),
        Phrase(
            text: "Cap endavant.",
            translation: "Forward.",
            deck: "Castells · Segon",
            focusNote: "Runs together as one word: 'kap-ən-də-BAN'. The final t is barely there."
        ),
        Phrase(
            text: "Cap enrere.",
            translation: "Back.",
            deck: "Castells · Segon",
            focusNote: "'enrere' — 'ən-RE-rə'. Two r's, the first one rolled."
        ),
        Phrase(
            text: "Estrenyeu!",
            translation: "Squeeze in! (to the pinya)",
            deck: "Castells · Segon",
            focusNote: "The palatal ny, then stress right on the end: 'əs-trə-NYEU'. Shout it from the belly."
        ),
        Phrase(
            text: "Afluixeu una mica.",
            translation: "Loosen off a bit.",
            deck: "Castells · Segon",
            focusNote: "'ix' is a sh sound: 'ə-flu-SHEU'. Stress on the final syllable again."
        ),
        Phrase(
            text: "Aguanteu!",
            translation: "Hold!",
            deck: "Castells · Segon",
            focusNote: "'ə-gwən-TEU'. The gua is one quick glide, not two syllables."
        ),
        Phrase(
            text: "Més pit!",
            translation: "More chest! Push in more with your chest!",
            deck: "Castells · Pinya",
            focusNote: "Two short, stressed beats: MÉS PIT. Keep the final t in 'pit' crisp so the command cuts through the noise.",
            situation: "Inside a pinya, shouted to the person behind you when you need them to press forward more firmly with their chest.",
            usageNote: "In castells, 'donar pit' means using your chest to press into the back of the person ahead and keep the pinya compact. The clipped command is what you actually shout."
        ),
        Phrase(
            text: "Massa fort!",
            translation: "Too hard!",
            deck: "Castells · Segon",
            focusNote: "Two stressed syllables back to back. Keep it clipped — this one has to cut through noise."
        ),
        Phrase(
            text: "Prou, així està bé.",
            translation: "Enough, that's good there.",
            deck: "Castells · Segon",
            focusNote: "'així' is stressed on the í: 'ə-SHI'. The ix is a sh again."
        ),
        Phrase(
            text: "Ja estic. No et moguis.",
            translation: "I'm set. Don't move.",
            deck: "Castells · Segon",
            focusNote: "'moguis' has a hard g: 'MO-gis'. 'No et' contracts to roughly 'no-ət'."
        ),
        Phrase(
            text: "Espera, encara no.",
            translation: "Wait, not yet.",
            deck: "Castells · Segon",
            focusNote: "'encara' — 'ən-KA-rə'. Single tapped r in the middle, not rolled."
        ),
        Phrase(
            text: "Ara sí. Amunt!",
            translation: "Now. Up!",
            deck: "Castells · Segon",
            focusNote: "'Amunt' — 'ə-MUN', final t swallowed. This is the one that has to carry."
        ),
        Phrase(
            text: "Agafa'm el canell.",
            translation: "Grab my wrist.",
            deck: "Castells · Segon",
            focusNote: "'canell' ends in the palatal ll — 'kə-NELL', not 'ka-nel'."
        ),
        Phrase(
            text: "La mà una mica més amunt.",
            translation: "Hand a bit higher.",
            deck: "Castells · Segon",
            focusNote: "'mà' is a full open a — one of the few a's here that isn't a schwa."
        ),
    ]

    // MARK: - Down in the pinya
    //
    // Contrafort and laterals: what gets said around you at the base, where
    // you can't see much and everything arrives as a shouted instruction.

    static let pinya: [Phrase] = [
        Phrase(
            text: "Avui vaig de contrafort.",
            translation: "I'm going in as contrafort today.",
            deck: "Castells · Pinya",
            focusNote: "'vaig' ends in a 'tch' sound: 'batch'. 'contrafort' keeps its final t."
        ),
        Phrase(
            text: "Avui faig de lateral.",
            translation: "I'm a lateral today.",
            deck: "Castells · Pinya",
            focusNote: "'faig' rhymes with 'vaig' — same 'tch' ending."
        ),
        Phrase(
            text: "On em poso?",
            translation: "Where do I go?",
            deck: "Castells · Pinya",
            focusNote: "Three quick syllables, rising at the end. Unstressed o in 'poso' rises toward u."
        ),
        Phrase(
            text: "Aquí falta un contrafort.",
            translation: "We're a contrafort short here.",
            deck: "Castells · Pinya",
            focusNote: "'falta un' links into 'FAL-tə-un' — Catalan runs vowels together across words."
        ),
        Phrase(
            text: "Dona'm la mà.",
            translation: "Give me your hand.",
            deck: "Castells · Pinya",
            focusNote: "'Dona'm' — the attached pronoun keeps stress on DO. 'mà' stays open and long."
        ),
        Phrase(
            text: "Agafa't bé.",
            translation: "Get a proper grip.",
            deck: "Castells · Pinya",
            focusNote: "'bé' is a closed é. Short and firm."
        ),
        Phrase(
            text: "Feu força cap endins.",
            translation: "Push inward.",
            deck: "Castells · Pinya",
            focusNote: "The ç in 'força' is a plain s: 'FOR-sə'."
        ),
        Phrase(
            text: "Tothom a lloc.",
            translation: "Everyone in position.",
            deck: "Castells · Pinya",
            focusNote: "'Tothom' — silent h, 'tu-TOM'. 'lloc' opens with the palatal ll and ends on a hard k."
        ),
        Phrase(
            text: "Silenci, que ja toquen.",
            translation: "Quiet, the gralles are starting.",
            deck: "Castells · Pinya",
            focusNote: "'toquen' — hard k, unstressed final e is schwa: 'TO-kən'."
        ),
        Phrase(
            text: "Ja pugen.",
            translation: "They're going up.",
            deck: "Castells · Pinya",
            focusNote: "Soft j, like the s in 'measure': 'PU-jən'."
        ),
        Phrase(
            text: "Ja baixen, aguanteu!",
            translation: "They're coming down, hold!",
            deck: "Castells · Pinya",
            focusNote: "'baixen' — the ix is sh: 'BA-shən'. This is the moment the pinya must not soften."
        ),
        Phrase(
            text: "No afluixeu fins que baixin del tot.",
            translation: "Don't loosen until they're all the way down.",
            deck: "Castells · Pinya",
            focusNote: "Long one — keep it flowing rather than word by word. 'del tot' is the emphatic bit."
        ),
        Phrase(
            text: "Compte amb el cap!",
            translation: "Mind your head!",
            deck: "Castells · Pinya",
            focusNote: "'Compte' has a silent p: 'KOM-tə'. Urgent and short."
        ),
    ]

    // MARK: - Arriving at rehearsal
    //
    // The five minutes before anything gets built. All informal (tu), because
    // that's the register of a colla — nobody at an assaig is using vostè.
    //
    // Worth knowing throughout this deck: in Central Catalan the letter v is
    // pronounced the same as b. Vacances is 'bacances', veig is 'betch'.

    static let arribada: [Phrase] = [
        Phrase(
            text: "Ei, bones! Com anem?",
            translation: "Hey, hi! How's it going?",
            deck: "Castells · Arribada",
            focusNote: "'Bones' is the standard casual Catalan hello — 'BO-nəs'. Far more natural here than 'Hola'."
        ),
        Phrase(
            text: "Què tal? Com ha anat la setmana?",
            translation: "How are you? How's your week been?",
            deck: "Castells · Arribada",
            focusNote: "'Què' is an open è. 'com ha anat' runs together — silent h, the vowels link straight through."
        ),
        Phrase(
            text: "Quant de temps! Feia dies que no et veia.",
            translation: "Long time! I haven't seen you in ages.",
            deck: "Castells · Arribada",
            focusNote: "'veia' is 'BE-yə' — that v is a b. 'Quant de temps' compresses to 'kwan-də-TEMS'."
        ),
        Phrase(
            text: "Molt bé, i tu?",
            translation: "Really well, and you?",
            deck: "Castells · Arribada",
            focusNote: "'Molt' drops its t before bé: 'mol-BE'. Rising tone on 'i tu'."
        ),
        Phrase(
            text: "Anar fent, ja saps.",
            translation: "Getting by, you know how it is.",
            deck: "Castells · Arribada",
            focusNote: "The classic Catalan non-answer. 'ə-NA FEN' — final consonants swallowed, said with a shrug."
        ),
        Phrase(
            text: "Vaig tirant.",
            translation: "I'm getting along all right.",
            deck: "Castells · Arribada",
            focusNote: "'Vaig' is 'batch' — v as b, final ig as tch. Two words, four sounds, very common."
        ),
        Phrase(
            text: "Estic fet pols, molta feina aquesta setmana.",
            translation: "I'm shattered, loads of work this week.",
            deck: "Castells · Arribada",
            focusNote: "'fet pols' literally 'made dust' — properly idiomatic. 'aquesta' is 'ə-KES-tə'."
        ),
        Phrase(
            text: "Què tal les vacances?",
            translation: "How were your holidays?",
            deck: "Castells · Arribada",
            focusNote: "'vacances' begins with a b sound: 'bə-KAN-səs'. Three schwas in one word."
        ),
        Phrase(
            text: "On vau anar?",
            translation: "Where did you go?",
            deck: "Castells · Arribada",
            focusNote: "'vau' is 'bau'. Short question, clear rise at the end."
        ),
        Phrase(
            text: "Vam estar una setmana a Menorca.",
            translation: "We spent a week in Menorca.",
            deck: "Castells · Arribada",
            focusNote: "'Vam' is 'bam'. 'una setmana a' links into one run of vowels — don't chop it up."
        ),
        Phrase(
            text: "Que bé! Quina enveja.",
            translation: "Lovely! I'm jealous.",
            deck: "Castells · Arribada",
            focusNote: "'enveja' is 'əm-BE-jə' — b for the v, and a soft j like the s in 'measure'."
        ),
        Phrase(
            text: "I la família, tot bé?",
            translation: "And the family, all good?",
            deck: "Castells · Arribada",
            focusNote: "'família' is stressed on the í: 'fə-MI-li-ə'."
        ),
        Phrase(
            text: "Arribo tard? Ja heu començat?",
            translation: "Am I late? Have you started?",
            deck: "Castells · Arribada",
            focusNote: "'heu' is just 'eu' — silent h. 'començat' has the ç as a plain s."
        ),
        Phrase(
            text: "Avui som pocs, no?",
            translation: "There aren't many of us today, are there?",
            deck: "Castells · Arribada",
            focusNote: "That trailing 'no?' does the work of an English tag question. Keep it light and rising."
        ),
        Phrase(
            text: "Feia temps que no véns.",
            translation: "You haven't been in a while.",
            deck: "Castells · Arribada",
            focusNote: "'véns' has a closed é and starts with a b sound: 'BENS'."
        ),
        Phrase(
            text: "Vaig a canviar-me.",
            translation: "I'm going to get changed.",
            deck: "Castells · Arribada",
            focusNote: "'canviar-me' is 'kəm-bi-A-mə' — the v again as b, stress on the A."
        ),
        Phrase(
            text: "Has portat la faixa?",
            translation: "Did you bring your sash?",
            deck: "Castells · Arribada",
            focusNote: "'Has' is just 'əs'. 'faixa' has the sh sound: 'FA-shə'."
        ),
        Phrase(
            text: "Ens veiem la setmana que ve.",
            translation: "See you next week.",
            deck: "Castells · Arribada",
            focusNote: "'Ens veiem' is 'əns bə-YEM'. 'que ve' closes it off — again, v as b."
        ),
        Phrase(
            text: "Adéu, fins dimarts!",
            translation: "Bye, see you Tuesday!",
            deck: "Castells · Arribada",
            focusNote: "'dimarts' loses the t in speech: 'di-MARS'."
        ),
    ]

    // MARK: - Orders shouted at you
    //
    // Comprehension, not production. You will never say these — you need to
    // recognise them instantly, over noise, first time, while under load.
    //
    // Given in the plural (-eu, -a't → -eu, us) because they're aimed at the
    // whole colla. A tècnic correcting one person switches to the singular:
    // recupereu → recupera, gireu → gira, aguanteu → aguanta. Learn the plural
    // and the singular will be obvious.
    //
    // The focus notes here describe what each one sounds like *shouted at
    // speed*, which is not the same as how it looks written down.

    static let ordres: [Phrase] = [
        Phrase(
            text: "Força!",
            translation: "Push! / Strength!",
            deck: "Castells · Ordres",
            focusNote: "'FOR-sə' — the ç is a plain s. The single most-shouted word in castells."
        ),
        Phrase(
            text: "Aguanteu!",
            translation: "Hold!",
            deck: "Castells · Ordres",
            focusNote: "'ə-gwən-TEU'. Compresses to almost 'gwan-TEU' when it's yelled."
        ),
        Phrase(
            text: "Recupereu!",
            translation: "Recover your position!",
            deck: "Castells · Ordres",
            focusNote: "'rə-ku-pə-REU'. Four syllables that collapse to about two at volume — listen for the -EU ending."
        ),
        Phrase(
            text: "Colzes amunt!",
            translation: "Elbows up!",
            deck: "Castells · Ordres",
            focusNote: "'KOL-zəs ə-MUN'. The final t of amunt disappears entirely."
        ),
        Phrase(
            text: "Les mans més amunt!",
            translation: "Hands higher!",
            deck: "Castells · Ordres",
            focusNote: "Often cut to just 'Més amunt!' — recognise the short form too."
        ),
        Phrase(
            text: "Els peus més a prop del coll!",
            translation: "Feet closer to the neck!",
            deck: "Castells · Ordres",
            focusNote: "'coll' ends in the palatal ll. Frequently shortened to just 'Al coll!'"
        ),
        Phrase(
            text: "Peus endavant!",
            translation: "Feet forward!",
            deck: "Castells · Ordres",
            focusNote: "'peus ən-də-BAN'. Runs as one word — don't wait for a gap that never comes."
        ),
        Phrase(
            text: "Gireu els braços!",
            translation: "Twist your arms!",
            deck: "Castells · Ordres",
            focusNote: "Soft g like 'measure': 'ji-REU'. 'braços' has the ç as s: 'BRA-sus'."
        ),
        Phrase(
            text: "Tireu-vos enrere!",
            translation: "Lean back!",
            deck: "Castells · Ordres",
            focusNote: "'TI-reu-bus ən-RE-rə'. Often just 'Enrere!' on its own."
        ),
        Phrase(
            text: "El cap avall!",
            translation: "Head down!",
            deck: "Castells · Ordres",
            focusNote: "'avall' ends in the palatal ll: 'ə-BALL'. Note it's a b sound for that v."
        ),
        Phrase(
            text: "Braços estirats!",
            translation: "Arms straight!",
            deck: "Castells · Ordres",
            focusNote: "'BRA-sus əs-ti-RATS'. Stress lands hard on the last syllable."
        ),
        Phrase(
            text: "Esquena recta!",
            translation: "Back straight!",
            deck: "Castells · Ordres",
            focusNote: "'əs-KE-nə REK-tə'. Rolled r at the start of recta."
        ),
        Phrase(
            text: "Estrenyeu!",
            translation: "Squeeze in! / Tighten the pinya!",
            deck: "Castells · Ordres",
            focusNote: "'əs-trə-NYEU'. You'll hear this one more than almost anything else."
        ),
        Phrase(
            text: "No us mogueu!",
            translation: "Don't move!",
            deck: "Castells · Ordres",
            focusNote: "'no us mu-GEU' — hard g. Runs together into roughly 'nous-mu-GEU'."
        ),
        Phrase(
            text: "Quiets!",
            translation: "Still! / Freeze!",
            deck: "Castells · Ordres",
            focusNote: "'ki-ETS'. Two syllables, sharp. Means stop everything immediately."
        ),
        Phrase(
            text: "A lloc!",
            translation: "Into position!",
            deck: "Castells · Ordres",
            focusNote: "'ə-LLOK' — palatal ll, hard k. Very short, easy to miss in noise."
        ),
        Phrase(
            text: "Falta pinya aquí!",
            translation: "We need more people in the base here!",
            deck: "Castells · Ordres",
            focusNote: "'FAL-tə PI-nyə ə-KI'. The ny is palatal, the aquí is stressed at the end."
        ),
        Phrase(
            text: "A poc a poc!",
            translation: "Slowly!",
            deck: "Castells · Ordres",
            focusNote: "'ə-pok-ə-POK'. Said to slow a climb that's running away."
        ),
        Phrase(
            text: "Silenci!",
            translation: "Quiet!",
            deck: "Castells · Ordres",
            focusNote: "'si-LEN-si' — the final i is barely voiced. Means the castell is about to go up."
        ),
        Phrase(
            text: "Amunt!",
            translation: "Up!",
            deck: "Castells · Ordres",
            focusNote: "'ə-MUN'. The call to climb. Short, and everything follows from it."
        ),
        Phrase(
            text: "Respireu!",
            translation: "Breathe!",
            deck: "Castells · Ordres",
            focusNote: "'rəs-pi-REU'. Shouted when the pinya is tensing up and holding its breath."
        ),
    ]
}
