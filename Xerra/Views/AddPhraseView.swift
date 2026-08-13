import SwiftUI

/// Add or edit a phrase.
///
/// Supports the "capture it in the moment" case: write only the English, save,
/// and it lands in a needs-attention list until you fill in the Catalan.
struct AddPhraseView: View {
    var editing: Phrase?

    @Environment(Library.self) private var library
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss

    @State private var text = ""
    @State private var translation = ""
    @State private var deck = ""
    @State private var focusNote = ""
    @State private var didLoad = false

    @FocusState private var focusedField: Field?
    private enum Field { case text, translation, deck, note }

    var body: some View {
        Form {
            Section {
                TextField(settings.language.displayName, text: $text, axis: .vertical)
                    .font(.system(.body, design: .serif))
                    .focused($focusedField, equals: .text)
                    .textInputAutocapitalization(.sentences)
                    .autocorrectionDisabled()
            } header: {
                Text(settings.language.englishName)
            } footer: {
                Text("Leave this empty to jot the English down now and fill in the \(settings.language.englishName) later.")
            }

            Section("English") {
                TextField("What it means", text: $translation, axis: .vertical)
                    .focused($focusedField, equals: .translation)
            }

            Section("Deck") {
                TextField("Deck name", text: $deck)
                    .focused($focusedField, equals: .deck)
                if !existingDecks.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 7) {
                            ForEach(existingDecks, id: \.self) { name in
                                Button(name) { deck = name }
                                    .font(.caption)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(
                                        deck == name ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.12),
                                        in: Capsule()
                                    )
                                    .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            Section {
                TextField("What to listen for", text: $focusNote, axis: .vertical)
                    .focused($focusedField, equals: .note)
            } header: {
                Text("Pronunciation note")
            } footer: {
                Text("Optional. Shown while you drill — e.g. which vowels reduce to a schwa.")
            }

            if editing != nil {
                Section {
                    Button("Delete phrase", role: .destructive) {
                        if let editing { library.delete(editing) }
                        dismiss()
                    }
                }
            }
        }
        .navigationTitle(editing == nil ? "New phrase" : "Edit phrase")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(!canSave)
            }
        }
        .onAppear {
            guard !didLoad else { return }
            didLoad = true
            if let editing {
                text = editing.text
                translation = editing.translation
                deck = editing.deck
                focusNote = editing.focusNote ?? ""
            } else {
                deck = library.decks.first ?? "My phrases"
                focusedField = .text
            }
        }
    }

    private var existingDecks: [String] { library.decks }

    /// Either half is enough to save — the Catalan alone, or an English note to
    /// come back to.
    private var canSave: Bool {
        !text.trimmed.isEmpty || !translation.trimmed.isEmpty
    }

    private func save() {
        var phrase = editing ?? Phrase(text: "", translation: "", deck: "", language: settings.language)
        phrase.text = text.trimmed
        phrase.translation = translation.trimmed
        phrase.deck = deck.trimmed.isEmpty ? "My phrases" : deck.trimmed
        phrase.focusNote = focusNote.trimmed.isEmpty ? nil : focusNote.trimmed
        phrase.language = editing?.language ?? settings.language
        phrase.isCapture = phrase.text.isEmpty

        if editing == nil {
            library.add(phrase)
        } else {
            library.update(phrase)
        }
        dismiss()
    }
}
