import Foundation
import CryptoKit

/// Where audio lives on disk.
///
/// Model audio is cached by a hash of (text + voice + language), so a phrase is
/// only ever synthesised once no matter how many times you drill it, and
/// changing the voice doesn't collide with the old cache.
enum AudioStore {
    static let documents: URL = {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }()

    static let modelAudioDirectory: URL = ensure(documents.appendingPathComponent("ModelAudio", isDirectory: true))
    static let recordingsDirectory: URL = ensure(documents.appendingPathComponent("Recordings", isDirectory: true))

    private static func ensure(_ url: URL) -> URL {
        if !FileManager.default.fileExists(atPath: url.path) {
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        }
        return url
    }

    static func modelAudioURL(text: String, voice: String, language: Language, fileExtension: String = "mp3") -> URL {
        let key = "\(language.rawValue)|\(voice)|\(text)"
        return modelAudioDirectory
            .appendingPathComponent(hash(key))
            .appendingPathExtension(fileExtension)
    }

    static func newRecordingFileName() -> String {
        "\(UUID().uuidString).m4a"
    }

    static func hash(_ string: String) -> String {
        let digest = SHA256.hash(data: Data(string.utf8))
        return digest.map { String(format: "%02x", $0) }.joined().prefix(32).description
    }

    /// Total bytes used by cached model audio and your recordings.
    static func diskUsage() -> Int64 {
        [modelAudioDirectory, recordingsDirectory].reduce(0) { total, directory in
            let contents = (try? FileManager.default.contentsOfDirectory(
                at: directory,
                includingPropertiesForKeys: [.fileSizeKey]
            )) ?? []
            return total + contents.reduce(Int64(0)) { sum, url in
                let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
                return sum + Int64(size)
            }
        }
    }

    static func clearModelAudioCache() {
        let contents = (try? FileManager.default.contentsOfDirectory(at: modelAudioDirectory, includingPropertiesForKeys: nil)) ?? []
        for url in contents { try? FileManager.default.removeItem(at: url) }
    }
}
