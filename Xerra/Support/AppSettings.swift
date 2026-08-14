import Foundation
import Observation

/// User preferences. The Azure key lives in the Keychain, never in
/// UserDefaults and never in the repository.
@Observable
final class AppSettings {
    var language: Language {
        didSet { defaults.set(language.rawValue, forKey: Keys.language) }
    }

    var azureVoice: String {
        didSet { defaults.set(azureVoice, forKey: Keys.azureVoice) }
    }

    var azureRegion: String {
        didSet { defaults.set(azureRegion, forKey: Keys.azureRegion) }
    }

    var slowRate: Double {
        didSet { defaults.set(slowRate, forKey: Keys.slowRate) }
    }

    var showTranslationUpFront: Bool {
        didSet { defaults.set(showTranslationUpFront, forKey: Keys.showTranslation) }
    }

    /// Azure Speech key. Empty means "use Apple's built-in voice and
    /// on-device recogniser" — the app is fully usable in that state.
    var azureKey: String {
        get { Keychain.read(Keys.azureKey) ?? "" }
        set {
            if newValue.trimmed.isEmpty {
                Keychain.delete(Keys.azureKey)
            } else {
                Keychain.write(newValue.trimmed, for: Keys.azureKey)
            }
        }
    }

    var hasAzure: Bool { !azureKey.isEmpty && !azureRegion.trimmed.isEmpty }

    private let defaults = UserDefaults.standard

    init() {
        let stored = defaults.string(forKey: Keys.language) ?? Language.catalan.rawValue
        let resolved = Language(rawValue: stored) ?? .catalan
        language = resolved
        azureVoice = defaults.string(forKey: Keys.azureVoice) ?? resolved.defaultAzureVoice
        azureRegion = defaults.string(forKey: Keys.azureRegion) ?? "northeurope"
        slowRate = defaults.object(forKey: Keys.slowRate) as? Double ?? 0.65
        showTranslationUpFront = defaults.object(forKey: Keys.showTranslation) as? Bool ?? true
    }

    /// Keeps the selected voice valid when the language changes.
    func languageDidChange(to newLanguage: Language) {
        language = newLanguage
        if !newLanguage.azureVoices.contains(where: { $0.id == azureVoice }) {
            azureVoice = newLanguage.defaultAzureVoice
        }
    }

    private enum Keys {
        static let language = "settings.language"
        static let azureVoice = "settings.azureVoice"
        static let azureRegion = "settings.azureRegion"
        static let slowRate = "settings.slowRate"
        static let showTranslation = "settings.showTranslation"
        static let azureKey = "com.xerra.azureSpeechKey"
    }
}
