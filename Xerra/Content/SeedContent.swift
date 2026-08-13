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
        sounds + cafe + work + castells
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
    ]
}
