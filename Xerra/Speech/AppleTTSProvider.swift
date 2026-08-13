import AVFoundation

/// Apple's built-in speech synthesis, written out to a file so the rest of the
/// app can treat it exactly like a downloaded clip.
///
/// Free, offline, no account, available the moment the app launches. Quality is
/// below Azure's neural voices, which is why this is the fallback rather than
/// the default — but it means the app is never broken and never blocked.
final class AppleTTSProvider: NSObject, TTSProvider {
    var cacheIdentifier: String { "apple" }
    var fileExtension: String { "caf" }
    var displayName: String { "iOS built-in voice" }

    private let synthesiser = AVSpeechSynthesizer()

    /// Whether iOS actually has a voice installed for this language. If not,
    /// the synthesiser silently produces nothing, so it's worth checking.
    static func hasVoice(for language: Language) -> Bool {
        AVSpeechSynthesisVoice.speechVoices().contains { $0.language.hasPrefix(language.rawValue.prefix(2)) }
    }

    static func bestVoice(for language: Language) -> AVSpeechSynthesisVoice? {
        let candidates = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language == language.rawValue }

        // Prefer the higher-quality downloadable voices when the user has them.
        if let premium = candidates.first(where: { $0.quality == .premium }) { return premium }
        if let enhanced = candidates.first(where: { $0.quality == .enhanced }) { return enhanced }
        if let match = candidates.first { return match }

        // Fall back to any voice whose language starts with the same code.
        return AVSpeechSynthesisVoice.speechVoices()
            .first { $0.language.hasPrefix(language.rawValue.prefix(2)) }
    }

    func synthesise(text: String, language: Language, to destination: URL) async throws {
        guard let voice = Self.bestVoice(for: language) else {
            throw TTSError.synthesisFailed(
                "iOS has no \(language.englishName) voice installed. Add one in Settings › Accessibility › Spoken Content › Voices."
            )
        }

        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate

        try? FileManager.default.removeItem(at: destination)

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var audioFile: AVAudioFile?
            var wroteAnything = false
            var finished = false

            synthesiser.write(utterance) { buffer in
                guard !finished else { return }
                guard let pcmBuffer = buffer as? AVAudioPCMBuffer else { return }

                // A zero-length buffer is how AVSpeechSynthesizer signals the end.
                if pcmBuffer.frameLength == 0 {
                    finished = true
                    audioFile = nil
                    if wroteAnything {
                        continuation.resume()
                    } else {
                        continuation.resume(throwing: TTSError.emptyResponse)
                    }
                    return
                }

                do {
                    if audioFile == nil {
                        audioFile = try AVAudioFile(
                            forWriting: destination,
                            settings: pcmBuffer.format.settings,
                            commonFormat: pcmBuffer.format.commonFormat,
                            interleaved: pcmBuffer.format.isInterleaved
                        )
                    }
                    try audioFile?.write(from: pcmBuffer)
                    wroteAnything = true
                } catch {
                    finished = true
                    audioFile = nil
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}
