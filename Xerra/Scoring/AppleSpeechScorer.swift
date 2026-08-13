import Speech

/// On-device scoring using Apple's Catalan speech recogniser.
///
/// Coarser than Azure — it tells you *which words* didn't come out, not which
/// sounds — but it's free, private, works with no signal, and needs no account.
/// This is what runs before you've entered a key, and whenever Azure is
/// unreachable.
struct AppleSpeechScorer {

    static func requestAuthorisation() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
    }

    static func isAvailable(for language: Language) -> Bool {
        guard let recogniser = SFSpeechRecognizer(locale: Locale(identifier: language.localeIdentifier)) else {
            return false
        }
        return recogniser.isAvailable
    }

    func score(recording: URL, referenceText: String, language: Language) async throws -> Attempt.Scoring {
        guard await Self.requestAuthorisation() else {
            throw ScoringError.notAuthorised
        }
        guard let recogniser = SFSpeechRecognizer(locale: Locale(identifier: language.localeIdentifier)),
              recogniser.isAvailable else {
            throw ScoringError.recogniserUnavailable(language.englishName)
        }

        let request = SFSpeechURLRecognitionRequest(url: recording)
        request.shouldReportPartialResults = false
        // Prefer on-device so this keeps working in a bar with no signal.
        if recogniser.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        let transcript: String = try await withCheckedThrowingContinuation { continuation in
            var resumed = false
            _ = recogniser.recognitionTask(with: request) { result, error in
                guard !resumed else { return }
                if let error {
                    resumed = true
                    continuation.resume(throwing: error)
                    return
                }
                if let result, result.isFinal {
                    resumed = true
                    continuation.resume(returning: result.bestTranscription.formattedString)
                }
            }
        }

        return Self.compare(transcript: transcript, reference: referenceText)
    }

    // MARK: - Word alignment

    /// Aligns what you said against the target and marks each target word as
    /// hit or missed. Comparison folds diacritics and case so a recogniser
    /// dropping an accent doesn't read as a mispronunciation.
    static func compare(transcript: String, reference: String) -> Attempt.Scoring {
        let referenceWords = tokenise(reference)
        let heardWords = tokenise(transcript)

        guard !referenceWords.isEmpty else {
            return Attempt.Scoring(transcript: transcript, engine: .apple)
        }

        var remaining = heardWords
        var words: [WordScore] = []
        var hits = 0

        for word in referenceWords {
            let normalised = normalise(word)
            if let index = remaining.firstIndex(where: { normalise($0) == normalised }) {
                remaining.removeFirst(index + 1)
                words.append(WordScore(word: word, score: 100, errorType: "None"))
                hits += 1
            } else if let index = remaining.firstIndex(where: { similarity(normalise($0), normalised) > 0.7 }) {
                // Close but not exact — most likely a real mispronunciation.
                let heard = remaining[index]
                remaining.removeFirst(index + 1)
                words.append(WordScore(
                    word: word,
                    score: similarity(normalise(heard), normalised) * 100,
                    errorType: "Mispronunciation"
                ))
                hits += 1
            } else {
                words.append(WordScore(word: word, score: 0, errorType: "Omission"))
            }
        }

        let scored = words.compactMap(\.score)
        let overall = scored.isEmpty ? nil : scored.reduce(0, +) / Double(scored.count)
        let completeness = Double(hits) / Double(referenceWords.count) * 100

        return Attempt.Scoring(
            overall: overall,
            accuracy: overall,
            fluency: nil,
            completeness: completeness,
            transcript: transcript,
            words: words,
            engine: .apple
        )
    }

    static func tokenise(_ text: String) -> [String] {
        text.components(separatedBy: CharacterSet.whitespacesAndNewlines)
            .map { $0.trimmingCharacters(in: CharacterSet(charactersIn: ".,!?;:¿¡\"“”()…–—")) }
            .filter { !$0.isEmpty }
    }

    static func normalise(_ word: String) -> String {
        word.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US"))
            .replacingOccurrences(of: "’", with: "'")
    }

    /// Normalised Levenshtein similarity, 0...1.
    static func similarity(_ a: String, _ b: String) -> Double {
        if a == b { return 1 }
        if a.isEmpty || b.isEmpty { return 0 }

        let first = Array(a)
        let second = Array(b)
        var previous = Array(0...second.count)
        var current = [Int](repeating: 0, count: second.count + 1)

        for i in 1...first.count {
            current[0] = i
            for j in 1...second.count {
                let cost = first[i - 1] == second[j - 1] ? 0 : 1
                current[j] = min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
            }
            previous = current
        }

        let distance = Double(previous[second.count])
        return 1 - distance / Double(max(first.count, second.count))
    }
}

enum ScoringError: LocalizedError {
    case notAuthorised
    case recogniserUnavailable(String)

    var errorDescription: String? {
        switch self {
        case .notAuthorised:
            "Speech recognition permission was declined. Enable it in Settings › Xerra."
        case .recogniserUnavailable(let language):
            "iOS has no \(language) recogniser available on this device right now."
        }
    }
}
