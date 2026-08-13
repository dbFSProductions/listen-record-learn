import AVFoundation
import Observation

/// Records your voice to an m4a in the recordings directory.
///
/// Records at 16 kHz mono: that's what Azure's assessment endpoint and Apple's
/// recogniser both want, it keeps files small, and it's plenty for pitch and
/// waveform analysis.
@Observable
final class Recorder: NSObject {
    private(set) var isRecording = false
    private(set) var level: Float = 0
    private(set) var elapsed: TimeInterval = 0
    private(set) var permissionDenied = false

    private var recorder: AVAudioRecorder?
    private var meterTimer: Timer?
    private var currentFileName: String?

    /// Starts recording, asking for the microphone first if needed.
    func start(completion: @escaping (Bool) -> Void = { _ in }) {
        AudioSessionManager.requestMicrophonePermission { [weak self] granted in
            guard let self else { return }
            guard granted else {
                self.permissionDenied = true
                completion(false)
                return
            }
            self.permissionDenied = false
            self.beginRecording()
            completion(self.isRecording)
        }
    }

    private func beginRecording() {
        AudioSessionManager.configureForPlaybackAndRecording()

        let fileName = AudioStore.newRecordingFileName()
        let url = AudioStore.recordingsDirectory.appendingPathComponent(fileName)

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]

        do {
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.isMeteringEnabled = true
            recorder.prepareToRecord()
            recorder.record()

            self.recorder = recorder
            currentFileName = fileName
            isRecording = true
            elapsed = 0
            startMetering()
        } catch {
            isRecording = false
            recorder = nil
            currentFileName = nil
        }
    }

    /// Stops and returns the finished recording, or nil if nothing usable was captured.
    @discardableResult
    func stop() -> (fileName: String, duration: TimeInterval)? {
        guard let recorder, let fileName = currentFileName else { return nil }
        let duration = recorder.currentTime
        recorder.stop()
        stopMetering()

        self.recorder = nil
        currentFileName = nil
        isRecording = false
        level = 0

        // Anything under a fifth of a second is a mis-tap, not an attempt.
        guard duration > 0.2 else {
            try? FileManager.default.removeItem(at: AudioStore.recordingsDirectory.appendingPathComponent(fileName))
            return nil
        }
        return (fileName, duration)
    }

    func cancel() {
        guard let recorder, let fileName = currentFileName else { return }
        recorder.stop()
        stopMetering()
        try? FileManager.default.removeItem(at: AudioStore.recordingsDirectory.appendingPathComponent(fileName))
        self.recorder = nil
        currentFileName = nil
        isRecording = false
        level = 0
    }

    // MARK: - Metering

    private func startMetering() {
        meterTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            guard let self, let recorder = self.recorder else { return }
            recorder.updateMeters()
            // Map dBFS onto 0...1 with a floor at -50 dB so the meter has some life in it.
            let power = recorder.averagePower(forChannel: 0)
            let normalised = max(0, (power + 50) / 50)
            self.level = normalised
            self.elapsed = recorder.currentTime
        }
    }

    private func stopMetering() {
        meterTimer?.invalidate()
        meterTimer = nil
    }
}
