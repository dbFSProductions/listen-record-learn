import Foundation
import Observation

/// The app's single entry point for "give me the model audio for this phrase".
///
/// Resolves the best available provider, serves from the on-disk cache when it
/// can, and synthesises only when it must. Callers never deal with providers,
/// keys, or network state.
@Observable
final class SpeechService {
    private(set) var isSynthesising = false
    private(set) var lastError: String?

    private let appleProvider = AppleTTSProvider()

    /// Picks Azure when credentials are present, Apple otherwise.
    func provider(settings: AppSettings) -> TTSProvider {
        if settings.hasAzure {
            return AzureTTSProvider(
                key: settings.azureKey,
                region: settings.azureRegion.trimmed,
                voice: settings.azureVoice
            )
        }
        return appleProvider
    }

    func cachedURL(for phrase: Phrase, settings: AppSettings) -> URL? {
        let provider = provider(settings: settings)
        let url = AudioStore.modelAudioURL(
            text: phrase.text,
            voice: provider.cacheIdentifier,
            language: phrase.language,
            fileExtension: provider.fileExtension
        )
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    /// Returns model audio for a phrase, generating and caching it if needed.
    ///
    /// If Azure is configured but unreachable — no signal, bad key, rate limit —
    /// this quietly falls back to the on-device voice rather than leaving you
    /// with a drill you can't hear.
    @discardableResult
    func modelAudio(for phrase: Phrase, settings: AppSettings) async -> URL? {
        guard !phrase.text.trimmed.isEmpty else { return nil }

        let preferred = provider(settings: settings)
        if let url = await audio(for: phrase, using: preferred) { return url }

        if settings.hasAzure {
            // Azure failed; the built-in voice still works offline.
            if let url = await audio(for: phrase, using: appleProvider) { return url }
        }
        return nil
    }

    private func audio(for phrase: Phrase, using provider: TTSProvider) async -> URL? {
        let destination = AudioStore.modelAudioURL(
            text: phrase.text,
            voice: provider.cacheIdentifier,
            language: phrase.language,
            fileExtension: provider.fileExtension
        )

        if FileManager.default.fileExists(atPath: destination.path) { return destination }

        isSynthesising = true
        defer { isSynthesising = false }

        do {
            try await provider.synthesise(text: phrase.text, language: phrase.language, to: destination)
            lastError = nil
            return destination
        } catch {
            lastError = error.localizedDescription
            try? FileManager.default.removeItem(at: destination)
            return nil
        }
    }

    /// Warms the cache for a whole deck so a session runs without waiting on
    /// the network — worth doing over wifi before you go out.
    func prefetch(_ phrases: [Phrase], settings: AppSettings, progress: @escaping (Int, Int) -> Void) async {
        let drillable = phrases.filter { $0.isReadyToDrill }
        for (index, phrase) in drillable.enumerated() {
            await modelAudio(for: phrase, settings: settings)
            progress(index + 1, drillable.count)
        }
    }
}
