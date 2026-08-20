import Foundation

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
    var createdAt: Date = Date()
    /// Set when the phrase was jotted down in the moment and still needs
    /// its target-language text filled in.
    var isCapture: Bool = false

    var isReadyToDrill: Bool { !text.trimmed.isEmpty }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
