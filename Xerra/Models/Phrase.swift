import Foundation

/// Which shape in the past a sentence is: a dot is one finished moment, a line
/// is a stretch of it, some sentences are a line with a dot cutting across, and
/// the two perfects sit off the main timeline — a dot before the dot you are
/// talking about, and a line dashed forward into the dot of now.
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
