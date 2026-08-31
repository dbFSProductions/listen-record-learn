import Foundation

/// The languages Xerra can drill. Catalan is the focus; Spanish (Spain) and
/// Italian are wired up on the same terms, so switching later is a settings
/// change rather than a rewrite. Spanish now carries the six past-tense decks
/// in `SeedContent.spanishPastDecks`; Italian carries nothing and starts as an
/// empty library you fill from the Add tab.
///
/// Every locale here is supported by Azure Pronunciation Assessment and by
/// Apple's on-device `SFSpeechRecognizer`, so no feature is lost by switching.
enum Language: String, Codable, CaseIterable, Identifiable, Hashable {
    case catalan = "ca-ES"
    case spanish = "es-ES"
    case italian = "it-IT"

    var id: String { rawValue }

    /// BCP-47 locale used for speech recognition and pronunciation assessment.
    var localeIdentifier: String { rawValue }

    var displayName: String {
        switch self {
        case .catalan: "Català"
        case .spanish: "Español (España)"
        case .italian: "Italiano"
        }
    }

    var englishName: String {
        switch self {
        case .catalan: "Catalan"
        case .spanish: "Spanish (Spain)"
        case .italian: "Italian"
        }
    }

    var flag: String {
        switch self {
        case .catalan: "🎗️"
        case .spanish: "🇪🇸"
        case .italian: "🇮🇹"
        }
    }

    /// Azure neural voices available for this language, best first.
    var azureVoices: [AzureVoice] {
        switch self {
        case .catalan:
            [
                AzureVoice(id: "ca-ES-JoanaNeural", name: "Joana", gender: "Female"),
                AzureVoice(id: "ca-ES-EnricNeural", name: "Enric", gender: "Male"),
                AzureVoice(id: "ca-ES-AlbaNeural", name: "Alba", gender: "Female"),
            ]
        case .spanish:
            [
                AzureVoice(id: "es-ES-ElviraNeural", name: "Elvira", gender: "Female"),
                AzureVoice(id: "es-ES-AlvaroNeural", name: "Álvaro", gender: "Male"),
            ]
        case .italian:
            [
                AzureVoice(id: "it-IT-ElsaNeural", name: "Elsa", gender: "Female"),
                AzureVoice(id: "it-IT-DiegoNeural", name: "Diego", gender: "Male"),
                AzureVoice(id: "it-IT-IsabellaNeural", name: "Isabella", gender: "Female"),
            ]
        }
    }

    var defaultAzureVoice: String { azureVoices[0].id }
}

struct AzureVoice: Identifiable, Hashable, Codable {
    let id: String
    let name: String
    let gender: String
}
