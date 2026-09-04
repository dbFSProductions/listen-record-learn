import Foundation

/// Which shape in the past a sentence is: a dot is an event in a time-boxed
/// past, a line is a stretch of it, some sentences are a line with a dot
/// cutting across, and the two perfects sit off the main timeline — an event
/// finished before the past moment you are talking about, and a line dashed
/// forward into the dot of now.
///
/// This is the picture the past-tense decks are built on, and the drill asks
/// for it *before* it will show you the sentence — you pick the shape, then you
/// say the words. The proper term rides along with each one so the grammar
/// vocabulary is on the screen without being the thing you are tested on.
///
/// The web app's twin is `ASPECTS` in docs/js/store.js; keep the keys in step,
/// because they are what `aspect:` is written as in the generated content.
enum Aspect: String, Codable, CaseIterable, Hashable {
    case dot
    case line
    case both
    case pastPerfect
    case presentPerfect
}

/// Which gender a noun is, and therefore which colour its keyword picture
/// wears: blue for masculine, pink for feminine, on the object the word names.
///
/// Set on a card only where the article cannot say it. Both Catalan articles
/// elide to `l'` before a vowel, so `l'avió` and `l'escala` are the two words
/// in the Paraules decks a learner cannot read the gender off — which makes
/// them the two where the cue is worth most. Everywhere else the web app works
/// it out from the article itself (`genderOf` in docs/js/store.js), so the rest
/// of the seed content says nothing.
enum Gender: String, Codable, CaseIterable, Hashable {
    case masculine
    case feminine
}

/// A single thing you want to be able to say.
struct Phrase: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var text: String
    var translation: String
    var deck: String
    var language: Language = .catalan
    /// What to listen for in this phrase — the specific sound or habit it drills.
    var focusNote: String?
    /// Where and when the phrase would naturally be used.
    var situation: String?
    /// Register, pragmatic meaning, or cultural context that helps it land.
    var usageNote: String?
    /// The keyword-mnemonic pair — see the `catalanWords` comment in
    /// SeedContent.swift for what makes one work. `sounds` is the bridge: what
    /// the word sounds like in English and nothing else. `picture` is the one
    /// absurd scene that holds that sound and the meaning together, so that
    /// remembering the scene hands the word back. A bridge with no scene
    /// hanging off it prints nothing — it is a riddle with its answer torn off.
    /// Any card can carry them, not only a Paraules word.
    var sounds: String?
    var picture: String?
    /// Blue or pink in the picture — see `Gender`. Only needed where the
    /// article elides and the card cannot be read for it.
    var gender: Gender?
    /// Dot, line, or both — set only on cards that drill the shape of the past.
    /// A phrase without one is never asked the question.
    var aspect: Aspect?
    /// Why *this* sentence is that shape. Shown with the verdict once you have
    /// chosen, so a wrong answer explains itself.
    var aspectNote: String?
    var createdAt: Date = Date()
    /// Set when the phrase was jotted down in the moment and still needs
    /// its target-language text filled in.
    var isCapture: Bool = false

    var isReadyToDrill: Bool { !text.trimmed.isEmpty }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
