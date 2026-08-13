import Foundation
import Observation

/// Everything you've added and every attempt you've made, persisted as plain
/// JSON in Documents. Deliberately boring: it's inspectable, trivially
/// backed up, and survives the weekly reinstall that free provisioning forces.
@Observable
final class Library {
    private(set) var phrases: [Phrase] = []
    private(set) var attempts: [Attempt] = []

    private let phrasesURL = AudioStore.documents.appendingPathComponent("phrases.json")
    private let attemptsURL = AudioStore.documents.appendingPathComponent("attempts.json")

    init() {
        load()
        if phrases.isEmpty {
            phrases = SeedContent.catalanStarterDecks
            savePhrases()
        }
    }

    // MARK: - Reading

    var decks: [String] {
        var seen = Set<String>()
        return phrases.compactMap { seen.insert($0.deck).inserted ? $0.deck : nil }.sorted()
    }

    func phrases(inDeck deck: String?, language: Language) -> [Phrase] {
        phrases.filter { $0.language == language && (deck == nil || $0.deck == deck) }
    }

    func attempts(for phraseID: UUID) -> [Attempt] {
        attempts.filter { $0.phraseID == phraseID }.sorted { $0.recordedAt > $1.recordedAt }
    }

    func bestScore(for phraseID: UUID) -> Double? {
        attempts(for: phraseID).compactMap(\.overall).max()
    }

    func latestAttempt(for phraseID: UUID) -> Attempt? {
        attempts(for: phraseID).first
    }

    // MARK: - Writing

    func add(_ phrase: Phrase) {
        phrases.append(phrase)
        savePhrases()
    }

    func update(_ phrase: Phrase) {
        guard let index = phrases.firstIndex(where: { $0.id == phrase.id }) else { return }
        phrases[index] = phrase
        savePhrases()
    }

    func delete(_ phrase: Phrase) {
        phrases.removeAll { $0.id == phrase.id }
        for attempt in attempts(for: phrase.id) { delete(attempt) }
        savePhrases()
    }

    func record(_ attempt: Attempt) {
        attempts.append(attempt)
        saveAttempts()
    }

    func update(_ attempt: Attempt) {
        guard let index = attempts.firstIndex(where: { $0.id == attempt.id }) else { return }
        attempts[index] = attempt
        saveAttempts()
    }

    func delete(_ attempt: Attempt) {
        attempts.removeAll { $0.id == attempt.id }
        try? FileManager.default.removeItem(at: attempt.url)
        saveAttempts()
    }

    // MARK: - Persistence

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let data = try? Data(contentsOf: phrasesURL),
           let decoded = try? decoder.decode([Phrase].self, from: data) {
            phrases = decoded
        }
        if let data = try? Data(contentsOf: attemptsURL),
           let decoded = try? decoder.decode([Attempt].self, from: data) {
            attempts = decoded
        }
    }

    private func savePhrases() { write(phrases, to: phrasesURL) }
    private func saveAttempts() { write(attempts, to: attemptsURL) }

    private func write<T: Encodable>(_ value: T, to url: URL) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(value) else { return }
        try? data.write(to: url, options: .atomic)
    }

    /// Everything in one file, for backup or moving to a new install.
    func exportJSON() -> Data? {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try? encoder.encode(Backup(phrases: phrases, attempts: attempts))
    }

    struct Backup: Codable {
        var phrases: [Phrase]
        var attempts: [Attempt]
    }
}
