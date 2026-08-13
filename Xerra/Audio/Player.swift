import AVFoundation
import Observation

/// Plays a file, optionally slowed down without pitch-shifting it into a
/// cartoon — `AVAudioPlayer.rate` time-stretches, which is exactly what you
/// want for hearing where the syllables land.
@Observable
final class Player: NSObject, AVAudioPlayerDelegate {
    private(set) var isPlaying = false
    /// Which of the two clips is sounding, so the UI can highlight it.
    private(set) var nowPlaying: Track?

    enum Track: String { case model, attempt }

    private var player: AVAudioPlayer?
    private var onFinish: (() -> Void)?

    func play(url: URL, track: Track, rate: Double = 1.0, onFinish: (() -> Void)? = nil) {
        stop()
        AudioSessionManager.configureForPlaybackAndRecording()
        guard FileManager.default.fileExists(atPath: url.path) else { return }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.delegate = self
            player.enableRate = true
            player.rate = Float(rate)
            player.prepareToPlay()
            player.play()

            self.player = player
            self.onFinish = onFinish
            isPlaying = true
            nowPlaying = track
        } catch {
            isPlaying = false
            nowPlaying = nil
        }
    }

    func stop() {
        player?.stop()
        player = nil
        isPlaying = false
        nowPlaying = nil
        onFinish = nil
    }

    /// Plays the model then your attempt back to back — the single most useful
    /// thing for hearing the gap.
    func playBackToBack(model: URL, attempt: URL, gap: TimeInterval = 0.35, rate: Double = 1.0) {
        play(url: model, track: .model, rate: rate) { [weak self] in
            DispatchQueue.main.asyncAfter(deadline: .now() + gap) {
                self?.play(url: attempt, track: .attempt, rate: rate)
            }
        }
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        isPlaying = false
        nowPlaying = nil
        let callback = onFinish
        onFinish = nil
        callback?()
    }
}
