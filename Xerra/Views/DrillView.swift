import SwiftUI

/// The heart of the app: hear it, say it, see the difference, go again.
struct DrillView: View {
    let phrases: [Phrase]
    var startIndex: Int = 0

    @Environment(Library.self) private var library
    @Environment(AppSettings.self) private var settings

    @State private var speech = SpeechService()
    @State private var scoring = ScoringService()
    @State private var recorder = Recorder()
    @State private var player = Player()

    @State private var index = 0
    @State private var modelURL: URL?
    @State private var attempt: Attempt?

    @State private var modelEnvelope: [Float] = []
    @State private var attemptEnvelope: [Float] = []
    @State private var modelPitch: [Double?] = []
    @State private var attemptPitch: [Double?] = []
    @State private var timingRatio: Double?

    @State private var showTranslation = false
    @State private var showPitch = false
    @State private var isLoadingModel = false
    @State private var showHistory = false

    private var phrase: Phrase? {
        guard phrases.indices.contains(index) else { return nil }
        return phrases[index]
    }

    var body: some View {
        Group {
            if let phrase {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        prompt(for: phrase)
                        modelControls
                        recordControl

                        if attempt != nil {
                            Divider()
                            comparison
                        }
                    }
                    .padding(20)
                    .padding(.bottom, 40)
                }
            } else {
                ContentUnavailableView(
                    "Nothing to drill",
                    systemImage: "waveform",
                    description: Text("Add a phrase to this deck and it'll show up here.")
                )
            }
        }
        .navigationTitle(phrase?.deck ?? "Drill")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Text("\(index + 1)/\(phrases.count)")
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .sheet(isPresented: $showHistory) {
            if let phrase {
                NavigationStack {
                    HistoryView(phrase: phrase)
                }
            }
        }
        .task(id: phrase?.id) { await loadModel() }
        .onAppear {
            index = min(startIndex, max(0, phrases.count - 1))
            showTranslation = settings.showTranslationUpFront
        }
    }

    // MARK: - Prompt

    private func prompt(for phrase: Phrase) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(phrase.text)
                .font(.system(.title, design: .serif))
                .fontWeight(.medium)
                .fixedSize(horizontal: false, vertical: true)

            if showTranslation {
                Text(phrase.translation)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
            } else {
                Button("Show meaning") { withAnimation { showTranslation = true } }
                    .font(.subheadline)
                    .buttonStyle(.plain)
                    .foregroundStyle(.tint)
            }

            if let situation = phrase.situation {
                Label(situation, systemImage: "location.fill")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let usage = phrase.usageNote {
                Label(usage, systemImage: "bubble.left.and.text.bubble.right")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let focus = phrase.focusNote {
                HStack(alignment: .top, spacing: 7) {
                    Image(systemName: "ear")
                        .font(.caption)
                        .foregroundStyle(.tint)
                    Text(focus)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(11)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.accentColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
            }
        }
    }

    // MARK: - Model playback

    private var modelControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Button {
                    playModel(rate: 1.0)
                } label: {
                    Label("Listen", systemImage: "speaker.wave.2.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(modelURL == nil)

                Button {
                    playModel(rate: settings.slowRate)
                } label: {
                    Label("Slow", systemImage: "tortoise.fill")
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(modelURL == nil)
            }

            if isLoadingModel {
                HStack(spacing: 7) {
                    ProgressView().controlSize(.small)
                    Text("Generating audio…").font(.caption).foregroundStyle(.secondary)
                }
            } else if modelURL == nil {
                Label(
                    speech.lastError ?? "No audio yet for this phrase.",
                    systemImage: "exclamationmark.triangle"
                )
                .font(.caption)
                .foregroundStyle(.orange)
            }
        }
    }

    // MARK: - Recording

    private var recordControl: some View {
        VStack(spacing: 12) {
            Button {
                toggleRecording()
            } label: {
                ZStack {
                    Circle()
                        .fill(recorder.isRecording ? Color.red : Color.orange)
                        .frame(width: 76, height: 76)
                        .shadow(color: (recorder.isRecording ? Color.red : Color.orange).opacity(0.35), radius: 10, y: 4)

                    // The ring tracks the mic level so you can see it's hearing you.
                    Circle()
                        .stroke(Color.red.opacity(0.35), lineWidth: 3)
                        .frame(width: 76 + CGFloat(recorder.level) * 34, height: 76 + CGFloat(recorder.level) * 34)
                        .opacity(recorder.isRecording ? 1 : 0)

                    Image(systemName: recorder.isRecording ? "stop.fill" : "mic.fill")
                        .font(.title)
                        .foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .animation(.easeOut(duration: 0.08), value: recorder.level)

            Text(recorder.isRecording
                 ? String(format: "Recording… %.1fs", recorder.elapsed)
                 : "Tap, say it, tap again")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .monospacedDigit()

            if recorder.permissionDenied {
                Text("Microphone access is off. Turn it on in Settings › Xerra.")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Comparison

    @ViewBuilder
    private var comparison: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 10) {
                Button {
                    if let modelURL { player.play(url: modelURL, track: .model) }
                } label: {
                    Label("Model", systemImage: "play.fill")
                }
                .buttonStyle(.bordered)
                .disabled(modelURL == nil)

                Button {
                    if let attempt { player.play(url: attempt.url, track: .attempt) }
                } label: {
                    Label("You", systemImage: "play.fill")
                }
                .buttonStyle(.bordered)

                Button {
                    if let modelURL, let attempt {
                        player.playBackToBack(model: modelURL, attempt: attempt.url)
                    }
                } label: {
                    Label("A/B", systemImage: "arrow.left.arrow.right")
                }
                .buttonStyle(.borderedProminent)
                .disabled(modelURL == nil)
            }

            WaveformComparison(
                modelEnvelope: modelEnvelope,
                attemptEnvelope: attemptEnvelope,
                timingRatio: timingRatio
            )

            DisclosureGroup("Intonation", isExpanded: $showPitch) {
                PitchComparisonView(modelContour: modelPitch, attemptContour: attemptPitch)
                    .padding(.top, 10)
            }
            .font(.subheadline.weight(.medium))

            if scoring.isScoring {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Scoring…").font(.footnote).foregroundStyle(.secondary)
                }
            } else if let attempt, attempt.hasScore {
                ScoreView(attempt: attempt, didFallBack: scoring.didFallBack)
            } else if let error = scoring.lastError {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }

            HStack {
                Button {
                    showHistory = true
                } label: {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                .buttonStyle(.bordered)

                Spacer()

                Button {
                    advance()
                } label: {
                    Label("Next", systemImage: "arrow.right")
                }
                .buttonStyle(.borderedProminent)
                .disabled(index >= phrases.count - 1)
            }
        }
    }

    // MARK: - Actions

    private func playModel(rate: Double) {
        guard let modelURL else { return }
        player.play(url: modelURL, track: .model, rate: rate)
    }

    private func toggleRecording() {
        if recorder.isRecording {
            finishRecording()
        } else {
            player.stop()
            recorder.start()
        }
    }

    private func finishRecording() {
        guard let phrase, let finished = recorder.stop() else { return }

        var newAttempt = Attempt(
            phraseID: phrase.id,
            fileName: finished.fileName,
            duration: finished.duration
        )
        library.record(newAttempt)
        attempt = newAttempt

        Task {
            await analyseAttempt(newAttempt)

            if let result = await scoring.score(recording: newAttempt.url, phrase: phrase, settings: settings) {
                newAttempt.apply(result)
                library.update(newAttempt)
                attempt = newAttempt
            }
        }
    }

    private func advance() {
        guard index < phrases.count - 1 else { return }
        player.stop()
        index += 1
        resetComparison()
        showTranslation = settings.showTranslationUpFront
    }

    private func resetComparison() {
        attempt = nil
        attemptEnvelope = []
        attemptPitch = []
        timingRatio = nil
        showPitch = false
    }

    private func loadModel() async {
        guard let phrase else { return }
        resetComparison()
        modelURL = nil
        modelEnvelope = []
        modelPitch = []

        isLoadingModel = speech.cachedURL(for: phrase, settings: settings) == nil
        let url = await speech.modelAudio(for: phrase, settings: settings)
        isLoadingModel = false
        modelURL = url

        guard let url else { return }
        let analysis = await Task.detached(priority: .userInitiated) {
            (
                envelope: AudioAnalysis.waveform(url: url),
                pitch: AudioAnalysis.pitchContour(url: url)
            )
        }.value
        modelEnvelope = analysis.envelope
        modelPitch = analysis.pitch
    }

    private func analyseAttempt(_ attempt: Attempt) async {
        let attemptURL = attempt.url
        let modelAudioURL = modelURL

        let analysis = await Task.detached(priority: .userInitiated) {
            (
                envelope: AudioAnalysis.waveform(url: attemptURL),
                pitch: AudioAnalysis.pitchContour(url: attemptURL),
                ratio: modelAudioURL.flatMap { AudioAnalysis.timingRatio(model: $0, attempt: attemptURL) }
            )
        }.value

        attemptEnvelope = analysis.envelope
        attemptPitch = analysis.pitch
        timingRatio = analysis.ratio
    }
}
