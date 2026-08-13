import Foundation

/// Azure Pronunciation Assessment.
///
/// Catalan (`ca-ES`) is on Azure's supported locale list for assessment, which
/// is unusual for a language this size and is the reason this app can offer
/// real per-phoneme feedback rather than a rough guess. Spanish (`es-ES`) is on
/// the same list, so switching languages later needs no work here.
struct AzurePronunciationScorer {
    let key: String
    let region: String

    func score(recording: URL, referenceText: String, language: Language) async throws -> Attempt.Scoring {
        guard !key.isEmpty, !region.isEmpty else { throw TTSError.missingCredentials }
        guard let audio = AudioConverter.wavData(from: recording) else {
            throw TTSError.synthesisFailed("Couldn't read the recording.")
        }

        let assessment: [String: Any] = [
            "ReferenceText": referenceText,
            "GradingSystem": "HundredMark",
            "Granularity": "Phoneme",
            "Dimension": "Comprehensive",
            "EnableMiscue": true,
        ]
        guard let assessmentData = try? JSONSerialization.data(withJSONObject: assessment) else {
            throw TTSError.synthesisFailed("Couldn't build the assessment request.")
        }

        var components = URLComponents(
            string: "https://\(region).stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
        )!
        components.queryItems = [
            URLQueryItem(name: "language", value: language.rawValue),
            URLQueryItem(name: "format", value: "detailed"),
        ]

        let sampleRate = Int(AudioConverter.sampleRate(of: recording))

        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(key, forHTTPHeaderField: "Ocp-Apim-Subscription-Key")
        request.setValue(
            "audio/wav; codecs=audio/pcm; samplerate=\(sampleRate)",
            forHTTPHeaderField: "Content-Type"
        )
        request.setValue(assessmentData.base64EncodedString(), forHTTPHeaderField: "Pronunciation-Assessment")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = audio
        request.timeoutInterval = 45

        let (data, response) = try await URLSession.shared.data(for: request)

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw TTSError.http(http.statusCode, body.prefix(200).description)
        }

        let decoded = try JSONDecoder().decode(AzureAssessmentResponse.self, from: data)
        guard decoded.recognitionStatus == "Success", let best = decoded.nBest?.first else {
            throw TTSError.synthesisFailed(
                decoded.recognitionStatus == "NoMatch"
                    ? "Azure couldn't make out any speech — try recording again, a little closer to the mic."
                    : "Azure returned status \(decoded.recognitionStatus)."
            )
        }

        let words = (best.words ?? []).map { word in
            WordScore(
                word: word.word,
                score: word.pronunciationAssessment?.accuracyScore,
                errorType: word.pronunciationAssessment?.errorType,
                phonemes: (word.phonemes ?? []).map {
                    PhonemeScore(phoneme: $0.phoneme, score: $0.pronunciationAssessment?.accuracyScore)
                }
            )
        }

        return Attempt.Scoring(
            overall: best.pronunciationAssessment?.pronScore,
            accuracy: best.pronunciationAssessment?.accuracyScore,
            fluency: best.pronunciationAssessment?.fluencyScore,
            completeness: best.pronunciationAssessment?.completenessScore,
            transcript: best.display ?? decoded.displayText,
            words: words,
            engine: .azure
        )
    }
}

// MARK: - Response shape

private struct AzureAssessmentResponse: Decodable {
    let recognitionStatus: String
    let displayText: String?
    let nBest: [NBest]?

    enum CodingKeys: String, CodingKey {
        case recognitionStatus = "RecognitionStatus"
        case displayText = "DisplayText"
        case nBest = "NBest"
    }

    struct NBest: Decodable {
        let display: String?
        let pronunciationAssessment: Assessment?
        let words: [Word]?

        enum CodingKeys: String, CodingKey {
            case display = "Display"
            case pronunciationAssessment = "PronunciationAssessment"
            case words = "Words"
        }
    }

    struct Assessment: Decodable {
        let accuracyScore: Double?
        let fluencyScore: Double?
        let completenessScore: Double?
        let pronScore: Double?
        let errorType: String?

        enum CodingKeys: String, CodingKey {
            case accuracyScore = "AccuracyScore"
            case fluencyScore = "FluencyScore"
            case completenessScore = "CompletenessScore"
            case pronScore = "PronScore"
            case errorType = "ErrorType"
        }
    }

    struct Word: Decodable {
        let word: String
        let pronunciationAssessment: Assessment?
        let phonemes: [Phoneme]?

        enum CodingKeys: String, CodingKey {
            case word = "Word"
            case pronunciationAssessment = "PronunciationAssessment"
            case phonemes = "Phonemes"
        }
    }

    struct Phoneme: Decodable {
        let phoneme: String
        let pronunciationAssessment: Assessment?

        enum CodingKeys: String, CodingKey {
            case phoneme = "Phoneme"
            case pronunciationAssessment = "PronunciationAssessment"
        }
    }
}
