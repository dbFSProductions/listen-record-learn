import Foundation

/// One recorded go at a phrase, kept so you can hear last week's you
/// against today's you.
struct Attempt: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var phraseID: UUID
    var recordedAt: Date = Date()
    /// File name inside the recordings directory (not a full path — the app's
    /// container path changes between installs, which matters a lot when the
    /// app is reinstalled every 7 days on a free provisioning profile).
    var fileName: String
    var duration: TimeInterval = 0

    var overall: Double?
    var accuracy: Double?
    var fluency: Double?
    var completeness: Double?
    var transcript: String?
    var words: [WordScore] = []
    var engine: ScoringEngine = .none

    var url: URL { AudioStore.recordingsDirectory.appendingPathComponent(fileName) }

    var hasScore: Bool { overall != nil }

    /// The part a scoring engine produces, kept separate from the recording
    /// itself so an attempt can be saved immediately and scored afterwards.
    struct Scoring {
        var overall: Double?
        var accuracy: Double?
        var fluency: Double?
        var completeness: Double?
        var transcript: String?
        var words: [WordScore] = []
        var engine: ScoringEngine = .none
    }

    mutating func apply(_ scoring: Scoring) {
        overall = scoring.overall
        accuracy = scoring.accuracy
        fluency = scoring.fluency
        completeness = scoring.completeness
        transcript = scoring.transcript
        words = scoring.words
        engine = scoring.engine
    }
}

struct WordScore: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var word: String
    /// 0–100 accuracy for this word, when the engine provides it.
    var score: Double?
    /// Azure error types: None, Omission, Insertion, Mispronunciation.
    var errorType: String?
    var phonemes: [PhonemeScore] = []

    var isProblem: Bool {
        if let errorType, errorType != "None" { return true }
        if let score { return score < 60 }
        return false
    }
}

struct PhonemeScore: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var phoneme: String
    var score: Double?
}

enum ScoringEngine: String, Codable, Hashable {
    case azure = "Azure"
    case apple = "Apple on-device"
    case none = "Not scored"
}
