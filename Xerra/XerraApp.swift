import SwiftUI

@main
struct XerraApp: App {
    @State private var library = Library()
    @State private var settings = AppSettings()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(library)
                .environment(settings)
                .tint(.accentColor)
        }
    }
}
