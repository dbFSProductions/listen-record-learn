import Foundation

/// A source of model pronunciation audio.
///
/// The app ships working with `AppleTTSProvider` and upgrades itself to
/// `AzureTTSProvider` the moment a key is entered — nothing else in the app
/// knows or cares which one produced the file.
protocol TTSProvider {
    /// Stable identifier used in the audio cache key so switching providers
    /// or voices never serves a stale clip.
    var cacheIdentifier: String { get }
    var fileExtension: String { get }
    var displayName: String { get }

    /// Synthesises `text` and writes it to `destination`.
    func synthesise(text: String, language: Language, to destination: URL) async throws
}

enum TTSError: LocalizedError {
    case synthesisFailed(String)
    case missingCredentials
    case emptyResponse
    case http(Int, String)

    var errorDescription: String? {
        switch self {
        case .synthesisFailed(let detail): "Couldn't generate the audio: \(detail)"
        case .missingCredentials: "No Azure key set."
        case .emptyResponse: "The voice service returned no audio."
        case .http(let code, let body):
            switch code {
            case 401, 403: "Azure rejected the key (HTTP \(code)). Check the key and that the region matches the resource."
            case 429: "Azure rate limit reached (HTTP 429). Wait a moment and try again."
            default: "Azure returned HTTP \(code). \(body)"
            }
        }
    }
}
