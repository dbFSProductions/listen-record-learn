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
        sounds + cafe + work + castells + segon + pinya
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
            text: "Em falta pressió a l'esquena.",
            translation: "I need more pressure on my back.",
            deck: "Castells · Segon",
            focusNote: "'pressió' is three syllables ending stressed: 'prə-si-Ó'."
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
}
