import Foundation

/// The languages Xerra can drill. Catalan is the focus; Spanish (Spain) is wired
/// up from the start so switching later is a settings change, not a rewrite.
///
/// Both locales are supported by Azure Pronunciation Assessment and by Apple's
/// on-device `SFSpeechRecognizer`, so every feature works in either language.
enum Language: String, Codable, CaseIterable, Identifiable, Hashable {
    case catalan = "ca-ES"
    case spanish = "es-ES"

    var id: String { rawValue }

    /// BCP-47 locale used for speech recognition and pronunciation assessment.
    var localeIdentifier: String { rawValue }

    var displayName: String {
        switch self {
        case .catalan: "Català"
        case .spanish: "Español (España)"
        }
    }

    var englishName: String {
        switch self {
        case .catalan: "Catalan"
        case .spanish: "Spanish (Spain)"
        }
    }

    var flag: String {
        switch self {
        case .catalan: "🎗️"
        case .spanish: "🇪🇸"
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
        }
    }

    var defaultAzureVoice: String { azureVoices[0].id }
}

struct AzureVoice: Identifiable, Hashable, Codable {
    let id: String
    let name: String
    let gender: String
}
