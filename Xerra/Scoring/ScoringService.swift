import Foundation
import Observation

/// Chooses the best scorer available and falls back cleanly.
///
/// Azure when a key is set (per-phoneme detail), Apple on-device otherwise
/// (word-level). If Azure fails mid-session — dead signal, rate limit — the
/// attempt still gets scored rather than being lost.
@Observable
final class ScoringService {
    private(set) var isScoring = false
    private(set) var lastError: String?
    /// Set when Azure was configured but we had to use the on-device engine,
    /// so the UI can say so instead of silently downgrading.
    private(set) var didFallBack = false

    func score(recording: URL, phrase: Phrase, settings: AppSettings) async -> Attempt.Scoring? {
        isScoring = true
        didFallBack = false
        defer { isScoring = false }

        if settings.hasAzure {
            let scorer = AzurePronunciationScorer(key: settings.azureKey, region: settings.azureRegion.trimmed)
            do {
                let scoring = try await scorer.score(
                    recording: recording,
                    referenceText: phrase.text,
                    language: phrase.language
                )
                lastError = nil
                return scoring
            } catch {
                lastError = error.localizedDescription
                didFallBack = true
            }
        }

        do {
            let scoring = try await AppleSpeechScorer().score(
                recording: recording,
                referenceText: phrase.text,
                language: phrase.language
            )
            if !didFallBack { lastError = nil }
            return scoring
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }
}
