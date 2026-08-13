import SwiftUI

struct PhraseListView: View {
    @Environment(Library.self) private var library
    @Environment(AppSettings.self) private var settings

    @State private var search = ""
    @State private var showAdd = false
    @State private var editing: Phrase?

    var body: some View {
        List {
            if !captures.isEmpty {
                Section {
                    ForEach(captures) { phrase in
                        Button { editing = phrase } label: { captureRow(phrase) }
                            .buttonStyle(.plain)
                    }
                    .onDelete { delete($0, from: captures) }
                } header: {
                    Text("Jotted down — needs the \(settings.language.englishName)")
                }
            }

            ForEach(decks, id: \.self) { deck in
                Section(deck) {
                    ForEach(phrases(in: deck)) { phrase in
                        Button { editing = phrase } label: { row(phrase) }
                            .buttonStyle(.plain)
                    }
                    .onDelete { delete($0, from: phrases(in: deck)) }
                }
            }
        }
        .searchable(text: $search, prompt: "Search phrases")
        .navigationTitle("Phrases")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) {
            NavigationStack { AddPhraseView() }
        }
        .sheet(item: $editing) { phrase in
            NavigationStack { AddPhraseView(editing: phrase) }
        }
        .overlay {
            if matching.isEmpty {
                ContentUnavailableView(
                    search.isEmpty ? "No phrases yet" : "Nothing matches",
                    systemImage: search.isEmpty ? "plus.bubble" : "magnifyingglass",
                    description: Text(search.isEmpty
                        ? "Tap + to add something you actually want to be able to say."
                        : "Try a different search.")
                )
            }
        }
    }

    // MARK: - Data

    private var matching: [Phrase] {
        library.phrases
            .filter { $0.language == settings.language }
            .filter {
                search.isEmpty
                || $0.text.localizedCaseInsensitiveContains(search)
                || $0.translation.localizedCaseInsensitiveContains(search)
                || $0.deck.localizedCaseInsensitiveContains(search)
            }
    }

    private var captures: [Phrase] { matching.filter { !$0.isReadyToDrill } }

    private var decks: [String] {
        var seen = Set<String>()
        return matching
            .filter(\.isReadyToDrill)
            .compactMap { seen.insert($0.deck).inserted ? $0.deck : nil }
            .sorted()
    }

    private func phrases(in deck: String) -> [Phrase] {
        matching.filter { $0.isReadyToDrill && $0.deck == deck }
            .sorted { $0.createdAt < $1.createdAt }
    }

    private func delete(_ offsets: IndexSet, from list: [Phrase]) {
        for index in offsets where list.indices.contains(index) {
            library.delete(list[index])
        }
    }

    // MARK: - Rows

    private func row(_ phrase: Phrase) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(phrase.text).font(.body)
                Text(phrase.translation).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if let best = library.bestScore(for: phrase.id) {
                Text("\(Int(best.rounded()))")
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(best >= 80 ? .green : best >= 60 ? .yellow : .orange)
            }
        }
        .contentShape(Rectangle())
    }

    private func captureRow(_ phrase: Phrase) -> some View {
        HStack {
            Image(systemName: "square.and.pencil").foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 2) {
                Text(phrase.translation.isEmpty ? "Untitled note" : phrase.translation)
                    .font(.body)
                Text("Tap to add the \(phrase.language.englishName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .contentShape(Rectangle())
    }
}
