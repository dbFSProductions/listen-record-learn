import AVFoundation

/// One place that owns the audio session, so recording and playback don't
/// fight each other. `.playAndRecord` with `.defaultToSpeaker` keeps playback
/// on the loudspeaker rather than the tiny earpiece after a recording.
enum AudioSessionManager {
    static func configureForPlaybackAndRecording() {
        let session = AVAudioSession.sharedInstance()
        // `.default` rather than `.measurement`: measurement mode bypasses the
        // output processing chain and makes playback noticeably quiet, which
        // matters more here than the small gain in raw mic fidelity.
        try? session.setCategory(
            .playAndRecord,
            mode: .default,
            options: [.defaultToSpeaker, .allowBluetooth]
        )
        try? session.setActive(true)
    }

    static func requestMicrophonePermission(_ completion: @escaping (Bool) -> Void) {
        AVAudioApplication.requestRecordPermission { granted in
            DispatchQueue.main.async { completion(granted) }
        }
    }

    static var hasMicrophonePermission: Bool {
        AVAudioApplication.shared.recordPermission == .granted
    }
}
