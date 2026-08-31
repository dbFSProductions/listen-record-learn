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

    /// Spanish, and the only seed content that isn't Catalan. Six decks that
    /// teach the past by its *shape* rather than by its conjugation tables —
    /// see the `pastLine` comment below for the argument. They carry
    /// `language: .spanish`, which is what files them in the Spanish library.
    ///
    /// `catalanPastDecks` says the same forty-eight sentences in Catalan and
    /// is declared with the rest of the Catalan content; the two sets are meant
    /// to stay sentence-for-sentence in step, so a card added to one wants a
    /// twin in the other.
    static var spanishPastDecks: [Phrase] {
        pastLine + pastDot + pastMixed
            + pastPerfectDeck + presentPerfectDeck + pastMixedAll
    }

    static var allStarterDecks: [Phrase] {
        catalanStarterDecks + catalanPastDecks + spanishPastDecks
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

    // MARK: - Catalan · the shape of the past

    /// The same six decks as the Spanish ones, saying the same forty-eight
    /// sentences. That is deliberate and not a copy-paste: the sentence is the
    /// constant, and what changes across the two libraries is the machinery
    /// the language uses to put it in the past — which is the one thing these
    /// decks exist to drill.
    ///
    /// Catalan's dot is the part worth knowing about. Everyday spoken Catalan
    /// does not say *aní* or *menjà*; it says **vaig anar**, **vaig menjar** —
    /// the auxiliary `vaig · vas · va · vam · vau · van` in front of the plain
    /// infinitive. The one-word preterite exists and is what the grammars call
    /// the *passat simple*, but it is a literary form, so a learner who drills
    /// it says sentences no one around them says. Every dot in these decks is
    /// therefore periphrastic, and the focusNotes teach the auxiliary as the
    /// sound that marks a dot the way -é and -ó do in Spanish.
    ///
    /// The line is the near-twin: -ava and -ia, against Spanish's -aba and
    /// -ía. Catalan has fewer exceptions than Spanish does — *anar* is regular
    /// here (anava, not Spanish's iba), and **ser → era** is effectively the
    /// only verb that escapes the two endings, which the cards say out loud.
    static var catalanPastDecks: [Phrase] {
        catalanPastLine + catalanPastDot + catalanPastMixed
            + catalanPastPerfect + catalanPresentPerfect + catalanPastAll
    }

    /// The imperfect: -ava and -ia, and a deck of stretches.
    static let catalanPastLine: [Phrase] = [
        Phrase(
            text: "Abans treballava des de casa.",
            translation: "I used to work from home.",
            deck: "Passat · La línia",
            focusNote: "trə-bə-LLA-və — three schwas around the one full A, and the ll is the palatal one with the tongue flat on the roof of the mouth.",
            aspect: .line,
            aspectNote: "'Abans' with no end date on it is a stretch, not an event. The -ava is the line."
        ),
        Phrase(
            text: "Estava cansat i no volia sortir.",
            translation: "I was tired and I didn't want to go out.",
            deck: "Passat · La línia",
            focusNote: "əs-TA-və and vu-LI-ə: the unstressed o of volia rises to u. 'Sortir' loses its final r — sur-TI.",
            aspect: .line,
            aspectNote: "Two states, neither with an edge. Both are lines."
        ),
        Phrase(
            text: "No m'agradava gens el cafè sol.",
            translation: "I didn't like black coffee at all.",
            deck: "Passat · La línia",
            focusNote: "ə-grə-DA-və: schwa, schwa, stress, schwa. 'Gens' opens on the soft voiced j of 'measure'.",
            usageNote: "'Un cafè sol' is what you order for a plain black coffee — 'cafè negre' is the bean, not the drink.",
            aspect: .line,
            aspectNote: "How things stood, over years. -ava, so a line."
        ),
        Phrase(
            text: "Els dissabtes anàvem al mercat.",
            translation: "On Saturdays we used to go to the market.",
            deck: "Passat · La línia",
            focusNote: "ə-NA-vəm, stressed on the -NA-. 'Mercat' ends on a hard t, and the final t is the sound these decks keep asking for.",
            aspect: .line,
            aspectNote: "'Els dissabtes' is a habit, and habits have no edges. Note that Catalan's anar is regular in the line — anàvem, where Spanish jumps to íbamos."
        ),
        Phrase(
            text: "Feia molta calor aquell dia.",
            translation: "It was very hot that day.",
            deck: "Passat · La línia",
            focusNote: "'Feia' is FÉ-ə, two syllables. 'Aquell' ends on the palatal ll — hold the tongue there, don't let it slide into a y.",
            usageNote: "Calor is feminine in Catalan, so it is molta calor — not molt.",
            aspect: .line,
            aspectNote: "Weather is scenery, and scenery is a line — even when the day it describes is one closed day. 'Feia' is the line without an -ava."
        ),
        Phrase(
            text: "Mentre cuinava, escoltava la ràdio.",
            translation: "While I was cooking, I listened to the radio.",
            deck: "Passat · La línia",
            focusNote: "cui-NA-və and əs-cul-TA-və — the unstressed o of escoltava rises to u. Two -ava endings in a row.",
            aspect: .line,
            aspectNote: "Two lines running side by side, neither of them with an edge."
        ),
        Phrase(
            text: "Ahir vaig acabar molt tard.",
            translation: "I finished very late yesterday.",
            deck: "Passat · La línia",
            focusNote: "'Vaig' is BATCH — the ig is the hard tx sound. Then ə-kə-BA: the r of acabar is silent.",
            aspect: .dot,
            aspectNote: "The odd one in this deck. Yesterday is a shut box, and Catalan says its dots with vaig plus the plain verb."
        ),
        Phrase(
            text: "El cap de setmana passat no vam sortir perquè plovia.",
            translation: "Last weekend we didn't go out because it was raining.",
            deck: "Passat · La línia",
            focusNote: "'Vam sortir' is bam-sur-TI, both r's gone. plu-VI-ə raises the o to u.",
            aspect: .both,
            aspectNote: "The rain was already running when the decision not to go out landed in it. Vam is the dot, -ia is the line."
        ),
    ]

    /// The preterite, which in spoken Catalan is `vaig` and friends in front of
    /// the plain verb. The hard cases are in on purpose — three years and a
    /// whole night are both still dots.
    static let catalanPastDot: [Phrase] = [
        Phrase(
            text: "Ahir a la nit vaig anar a dormir molt tard.",
            translation: "I went to bed very late last night.",
            deck: "Passat · El punt",
            focusNote: "'Vaig anar' is batch-ə-NA and 'dormir' is dur-MI — both infinitives drop the final r. 'Nit' keeps its hard t.",
            aspect: .dot,
            aspectNote: "Last night is shut. One going-to-bed, one dot — and the dot is spelled vaig + the plain verb."
        ),
        Phrase(
            text: "Se'm va caure el mòbil.",
            translation: "I dropped my phone.",
            deck: "Passat · El punt",
            focusNote: "'Se'm va' runs as one lump, səm-bə. MÒ-bil has an open o and the stress on the front.",
            usageNote: "Catalan puts it as 'the phone fell on me' — the se'm is what makes it an accident rather than something you did.",
            aspect: .dot,
            aspectNote: "One instant with both ends shut."
        ),
        Phrase(
            text: "El tren va arribar amb vint minuts de retard.",
            translation: "The train arrived twenty minutes late.",
            deck: "Passat · El punt",
            focusNote: "'Va arribar' is bə-rri-BA — the rr is rolled and the final r is silent. 'Retard' ends on a hard t.",
            aspect: .dot,
            aspectNote: "The train arrives once. Twenty minutes is how late it was, not how long it took."
        ),
        Phrase(
            text: "Vaig estar tres anys a Alemanya.",
            translation: "I spent three years in Germany.",
            deck: "Passat · El punt",
            focusNote: "'Anys' is the palatal ny with an s on the end. 'A Alemanya' runs the two a's into one.",
            aspect: .dot,
            aspectNote: "Three years, and still a dot: what closes it is the box round the time, not the length of it."
        ),
        Phrase(
            text: "Vam anar a Girona el cap de setmana passat.",
            translation: "We went to Girona last weekend.",
            deck: "Passat · El punt",
            focusNote: "The g of Girona is the soft voiced j, not the throaty Spanish one. 'Vam anar a' is three vowels leaning on each other: bam-ə-NA-ə.",
            aspect: .dot,
            aspectNote: "A weekend with both ends shut. One trip, one dot."
        ),
        Phrase(
            text: "Què et va dir?",
            translation: "What did he say to you?",
            deck: "Passat · El punt",
            focusNote: "'Què et' elides to KE-ət, and 'dir' loses its r — DI. Four words, three sounds.",
            aspect: .dot,
            aspectNote: "One thing said, once."
        ),
        Phrase(
            text: "No vaig poder dormir en tota la nit.",
            translation: "I couldn't sleep all night.",
            deck: "Passat · El punt",
            focusNote: "pu-DE dur-MI — two infinitives in a row and both drop their r.",
            aspect: .dot,
            aspectNote: "A whole night, and still a dot: the night is over, so the box is shut."
        ),
        Phrase(
            text: "Estava en una reunió i no ho vaig veure.",
            translation: "I was in a meeting and I didn't see it.",
            deck: "Passat · El punt",
            focusNote: "rə-u-ni-Ó ends on the stressed open o. 'No ho' is NO-u, and 'veure' ends on a schwa.",
            aspect: .both,
            aspectNote: "The meeting was running — the line — and the not-seeing is the dot inside it."
        ),
    ]

    /// The three-way test, and the deck that matters most: nothing in the name
    /// tells you the answer.
    static let catalanPastMixed: [Phrase] = [
        Phrase(
            text: "M'estava dutxant quan va sonar el timbre.",
            translation: "I was in the shower when the doorbell rang.",
            deck: "Passat · Punt o línia",
            focusNote: "du-TXANT has the hard tx of 'match'. 'Timbre' ends on a schwa — TIM-brə.",
            aspect: .both,
            aspectNote: "The shower is the line and the bell is the dot cutting across it. This is the past continuous case."
        ),
        Phrase(
            text: "T'anava a trucar, però em vaig adormir.",
            translation: "I was going to call you, but I fell asleep.",
            deck: "Passat · Punt o línia",
            focusNote: "tə-NA-və leans the t' onto the a. 'Trucar' and 'adormir' both end on a silent r.",
            aspect: .both,
            aspectNote: "The intention was running when sleep cut it off. Catalan's anar is regular in the line — anava, where Spanish has iba."
        ),
        Phrase(
            text: "Ahir va estar plovent tot el dia.",
            translation: "It rained all day yesterday.",
            deck: "Passat · Punt o línia",
            focusNote: "plu-VENT raises the o to u and ends on a hard t. 'Tot el' runs together as TO-təl.",
            aspect: .dot,
            aspectNote: "All day, and a dot: yesterday is a closed box, so what happened inside it is closed too."
        ),
        Phrase(
            text: "Quan vam arribar, no hi havia ningú.",
            translation: "When we arrived, there was nobody there.",
            deck: "Passat · Punt o línia",
            focusNote: "'Hi havia' is i-ə-VI-ə — the h is silent and everything unstressed is a schwa. 'Ningú' is stressed on the end.",
            usageNote: "Worth keeping apart: 'hi havia' is haver's own imperfect, the line; 'havia arribat' would be the pluperfect.",
            aspect: .both,
            aspectNote: "Arriving is the dot; the empty room was already the case, so it is the line."
        ),
        Phrase(
            text: "De petit no menjava verdura.",
            translation: "As a child I didn't eat vegetables.",
            deck: "Passat · Punt o línia",
            focusNote: "mən-JA-və opens on the soft voiced j. 'Verdura' and 'petit' both end the way they look — a schwa and a hard t.",
            aspect: .line,
            aspectNote: "A childhood-long state of affairs. No edges, so a line."
        ),
        Phrase(
            text: "La vaig conèixer fa deu anys.",
            translation: "I met her ten years ago.",
            deck: "Passat · Punt o línia",
            focusNote: "cu-NE-shə: the ix is a sh and the final r goes. 'Deu anys' links the u straight into the a.",
            aspect: .dot,
            aspectNote: "Meeting someone happens once. Ten years ago is a shut box."
        ),
        Phrase(
            text: "Abans quedàvem aquí cada divendres.",
            translation: "We used to meet here every Friday.",
            deck: "Passat · Punt o línia",
            focusNote: "kə-DA-vəm, stress on the à. 'Divendres' ends on a schwa plus s.",
            aspect: .line,
            aspectNote: "'Cada divendres' is a habit, and a habit is a line however long ago it stopped."
        ),
        Phrase(
            text: "Aquell estiu vaig treballar en un hotel.",
            translation: "That summer I worked in a hotel.",
            deck: "Passat · Punt o línia",
            focusNote: "trə-bə-LLA with the palatal ll and no final r, then u-TEL with a silent h.",
            aspect: .dot,
            aspectNote: "A whole summer, and a dot: 'aquell estiu' puts a box round it. Length is not what decides."
        ),
    ]

    /// The pluperfect: `havia` and friends plus the participle. Catalan's
    /// participles end -at, -ut and -it where Spanish has -ado and -ido, and
    /// that is most of what there is to learn here.
    static let catalanPastPerfect: [Phrase] = [
        Phrase(
            text: "Quan vaig arribar, ja se n'havien anat.",
            translation: "When I arrived, they had already left.",
            deck: "Passat · Abans d'allò",
            focusNote: "'Se n'havien' is one run of schwas — sə-nə-VI-ən — with the h silent, as it always is.",
            aspect: .pastPerfect,
            aspectNote: "Their leaving was over before you got there. Your arrival is the moment; the leaving sits behind it."
        ),
        Phrase(
            text: "No vaig poder entrar perquè havia perdut les claus.",
            translation: "I couldn't get in because I had lost my keys.",
            deck: "Passat · Abans d'allò",
            focusNote: "ə-VI-ə pər-DUT ends on a hard t. 'Claus' finishes with the u gliding into the s.",
            aspect: .pastPerfect,
            aspectNote: "Losing them came first, being locked out second. -ut is the participle, where Spanish would have -ido."
        ),
        Phrase(
            text: "No havia vist mai una cosa així.",
            translation: "I had never seen anything like it.",
            deck: "Passat · Abans d'allò",
            focusNote: "'Vist' ends on a hard st. ə-SHI is stressed on the í with a sh in the middle.",
            aspect: .pastPerfect,
            aspectNote: "Nothing here names the moment it is measured against — only that everything up to it was empty. That is why the shape is an event before *the* event, not before a dot."
        ),
        Phrase(
            text: "Ja havíem sopat quan vas trucar.",
            translation: "We had already had dinner when you called.",
            deck: "Passat · Abans d'allò",
            focusNote: "ə-VI-əm su-PAT — the o of sopat rises to u. 'Vas trucar' is bəs-tru-KA.",
            aspect: .pastPerfect,
            aspectNote: "Dinner was finished before the phone rang."
        ),
        Phrase(
            text: "Quan vam sortir, ja havia parat de ploure.",
            translation: "When we left, it had already stopped raining.",
            deck: "Passat · Abans d'allò",
            focusNote: "pə-RAT with a single tapped r, then PLOU-rə — the ou is one glide and the final e is a schwa.",
            aspect: .pastPerfect,
            aspectNote: "The rain stopped first; you went out into what it left behind."
        ),
        Phrase(
            text: "No ho sabia perquè ningú m'ho havia dit.",
            translation: "I didn't know because nobody had told me.",
            deck: "Passat · Abans d'allò",
            focusNote: "'No ho' is NO-u and 'm'ho' is MU. sə-BI-ə and ə-VI-ə rhyme.",
            aspect: .pastPerfect,
            aspectNote: "The moment this is measured against is a line — not knowing — and not a dot at all. This is the card the old name got wrong."
        ),
        Phrase(
            text: "Ahir vaig perdre les claus.",
            translation: "Yesterday I lost my keys.",
            deck: "Passat · Abans d'allò",
            focusNote: "PER-drə ends on a schwa, not a full e. 'Les claus' is ləs-KLAUS.",
            aspect: .dot,
            aspectNote: "Nothing behind it — just the loss, on a day that is shut."
        ),
        Phrase(
            text: "De jove treballava en un bar.",
            translation: "When I was young I worked in a bar.",
            deck: "Passat · Abans d'allò",
            focusNote: "'Jove' opens on the soft voiced j and ends on a schwa. trə-bə-LLA-və.",
            aspect: .line,
            aspectNote: "A stretch of years with no edges. The line, not an event before anything."
        ),
    ]

    /// Four minimal pairs, and the pairs are the whole deck. Catalan draws the
    /// today/before-today line at least as hard as peninsular Spanish does, and
    /// unlike Spanish it draws it the same way everywhere Catalan is spoken.
    static let catalanPresentPerfect: [Phrase] = [
        Phrase(
            text: "Avui he menjat massa.",
            translation: "I've eaten too much today.",
            deck: "Passat · Avui o ahir",
            focusNote: "'He' is just E, short. mən-JAT has the soft j and a hard final t.",
            aspect: .presentPerfect,
            aspectNote: "'Avui' has now inside it, so the bracket is still open."
        ),
        Phrase(
            text: "Ahir vaig menjar massa.",
            translation: "I ate too much yesterday.",
            deck: "Passat · Avui o ahir",
            focusNote: "mən-JA — the r of menjar goes. 'Massa' keeps a hard double s.",
            aspect: .dot,
            aspectNote: "Same sentence, shut box. Change avui to ahir and Catalan changes the whole verb with it: he menjat becomes vaig menjar."
        ),
        Phrase(
            text: "Aquesta setmana he treballat molt.",
            translation: "I've worked a lot this week.",
            deck: "Passat · Avui o ahir",
            focusNote: "trə-bə-LLAT ends on a hard t. 'Molt' does too — the l is barely there.",
            aspect: .presentPerfect,
            aspectNote: "This week is not over, so now is still inside it."
        ),
        Phrase(
            text: "La setmana passada vaig treballar molt.",
            translation: "I worked a lot last week.",
            deck: "Passat · Avui o ahir",
            focusNote: "trə-bə-LLA with no t on the end and no r either — the participle and the infinitive differ by exactly that t.",
            aspect: .dot,
            aspectNote: "'Passada' shuts the bracket, and a shut bracket is a dot."
        ),
        Phrase(
            text: "Aquest matí he parlat amb ella.",
            translation: "I've spoken to her this morning.",
            deck: "Passat · Avui o ahir",
            focusNote: "mə-TI drops the s of aquest before it. pər-LAT ends on a hard t.",
            aspect: .presentPerfect,
            aspectNote: "This morning is still today, so it stays in the bracket."
        ),
        Phrase(
            text: "Ahir a la nit vaig parlar amb ella.",
            translation: "I spoke to her last night.",
            deck: "Passat · Avui o ahir",
            focusNote: "pər-LA loses the t and the r both. 'Amb ella' runs as am-BE-llə.",
            aspect: .dot,
            aspectNote: "Last night ended and today began. Outside the bracket."
        ),
        Phrase(
            text: "Enguany hem viatjat poc.",
            translation: "We haven't travelled much this year.",
            deck: "Passat · Avui o ahir",
            focusNote: "ən-GWANY ends on the palatal ny. vi-ə-JAT has the soft j and a hard t.",
            usageNote: "'Enguany' is the everyday Catalan for this year. 'Aquest any' is understood, but flatter and more written.",
            aspect: .presentPerfect,
            aspectNote: "The year still has now in it, so the line reaches you."
        ),
        Phrase(
            text: "L'any passat vam viatjar poc.",
            translation: "We didn't travel much last year.",
            deck: "Passat · Avui o ahir",
            focusNote: "'L'any' is LANY with the palatal ny. vi-ə-JA drops the final r.",
            aspect: .dot,
            aspectNote: "Last year is shut. Same sentence, other side of the bracket."
        ),
    ]

    /// Every shape in one deck, which is the only place the full question gets
    /// asked: `aspectChoices` offers what the queue contains, so this is the
    /// deck where all five buttons appear.
    static let catalanPastAll: [Phrase] = [
        Phrase(
            text: "Avui he vist el teu germà.",
            translation: "I've seen your brother today.",
            deck: "Passat · Tot junt",
            focusNote: "'He vist' is e-VIST, ending hard. 'Germà' opens on the soft j and is stressed on the à.",
            aspect: .presentPerfect,
            aspectNote: "'Avui' keeps the bracket open, so the line reaches now."
        ),
        Phrase(
            text: "Quan vaig arribar ja havien començat.",
            translation: "When I arrived they had already started.",
            deck: "Passat · Tot junt",
            focusNote: "ə-VI-ən cu-mən-SAT — the ç is a plain s and the o rises to u.",
            aspect: .pastPerfect,
            aspectNote: "Your arrival is the dot; the start is the event sitting behind it."
        ),
        Phrase(
            text: "Estava llegint quan va marxar la llum.",
            translation: "I was reading when the power went out.",
            deck: "Passat · Tot junt",
            focusNote: "llə-JINT opens on the palatal ll and has the soft j. 'Llum' ends on a hummed m.",
            usageNote: "'Marxar la llum' is how a power cut is said out loud; the light left.",
            aspect: .both,
            aspectNote: "The reading is the line and the power cut is the dot across it. This is the past continuous case."
        ),
        Phrase(
            text: "Feia fred i no hi havia ningú al carrer.",
            translation: "It was cold and there was nobody in the street.",
            deck: "Passat · Tot junt",
            focusNote: "'Fred' ends on a hard t. cə-RRE rolls the rr and drops the final r.",
            aspect: .line,
            aspectNote: "Pure scenery, twice over. 'Havia' here is the line — haver's own imperfect — not a perfect."
        ),
        Phrase(
            text: "Dilluns passat vaig anar al metge.",
            translation: "Last Monday I went to the doctor.",
            deck: "Passat · Tot junt",
            focusNote: "di-LLUNS opens on the palatal ll. 'Metge' is MED-jə — the tg is a soft j.",
            aspect: .dot,
            aspectNote: "A named, finished day. One visit, one dot."
        ),
        Phrase(
            text: "Ja has esmorzat?",
            translation: "Have you had breakfast yet?",
            deck: "Passat · Tot junt",
            focusNote: "'Has' is AS with a silent h, and əz-mur-ZAT raises the o to u and ends hard.",
            usageNote: "Catalan writes no opening question mark — the rise in your voice is the whole of it.",
            aspect: .presentPerfect,
            aspectNote: "'Ja' asks how things stand right now, which is what keeps it inside the bracket."
        ),
        Phrase(
            text: "Vam estar dues hores esperant.",
            translation: "We waited for two hours.",
            deck: "Passat · Tot junt",
            focusNote: "'Dues hores' is DU-əz-O-rəs with the h silent. əs-pə-RANT ends on a hard t.",
            aspect: .dot,
            aspectNote: "Two hours with both ends shut. Length never decides it — edges do."
        ),
        Phrase(
            text: "No hi vaig anar perquè no m'havien convidat.",
            translation: "I didn't go because they hadn't invited me.",
            deck: "Passat · Tot junt",
            focusNote: "'No hi vaig anar' is no-i-batch-ə-NA. cum-bi-DAT raises the o and ends hard.",
            aspect: .pastPerfect,
            aspectNote: "Not being invited came before not going. The reason sits one step further back."
        ),
    ]

    // MARK: - Spanish · the shape of the past

    /// The imperfect, drilled as *the line*. Every card here is a stretch of
    /// past time — a habit, a state, a background — and nearly every one ends
    /// in -aba or -ía, which is the association the deck exists to build. Only
    /// ser, ir and ver escape those two endings, and the one card that uses one
    /// of them (íbamos) says so in its own aspectNote rather than hiding it.
    ///
    /// Eight cards, not fourteen, and every one of them a sentence you would
    /// actually say to someone — a shorter deck you finish beats a longer one
    /// you abandon, and a card about somebody's grandfather's hat was never
    /// going to come out of your mouth in a café.
    static let pastLine: [Phrase] = [
        Phrase(
            text: "Antes trabajaba desde casa.",
            translation: "I used to work from home.",
            deck: "Pasado · La línea",
            language: .spanish,
            focusNote: "tra-ba-JA-ba, stressed on the -JA-. Both b's are the soft b Spanish uses between vowels, closer to a v made with two lips.",
            aspect: .line,
            aspectNote: "'Antes' with no end date on it is a stretch, not an event. The -aba is the line."
        ),
        Phrase(
            text: "Estaba cansado y no quería salir.",
            translation: "I was tired and I didn't want to go out.",
            deck: "Pasado · La línea",
            language: .spanish,
            focusNote: "es-TA-ba and que-RÍ-a. The accent on the í is what breaks it away from the a — three syllables, not two.",
            aspect: .line,
            aspectNote: "Two states, neither with an edge. Both are lines."
        ),
        Phrase(
            text: "No me gustaba nada el café solo.",
            translation: "I didn't like black coffee at all.",
            deck: "Pasado · La línea",
            language: .spanish,
            focusNote: "gus-TA-ba keeps every unstressed vowel full — 'gustaba' is goo-STA-ba, never 'guh-STA-buh'.",
            aspect: .line,
            aspectNote: "How things stood, over years. -aba, so a line."
        ),
        Phrase(
            text: "Los sábados íbamos al mercado.",
            translation: "On Saturdays we used to go to the market.",
            deck: "Pasado · La línea",
            language: .spanish,
            focusNote: "Í-ba-mos is front-stressed, and the b is soft. 'Mercado' has a soft d you barely touch.",
            aspect: .line,
            aspectNote: "'Los sábados' is a habit, and habits have no edges. 'Íbamos' is one of only three verbs — ser, ir, ver — that skip -aba and -ía."
        ),
        Phrase(
            text: "Hacía mucho calor aquel día.",
            translation: "It was very hot that day.",
            deck: "Pasado · La línea",
            language: .spanish,
            focusNote: "a-CÍ-a: the h is silent and the c is the Castilian th. Three syllables, stressed on the í.",
            aspect: .line,
            aspectNote: "Weather is scenery, and scenery is a line — even when the day it describes is one closed day."
        ),
        Phrase(
            text: "Mientras cocinaba, escuchaba la radio.",
            translation: "While I was cooking, I listened to the radio.",
            deck: "Pasado · La línea",
            language: .spanish,
            focusNote: "co-ci-NA-ba: the second c is the Castilian th. Two -aba endings in a row, stressed on the -NA- and the -CHA-.",
            aspect: .line,
            aspectNote: "Two lines running side by side, neither of them with an edge."
        ),
        Phrase(
            text: "Ayer acabé muy tarde.",
            translation: "I finished very late yesterday.",
            deck: "Pasado · La línea",
            language: .spanish,
            focusNote: "a-ca-BÉ throws the stress right onto the end, which is what tells a dot from a line by ear.",
            aspect: .dot,
            aspectNote: "The odd one in this deck. Yesterday is a shut box, so one finished go is a dot."
        ),
        Phrase(
            text: "El fin de semana pasado no salimos porque llovía.",
            translation: "Last weekend we didn't go out because it was raining.",
            deck: "Pasado · La línea",
            language: .spanish,
            focusNote: "sa-LI-mos then llo-VÍ-a — the ll opens on a y and the v is the soft b.",
            aspect: .both,
            aspectNote: "The rain was already running when the decision not to go out landed in it."
        ),
    ]

    // MARK: - Spanish · the dot

    /// The preterite, drilled as *the dot*: an event in a past with a box round
    /// it. The hard cases are in on purpose — 'estuve tres años', 'no pude
    /// dormir en toda la noche' — because the mistake everyone makes is to
    /// think length decides it when what decides it is whether the ends are
    /// closed.
    static let pastDot: [Phrase] = [
        Phrase(
            text: "Anoche me acosté muy tarde.",
            translation: "I went to bed very late last night.",
            deck: "Pasado · El punto",
            language: .spanish,
            focusNote: "a-cos-TÉ ends on the stressed é. 'Anoche' has the ch of church.",
            aspect: .dot,
            aspectNote: "Last night is shut. One going-to-bed, one dot."
        ),
        Phrase(
            text: "Se me cayó el móvil.",
            translation: "I dropped my phone.",
            deck: "Pasado · El punto",
            language: .spanish,
            focusNote: "ca-YÓ lands hard on the ó. MÓ-vil is front-stressed with a soft v.",
            usageNote: "Spanish puts it as 'the phone fell on me' — the 'se me' is what makes it an accident rather than something you did.",
            aspect: .dot,
            aspectNote: "One instant with both ends shut."
        ),
        Phrase(
            text: "El tren llegó con veinte minutos de retraso.",
            translation: "The train arrived twenty minutes late.",
            deck: "Pasado · El punto",
            language: .spanish,
            focusNote: "lle-GÓ opens on a y and ends on the stressed ó. The r of retraso is a single tap.",
            aspect: .dot,
            aspectNote: "The train arrives once. Twenty minutes is how late it was, not how long it took."
        ),
        Phrase(
            text: "Estuve tres años en Alemania.",
            translation: "I spent three years in Germany.",
            deck: "Pasado · El punto",
            language: .spanish,
            focusNote: "es-TU-ve, stressed in the middle with a soft v. 'Años' is the ñ — AN-yos run together.",
            aspect: .dot,
            aspectNote: "Three years, and still a dot: what closes it is the box round the time, not the length of it."
        ),
        Phrase(
            text: "Fuimos a Girona el fin de semana pasado.",
            translation: "We went to Girona last weekend.",
            deck: "Pasado · El punto",
            language: .spanish,
            focusNote: "'Fuimos' is two syllables, FUI-mos. The g of Girona is throaty in Spanish, not the soft j Catalan gives it.",
            aspect: .dot,
            aspectNote: "A weekend with both ends shut. One trip, one dot."
        ),
        Phrase(
            text: "¿Qué te dijo?",
            translation: "What did he say to you?",
            deck: "Pasado · El punto",
            language: .spanish,
            focusNote: "DI-jo is front-stressed and the j is throaty, from the back of the mouth.",
            aspect: .dot,
            aspectNote: "One thing said, once."
        ),
        Phrase(
            text: "No pude dormir en toda la noche.",
            translation: "I couldn't sleep all night.",
            deck: "Pasado · El punto",
            language: .spanish,
            focusNote: "PU-de is front-stressed with a soft d; dor-MIR rolls the r at the end.",
            aspect: .dot,
            aspectNote: "A whole night, and still a dot: the night is over, so the box is shut."
        ),
        Phrase(
            text: "Estaba en una reunión y no lo vi.",
            translation: "I was in a meeting and I didn't see it.",
            deck: "Pasado · El punto",
            language: .spanish,
            focusNote: "re-u-NIÓN is four syllables ending on the stressed ó. 'Vi' is one syllable.",
            aspect: .both,
            aspectNote: "The meeting was running — the line — and the not-seeing is the dot inside it."
        ),
    ]

    // MARK: - Spanish · both at once

    /// The three-way test, and the deck that matters most: nothing in the name
    /// tells you the answer. A line with a dot cutting across it is the case
    /// the cards lean on hardest, but there are plain dots and plain lines in
    /// here too, so the question is real every time.
    static let pastMixed: [Phrase] = [
        Phrase(
            text: "Estaba duchándome cuando sonó el timbre.",
            translation: "I was in the shower when the doorbell rang.",
            deck: "Pasado · Punto o línea",
            language: .spanish,
            focusNote: "du-CHÁN-do-me carries the ch of church; so-NÓ lands on the end.",
            aspect: .both,
            aspectNote: "The shower is the line and the bell is the dot cutting across it. This is the past continuous case."
        ),
        Phrase(
            text: "Iba a llamarte, pero me quedé dormido.",
            translation: "I was going to call you, but I fell asleep.",
            deck: "Pasado · Punto o línea",
            language: .spanish,
            focusNote: "'Iba a' runs into one long a. que-DÉ ends on the stress.",
            aspect: .both,
            aspectNote: "The intention was running when sleep cut it off. 'Iba' is one of the three verbs with no -aba or -ía."
        ),
        Phrase(
            text: "Ayer estuvo lloviendo todo el día.",
            translation: "It rained all day yesterday.",
            deck: "Pasado · Punto o línea",
            language: .spanish,
            focusNote: "es-TU-vo with a soft v, then llo-VIEN-do opening on a y.",
            aspect: .dot,
            aspectNote: "All day, and a dot: yesterday is a closed box, so what happened inside it is closed too."
        ),
        Phrase(
            text: "Cuando llegamos, no había nadie.",
            translation: "When we arrived, there was nobody there.",
            deck: "Pasado · Punto o línea",
            language: .spanish,
            focusNote: "lle-GA-mos then a-BÍ-a — silent h, soft b, stress on the í.",
            usageNote: "Worth keeping apart: 'había nadie' is haber's own imperfect, the line; 'había ido' would be the pluperfect.",
            aspect: .both,
            aspectNote: "Arriving is the dot; the empty room was already the case, so it is the line."
        ),
        Phrase(
            text: "De pequeño no comía verdura.",
            translation: "As a child I didn't eat vegetables.",
            deck: "Pasado · Punto o línea",
            language: .spanish,
            focusNote: "pe-QUE-ño has the ñ; co-MÍ-a is three syllables with the stress on the í.",
            aspect: .line,
            aspectNote: "A childhood-long state of affairs. No edges, so a line."
        ),
        Phrase(
            text: "La conocí hace diez años.",
            translation: "I met her ten years ago.",
            deck: "Pasado · Punto o línea",
            language: .spanish,
            focusNote: "co-no-CÍ ends on the stressed í, and the c before it is the Castilian th. 'Diez' ends on one too.",
            aspect: .dot,
            aspectNote: "Meeting someone happens once. Ten years ago is a shut box."
        ),
        Phrase(
            text: "Antes quedábamos aquí cada viernes.",
            translation: "We used to meet here every Friday.",
            deck: "Pasado · Punto o línea",
            language: .spanish,
            focusNote: "que-DÁ-ba-mos is four syllables with the stress written on the á.",
            aspect: .line,
            aspectNote: "'Cada viernes' is a habit, and a habit is a line however long ago it stopped."
        ),
        Phrase(
            text: "Aquel verano trabajé en un hotel.",
            translation: "That summer I worked in a hotel.",
            deck: "Pasado · Punto o línea",
            language: .spanish,
            focusNote: "tra-ba-JÉ throws the stress onto the end and the j is throaty. The h of hotel is silent.",
            aspect: .dot,
            aspectNote: "A whole summer, and a dot: 'aquel verano' puts a box round it. Length is not what decides."
        ),
    ]

    // MARK: - Spanish · an event before the event

    /// The pluperfect: something already over by the past moment you are
    /// talking about. Its name deliberately leaves the dot-and-line picture,
    /// because what it is measured against varies — 'cuando llegué' is a dot,
    /// 'no lo sabía' is a line, and 'nunca había visto' names no moment at all.
    static let pastPerfectDeck: [Phrase] = [
        Phrase(
            text: "Cuando llegué, ya se habían ido.",
            translation: "When I arrived, they had already left.",
            deck: "Pasado · Antes de aquello",
            language: .spanish,
            focusNote: "lle-GÉ ends on the stress; a-BÍ-an has a silent h and a soft b.",
            aspect: .pastPerfect,
            aspectNote: "Their leaving was over before you got there. Your arrival is the moment; the leaving sits behind it."
        ),
        Phrase(
            text: "No pude entrar porque había perdido las llaves.",
            translation: "I couldn't get in because I had lost my keys.",
            deck: "Pasado · Antes de aquello",
            language: .spanish,
            focusNote: "a-BÍ-a per-DI-do — silent h, and both d's are soft.",
            aspect: .pastPerfect,
            aspectNote: "Losing them came first, being locked out second."
        ),
        Phrase(
            text: "Nunca había visto una cosa así.",
            translation: "I had never seen anything like it.",
            deck: "Pasado · Antes de aquello",
            language: .spanish,
            focusNote: "'Visto' is front-stressed with a soft v. a-SÍ ends on the stressed í.",
            aspect: .pastPerfect,
            aspectNote: "Nothing here names the moment it is measured against — only that everything up to it was empty. That is why the shape is an event before *the* event, not before a dot."
        ),
        Phrase(
            text: "Ya habíamos cenado cuando llamaste.",
            translation: "We had already had dinner when you called.",
            deck: "Pasado · Antes de aquello",
            language: .spanish,
            focusNote: "a-BÍ-a-mos is four syllables; the c of cenado is the Castilian th.",
            aspect: .pastPerfect,
            aspectNote: "Dinner was finished before the phone rang."
        ),
        Phrase(
            text: "Cuando salimos, ya había parado de llover.",
            translation: "When we left, it had already stopped raining.",
            deck: "Pasado · Antes de aquello",
            language: .spanish,
            focusNote: "pa-RA-do has a single tapped r and a soft d; llo-VER opens on a y.",
            aspect: .pastPerfect,
            aspectNote: "The rain stopped first; you went out into what it left behind."
        ),
        Phrase(
            text: "No lo sabía porque nadie me lo había dicho.",
            translation: "I didn't know because nobody had told me.",
            deck: "Pasado · Antes de aquello",
            language: .spanish,
            focusNote: "sa-BÍ-a and a-BÍ-a rhyme, both with the stress on the í.",
            aspect: .pastPerfect,
            aspectNote: "The moment this is measured against is a line — not knowing — and not a dot at all. This is the card the old name got wrong."
        ),
        Phrase(
            text: "Ayer perdí las llaves.",
            translation: "Yesterday I lost my keys.",
            deck: "Pasado · Antes de aquello",
            language: .spanish,
            focusNote: "per-DÍ ends on the stressed í; 'llaves' opens on a y and has a soft v.",
            aspect: .dot,
            aspectNote: "Nothing behind it — just the loss, on a day that is shut."
        ),
        Phrase(
            text: "De joven trabajaba en un bar.",
            translation: "When I was young I worked in a bar.",
            deck: "Pasado · Antes de aquello",
            language: .spanish,
            focusNote: "The j of joven is throaty; tra-ba-JA-ba puts the stress on the -JA-.",
            aspect: .line,
            aspectNote: "A stretch of years with no edges. The line, not an event before anything."
        ),
    ]

    // MARK: - Spanish · today or yesterday

    /// Four minimal pairs, and the pairs are the whole deck: the sentences are
    /// otherwise identical and the time word is all that decides. Breaking a
    /// pair up costs the deck its point.
    ///
    /// Spain-specific — Latin American Spanish would use the preterite on both
    /// sides of every pair here.
    static let presentPerfectDeck: [Phrase] = [
        Phrase(
            text: "Hoy he comido demasiado.",
            translation: "I've eaten too much today.",
            deck: "Pasado · Hoy o ayer",
            language: .spanish,
            focusNote: "'He' is just EH — the h is silent. co-MI-do has a soft d.",
            aspect: .presentPerfect,
            aspectNote: "'Hoy' has now inside it, so the bracket is still open."
        ),
        Phrase(
            text: "Ayer comí demasiado.",
            translation: "I ate too much yesterday.",
            deck: "Pasado · Hoy o ayer",
            language: .spanish,
            focusNote: "co-MÍ ends on the stressed í. Same verb as its pair, different ending, different day.",
            aspect: .dot,
            aspectNote: "Same sentence, shut box. Change hoy to ayer and Spain changes the tense with it."
        ),
        Phrase(
            text: "Esta semana he trabajado mucho.",
            translation: "I've worked a lot this week.",
            deck: "Pasado · Hoy o ayer",
            language: .spanish,
            focusNote: "tra-ba-JA-do with a throaty j and a soft d at the end.",
            aspect: .presentPerfect,
            aspectNote: "This week is not over, so now is still inside it."
        ),
        Phrase(
            text: "La semana pasada trabajé mucho.",
            translation: "I worked a lot last week.",
            deck: "Pasado · Hoy o ayer",
            language: .spanish,
            focusNote: "tra-ba-JÉ throws the stress right to the end — that shift is the whole difference you can hear.",
            aspect: .dot,
            aspectNote: "'Pasada' shuts the bracket, and a shut bracket is a dot."
        ),
        Phrase(
            text: "Esta mañana he hablado con ella.",
            translation: "I've spoken to her this morning.",
            deck: "Pasado · Hoy o ayer",
            language: .spanish,
            focusNote: "Both h's are silent: 'he hablado' is eh-a-BLA-do. 'Mañana' has the ñ.",
            aspect: .presentPerfect,
            aspectNote: "This morning is still today, so it stays in the bracket."
        ),
        Phrase(
            text: "Anoche hablé con ella.",
            translation: "I spoke to her last night.",
            deck: "Pasado · Hoy o ayer",
            language: .spanish,
            focusNote: "a-BLÉ is two syllables ending on the stress, with the h silent.",
            aspect: .dot,
            aspectNote: "Last night ended and today began. Outside the bracket."
        ),
        Phrase(
            text: "Este año hemos viajado poco.",
            translation: "We haven't travelled much this year.",
            deck: "Pasado · Hoy o ayer",
            language: .spanish,
            focusNote: "'Hemos' is EH-mos; vi-a-JA-do has the throaty j.",
            aspect: .presentPerfect,
            aspectNote: "The year still has now in it, so the line reaches you."
        ),
        Phrase(
            text: "El año pasado viajamos poco.",
            translation: "We didn't travel much last year.",
            deck: "Pasado · Hoy o ayer",
            language: .spanish,
            focusNote: "vi-a-JA-mos keeps the stress in the middle. No auxiliary to lean on this time.",
            aspect: .dot,
            aspectNote: "Last year is shut. Same sentence, other side of the bracket."
        ),
    ]

    // MARK: - Spanish · all five at once

    /// Every shape in one deck, which is the only place the full question gets
    /// asked: `aspectChoices` offers what the queue contains, so this is the
    /// deck where all five buttons appear. The others each narrow it.
    static let pastMixedAll: [Phrase] = [
        Phrase(
            text: "Hoy he visto a tu hermano.",
            translation: "I've seen your brother today.",
            deck: "Pasado · Todo junto",
            language: .spanish,
            focusNote: "'He' is EH and the h of hermano is silent too. VIS-to is front-stressed.",
            aspect: .presentPerfect,
            aspectNote: "'Hoy' keeps the bracket open, so the line reaches now."
        ),
        Phrase(
            text: "Cuando llegué ya habían empezado.",
            translation: "When I arrived they had already started.",
            deck: "Pasado · Todo junto",
            language: .spanish,
            focusNote: "lle-GÉ then a-BÍ-an. 'Empezado' carries the Castilian th in the middle.",
            aspect: .pastPerfect,
            aspectNote: "Your arrival is the dot; the start is the event sitting behind it."
        ),
        Phrase(
            text: "Estaba leyendo cuando se fue la luz.",
            translation: "I was reading when the power went out.",
            deck: "Pasado · Todo junto",
            language: .spanish,
            focusNote: "es-TA-ba le-YEN-do — the y is a light j. 'Luz' ends on the th.",
            aspect: .both,
            aspectNote: "The reading is the line and the power cut is the dot across it. This is the past continuous case."
        ),
        Phrase(
            text: "Hacía frío y no había nadie en la calle.",
            translation: "It was cold and there was nobody in the street.",
            deck: "Pasado · Todo junto",
            language: .spanish,
            focusNote: "a-CÍ-a and a-BÍ-a rhyme, both with silent h. 'Calle' ends on a y.",
            aspect: .line,
            aspectNote: "Pure scenery, twice over. 'Había' here is the line — haber's own imperfect — not a perfect."
        ),
        Phrase(
            text: "El lunes pasado fui al médico.",
            translation: "Last Monday I went to the doctor.",
            deck: "Pasado · Todo junto",
            language: .spanish,
            focusNote: "'Fui' is one syllable. MÉ-di-co is stressed on the first and its d is soft.",
            aspect: .dot,
            aspectNote: "A named, finished day. One visit, one dot."
        ),
        Phrase(
            text: "¿Ya has desayunado?",
            translation: "Have you had breakfast yet?",
            deck: "Pasado · Todo junto",
            language: .spanish,
            focusNote: "'Has' is AS, and de-sa-yu-NA-do puts the stress on the -NA-.",
            aspect: .presentPerfect,
            aspectNote: "'Ya' asks about how things stand right now, which is what keeps it inside the bracket."
        ),
        Phrase(
            text: "Estuvimos dos horas esperando.",
            translation: "We waited for two hours.",
            deck: "Pasado · Todo junto",
            language: .spanish,
            focusNote: "es-tu-VI-mos with a soft b, and the h of horas is silent.",
            aspect: .dot,
            aspectNote: "Two hours with both ends shut. Length never decides it — edges do."
        ),
        Phrase(
            text: "No fui porque no me habían invitado.",
            translation: "I didn't go because they hadn't invited me.",
            deck: "Pasado · Todo junto",
            language: .spanish,
            focusNote: "a-BÍ-an in-vi-TA-do — silent h, and both v's are the soft b.",
            aspect: .pastPerfect,
            aspectNote: "Not being invited came before not going. The reason sits one step further back."
        ),
    ]
}
