import Foundation

/// Azure neural text-to-speech.
///
/// Catalan gets three genuinely good neural voices here (Joana, Enric, Alba)
/// built on Catalan phonology rather than a multilingual model reading Catalan
/// with a Spanish accent — which matters when the accent is the thing you're
/// training.
///
/// Each phrase is synthesised once and cached on disk, so ongoing cost and
/// latency are both effectively zero and drilling works offline.
struct AzureTTSProvider: TTSProvider {
    let key: String
    let region: String
    let voice: String

    var cacheIdentifier: String { "azure-\(voice)" }
    var fileExtension: String { "mp3" }
    var displayName: String { "Azure · \(voice.components(separatedBy: "-").dropFirst(2).first ?? voice)" }

    func synthesise(text: String, language: Language, to destination: URL) async throws {
        guard !key.isEmpty, !region.isEmpty else { throw TTSError.missingCredentials }

        var request = URLRequest(url: URL(string: "https://\(region).tts.speech.microsoft.com/cognitiveservices/v1")!)
        request.httpMethod = "POST"
        request.setValue(key, forHTTPHeaderField: "Ocp-Apim-Subscription-Key")
        request.setValue("application/ssml+xml", forHTTPHeaderField: "Content-Type")
        request.setValue("audio-24khz-96kbitrate-mono-mp3", forHTTPHeaderField: "X-Microsoft-OutputFormat")
        request.setValue("Xerra", forHTTPHeaderField: "User-Agent")
        request.httpBody = Self.ssml(text: text, language: language, voice: voice).data(using: .utf8)
        request.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: request)

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw TTSError.http(http.statusCode, body.prefix(200).description)
        }
        guard !data.isEmpty else { throw TTSError.emptyResponse }

        try data.write(to: destination, options: .atomic)
    }

    static func ssml(text: String, language: Language, voice: String) -> String {
        """
        <speak version='1.0' xml:lang='\(language.rawValue)'>
          <voice xml:lang='\(language.rawValue)' name='\(voice)'>
            \(escape(text))
          </voice>
        </speak>
        """
    }

    private static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }

    /// Cheap credential check for the settings screen: synthesises one short
    /// word and reports whether Azure accepted it.
    func validate(language: Language) async -> Result<Void, Error> {
        let probe = AudioStore.documents.appendingPathComponent("azure-probe.mp3")
        do {
            try await synthesise(text: "Hola", language: language, to: probe)
            try? FileManager.default.removeItem(at: probe)
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}
