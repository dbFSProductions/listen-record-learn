import AVFoundation

/// Converts recordings into the format Azure's speech endpoint accepts:
/// 16-bit linear PCM WAV, 16 kHz, mono.
///
/// The recorder already captures at 16 kHz mono, so this is a container and
/// bit-depth change rather than a resample.
enum AudioConverter {
    static func wavData(from source: URL) -> Data? {
        guard let input = try? AVAudioFile(forReading: source) else { return nil }

        let temporary = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("wav")

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: input.processingFormat.sampleRate,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false,
        ]

        do {
            let output = try AVAudioFile(forWriting: temporary, settings: settings)
            let bufferCapacity: AVAudioFrameCount = 8192

            while input.framePosition < input.length {
                guard let buffer = AVAudioPCMBuffer(
                    pcmFormat: input.processingFormat,
                    frameCapacity: bufferCapacity
                ) else { break }
                try input.read(into: buffer)
                if buffer.frameLength == 0 { break }
                try output.write(from: buffer)
            }
        } catch {
            try? FileManager.default.removeItem(at: temporary)
            return nil
        }

        let data = try? Data(contentsOf: temporary)
        try? FileManager.default.removeItem(at: temporary)
        return data
    }

    /// Sample rate of a recording, needed for Azure's Content-Type header.
    static func sampleRate(of url: URL) -> Double {
        (try? AVAudioFile(forReading: url))?.processingFormat.sampleRate ?? 16_000
    }
}
