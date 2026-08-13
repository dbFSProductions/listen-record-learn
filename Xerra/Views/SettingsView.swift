import SwiftUI

struct SettingsView: View {
    @Environment(Library.self) private var library
    @Environment(AppSettings.self) private var settings

    @State private var speech = SpeechService()
    @State private var keyField = ""
    @State private var isValidating = false
    @State private var validationMessage: String?
    @State private var validationSucceeded = false
    @State private var prefetchProgress: (done: Int, total: Int)?
    @State private var showClearCacheAlert = false
    @State private var diskUsage: Int64 = 0

    var body: some View {
        @Bindable var settings = settings

        Form {
            Section {
                Picker("Language", selection: Binding(
                    get: { settings.language },
                    set: { settings.languageDidChange(to: $0) }
                )) {
                    ForEach(Language.allCases) { language in
                        Text("\(language.flag)  \(language.displayName)").tag(language)
                    }
                }
            } footer: {
                Text("Phrases are stored per language, so switching keeps both sets intact.")
            }

            Section {
                SecureField("Azure Speech key", text: $keyField)
                    .textContentType(.password)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                TextField("Region", text: $settings.azureRegion)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                if settings.hasAzure || !keyField.isEmpty {
                    Picker("Voice", selection: $settings.azureVoice) {
                        ForEach(settings.language.azureVoices) { voice in
                            Text("\(voice.name) · \(voice.gender)").tag(voice.id)
                        }
                    }
                }

                Button {
                    saveAndValidate()
                } label: {
                    HStack {
                        Text(keyField.isEmpty ? "Remove key" : "Save and test")
                        if isValidating {
                            Spacer()
                            ProgressView().controlSize(.small)
                        }
                    }
                }
                .disabled(isValidating)

                if let validationMessage {
                    Label(validationMessage, systemImage: validationSucceeded ? "checkmark.circle" : "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(validationSucceeded ? .green : .orange)
                }
            } header: {
                Text("Azure voice and scoring")
            } footer: {
                Text("""
                Optional. Without a key the app uses the iOS built-in voice and Apple's on-device recogniser — \
                everything works, the voice is just less natural and scoring is word-level rather than per-sound.

                With a key you get Azure's Catalan neural voices and per-phoneme pronunciation scoring. \
                The key is stored in the iOS Keychain. The region must match your Speech resource, e.g. westeurope.
                """)
            }

            Section("Playback") {
                VStack(alignment: .leading) {
                    HStack {
                        Text("Slow speed")
                        Spacer()
                        Text("\(Int(settings.slowRate * 100))%")
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Slider(value: $settings.slowRate, in: 0.4...0.9, step: 0.05)
                }
                Toggle("Show meaning up front", isOn: $settings.showTranslationUpFront)
            }

            Section {
                Button {
                    prefetchAll()
                } label: {
                    HStack {
                        Label("Download all audio", systemImage: "arrow.down.circle")
                        if let prefetchProgress {
                            Spacer()
                            Text("\(prefetchProgress.done)/\(prefetchProgress.total)")
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                    }
                }
                .disabled(prefetchProgress != nil)

                Button("Clear audio cache", role: .destructive) { showClearCacheAlert = true }

                LabeledContent("On disk", value: ByteCountFormatter.string(fromByteCount: diskUsage, countStyle: .file))
            } header: {
                Text("Audio")
            } footer: {
                Text("Generating audio ahead of time means drills work with no signal. Your recordings are never deleted by clearing the cache.")
            }

            Section {
                LabeledContent("Phrases", value: "\(library.phrases.count)")
                LabeledContent("Recordings", value: "\(library.attempts.count)")
            } header: {
                Text("Library")
            } footer: {
                Text("Xerra · v0.1 — pronunciation drilling for \(settings.language.displayName).")
            }
        }
        .navigationTitle("Settings")
        .onAppear {
            keyField = settings.azureKey
            diskUsage = AudioStore.diskUsage()
        }
        .alert("Clear cached audio?", isPresented: $showClearCacheAlert) {
            Button("Clear", role: .destructive) {
                AudioStore.clearModelAudioCache()
                diskUsage = AudioStore.diskUsage()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Model audio will be regenerated the next time you drill each phrase. Your own recordings are kept.")
        }
    }

    // MARK: - Actions

    private func saveAndValidate() {
        settings.azureKey = keyField
        validationMessage = nil

        guard settings.hasAzure else {
            validationSucceeded = false
            validationMessage = keyField.isEmpty
                ? "Key removed — using the iOS built-in voice."
                : "Enter a region as well, e.g. westeurope."
            return
        }

        isValidating = true
        Task {
            let provider = AzureTTSProvider(
                key: settings.azureKey,
                region: settings.azureRegion.trimmed,
                voice: settings.azureVoice
            )
            let result = await provider.validate(language: settings.language)
            isValidating = false
            switch result {
            case .success:
                validationSucceeded = true
                validationMessage = "Azure is working. New audio will use \(settings.azureVoice)."
            case .failure(let error):
                validationSucceeded = false
                validationMessage = error.localizedDescription
            }
        }
    }

    private func prefetchAll() {
        let phrases = library.phrases.filter { $0.language == settings.language && $0.isReadyToDrill }
        guard !phrases.isEmpty else { return }
        prefetchProgress = (0, phrases.count)

        Task {
            await speech.prefetch(phrases, settings: settings) { done, total in
                prefetchProgress = (done, total)
            }
            prefetchProgress = nil
            diskUsage = AudioStore.diskUsage()
        }
    }
}
