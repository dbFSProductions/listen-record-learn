import AVFoundation
import Accelerate

/// Signal analysis for the comparison view: waveform envelopes and pitch contours.
///
/// Everything here is deliberately provider-independent — it works on any two
/// audio files, so it keeps working regardless of which TTS engine produced the
/// model clip, and in any language.
enum AudioAnalysis {

    // MARK: - Loading

    /// Reads any audio file (m4a, mp3, wav) into mono float samples.
    static func monoSamples(url: URL) -> (samples: [Float], sampleRate: Double)? {
        guard let file = try? AVAudioFile(forReading: url) else { return nil }
        let format = file.processingFormat
        let frameCount = AVAudioFrameCount(file.length)
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount),
              (try? file.read(into: buffer)) != nil,
              let channelData = buffer.floatChannelData else { return nil }

        let channels = Int(format.channelCount)
        let frames = Int(buffer.frameLength)
        guard frames > 0 else { return nil }

        var samples = [Float](repeating: 0, count: frames)
        samples.withUnsafeMutableBufferPointer { destination in
            guard let base = destination.baseAddress else { return }
            if channels == 1 {
                base.update(from: channelData[0], count: frames)
            } else {
                // Average the channels down to mono. Done with an explicit
                // accumulate rather than in-place vDSP, which would be an
                // overlapping access to the same buffer.
                for channel in 0..<channels {
                    let source = channelData[channel]
                    for frame in 0..<frames { base[frame] += source[frame] }
                }
                let divisor = Float(channels)
                for frame in 0..<frames { base[frame] /= divisor }
            }
        }
        return (samples, format.sampleRate)
    }

    // MARK: - Waveform

    /// An RMS envelope reduced to `bins` points, normalised to 0...1.
    /// Normalising per-clip is intentional: it makes a quiet recording and a
    /// loud TTS clip visually comparable in shape, which is the point.
    static func waveform(samples: [Float], bins: Int = 120) -> [Float] {
        guard !samples.isEmpty, bins > 0 else { return [] }
        let binSize = max(1, samples.count / bins)
        var envelope: [Float] = []
        envelope.reserveCapacity(bins)

        var index = 0
        while index < samples.count && envelope.count < bins {
            let end = min(index + binSize, samples.count)
            var rms: Float = 0
            samples[index..<end].withUnsafeBufferPointer { pointer in
                guard let base = pointer.baseAddress else { return }
                vDSP_rmsqv(base, 1, &rms, vDSP_Length(pointer.count))
            }
            envelope.append(rms)
            index = end
        }

        while envelope.count < bins { envelope.append(0) }

        let peak = envelope.max() ?? 0
        guard peak > 0 else { return envelope }
        return envelope.map { $0 / peak }
    }

    static func waveform(url: URL, bins: Int = 120) -> [Float] {
        guard let loaded = monoSamples(url: url) else { return [] }
        return waveform(samples: trimSilence(loaded.samples), bins: bins)
    }

    /// Drops leading and trailing near-silence so two clips line up on their
    /// speech, not on however long you fumbled for the stop button.
    static func trimSilence(_ samples: [Float], threshold: Float = 0.015) -> [Float] {
        guard !samples.isEmpty else { return samples }
        let window = 256

        func isLoud(from index: Int) -> Bool {
            let end = min(index + window, samples.count)
            guard index < end else { return false }
            var rms: Float = 0
            samples[index..<end].withUnsafeBufferPointer { pointer in
                guard let base = pointer.baseAddress else { return }
                vDSP_rmsqv(base, 1, &rms, vDSP_Length(pointer.count))
            }
            return rms > threshold
        }

        var start = 0
        while start + window < samples.count && !isLoud(from: start) { start += window }

        var end = samples.count - window
        while end > start && !isLoud(from: end) { end -= window }

        guard end > start else { return samples }
        return Array(samples[start..<min(end + window, samples.count)])
    }

    // MARK: - Pitch

    /// Fundamental frequency per frame, in Hz. `nil` marks an unvoiced frame
    /// (consonants, silence) — drawing those as gaps rather than as zero keeps
    /// the contour honest.
    ///
    /// Normalised autocorrelation over a 40 ms window every 10 ms, searching
    /// 60–400 Hz, which comfortably spans both a male TTS voice and a raised
    /// question intonation.
    static func pitchContour(samples: [Float], sampleRate: Double) -> [Double?] {
        guard sampleRate > 0, !samples.isEmpty else { return [] }

        let frameLength = Int(0.04 * sampleRate)
        let hopLength = Int(0.01 * sampleRate)
        let minLag = Int(sampleRate / 400)
        let maxLag = Int(sampleRate / 60)
        guard frameLength > maxLag, samples.count > frameLength else { return [] }

        var contour: [Double?] = []
        var start = 0

        while start + frameLength <= samples.count {
            let frame = Array(samples[start..<(start + frameLength)])
            contour.append(fundamental(frame: frame, sampleRate: sampleRate, minLag: minLag, maxLag: maxLag))
            start += hopLength
        }
        return contour
    }

    static func pitchContour(url: URL) -> [Double?] {
        guard let loaded = monoSamples(url: url) else { return [] }
        return pitchContour(samples: trimSilence(loaded.samples), sampleRate: loaded.sampleRate)
    }

    private static func fundamental(frame: [Float], sampleRate: Double, minLag: Int, maxLag: Int) -> Double? {
        var energy: Float = 0
        vDSP_measqv(frame, 1, &energy, vDSP_Length(frame.count))
        // Below this the frame is silence or breath, not a pitched sound.
        guard energy > 0.0004 else { return nil }

        var bestLag = 0
        var bestScore: Float = 0
        let zeroLagEnergy = energy * Float(frame.count)

        for lag in minLag...maxLag {
            var correlation: Float = 0
            let count = frame.count - lag
            guard count > 0 else { break }
            frame.withUnsafeBufferPointer { pointer in
                guard let base = pointer.baseAddress else { return }
                vDSP_dotpr(base, 1, base + lag, 1, &correlation, vDSP_Length(count))
            }
            let normalised = correlation / max(zeroLagEnergy, .leastNonzeroMagnitude)
            if normalised > bestScore {
                bestScore = normalised
                bestLag = lag
            }
        }

        // A weak peak means the frame isn't reliably periodic — call it unvoiced
        // rather than reporting a confident wrong number.
        guard bestLag > 0, bestScore > 0.3 else { return nil }
        return sampleRate / Double(bestLag)
    }

    // MARK: - Comparison

    /// Converts a Hz contour to semitones relative to that speaker's own median.
    ///
    /// This is what makes the overlay meaningful: your voice and the TTS voice
    /// sit in completely different registers, so comparing raw Hz would just
    /// show that one of you is lower. Relative semitones compare the *melody*,
    /// which is the thing you're actually trying to copy.
    static func relativeSemitones(_ contour: [Double?]) -> [Double?] {
        let voiced = contour.compactMap { $0 }.sorted()
        guard !voiced.isEmpty else { return contour.map { _ in nil } }
        let median = voiced[voiced.count / 2]
        guard median > 0 else { return contour.map { _ in nil } }
        return contour.map { value in
            guard let value, value > 0 else { return nil }
            return 12 * log2(value / median)
        }
    }

    /// Stretches a contour onto a fixed number of points so two clips of
    /// different lengths can be drawn on the same x-axis.
    static func resample(_ contour: [Double?], to count: Int) -> [Double?] {
        guard count > 0 else { return [] }
        guard contour.count > 1 else { return Array(repeating: contour.first ?? nil, count: count) }
        return (0..<count).map { index in
            let position = Double(index) / Double(count - 1) * Double(contour.count - 1)
            return contour[Int(position.rounded())]
        }
    }

    static func resample(_ envelope: [Float], to count: Int) -> [Float] {
        guard count > 0 else { return [] }
        guard envelope.count > 1 else { return Array(repeating: envelope.first ?? 0, count: count) }
        return (0..<count).map { index in
            let position = Double(index) / Double(count - 1) * Double(envelope.count - 1)
            return envelope[Int(position.rounded())]
        }
    }

    /// How your clip's length compares to the model's. Speaking a second
    /// language too slowly is the most common tell, and it's easy to fix once
    /// you can see it.
    static func timingRatio(model: URL, attempt: URL) -> Double? {
        guard let modelAudio = monoSamples(url: model),
              let attemptAudio = monoSamples(url: attempt) else { return nil }
        let modelDuration = Double(trimSilence(modelAudio.samples).count) / modelAudio.sampleRate
        let attemptDuration = Double(trimSilence(attemptAudio.samples).count) / attemptAudio.sampleRate
        guard modelDuration > 0.05, attemptDuration > 0.05 else { return nil }
        return attemptDuration / modelDuration
    }
}
