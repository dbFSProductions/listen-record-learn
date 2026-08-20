import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            NavigationStack {
                DeckListView()
            }
            .tabItem { Label("Practice", systemImage: "waveform") }

            NavigationStack {
                PhraseListView()
            }
            .tabItem { Label("Phrases", systemImage: "text.book.closed") }

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

/// Deck chooser — the entry point into a drill session.
struct DeckListView: View {
    @Environment(Library.self) private var library
    @Environment(AppSettings.self) private var settings

    var body: some View {
        List {
            Section {
                ForEach(decks, id: \.self) { deck in
                    NavigationLink {
                        DrillView(phrases: drillable(in: deck))
                    } label: {
                        deckRow(deck)
                    }
                }
            } header: {
                Text("Decks")
            } footer: {
                Text("Everything is in \(settings.language.displayName). Change that in Settings.")
            }

            if !allDrillable.isEmpty {
                Section {
                    NavigationLink {
                        DrillView(phrases: allDrillable.shuffled())
                    } label: {
                        Label("Shuffle everything", systemImage: "shuffle")
                    }
                }
            }
        }
        .navigationTitle("Practice")
        .overlay {
            if decks.isEmpty {
                ContentUnavailableView(
                    "No phrases yet",
                    systemImage: "text.book.closed",
                    description: Text("Add some on the Phrases tab and they'll appear here as decks.")
                )
            }
        }
    }

    private var allDrillable: [Phrase] {
        library.phrases.filter { $0.language == settings.language && $0.isReadyToDrill }
    }

    private var decks: [String] {
        var seen = Set<String>()
        return allDrillable.compactMap { seen.insert($0.deck).inserted ? $0.deck : nil }.sorted()
    }

    private func drillable(in deck: String) -> [Phrase] {
        allDrillable.filter { $0.deck == deck }
    }

    private func deckRow(_ deck: String) -> some View {
        let phrases = drillable(in: deck)
        let scored = phrases.compactMap { library.bestScore(for: $0.id) }
        let average = scored.isEmpty ? nil : scored.reduce(0, +) / Double(scored.count)

        return HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(deck).font(.body.weight(.medium))
                Text("\(phrases.count) phrase\(phrases.count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let average {
                Text("\(Int(average.rounded()))")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(average >= 80 ? .green : average >= 60 ? .yellow : .orange)
            }
        }
    }
}
