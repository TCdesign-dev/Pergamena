// ─────────────────────────────────────────────────────────────────────
//  pergamena-ascolto
//
//  Ascolta (il microfono o un file) e trascrive in italiano con
//  SpeechTranscriber di macOS 26, sul Mac, senza mandare l'audio da
//  nessuna parte. Scrive su stdout una riga JSON per evento.
//
//    pergamena-ascolto                         microfono
//    pergamena-ascolto --file lezione.m4a      un file, alla massima velocità
//    pergamena-ascolto --file x --tempo-reale  un file, come se fosse dal vivo
//    pergamena-ascolto --salva lezione.m4a     tiene anche l'audio (AAC 32 kbps)
//    pergamena-ascolto --contesto "Juvarra,Superga"
//
//  Si ferma con SIGINT/SIGTERM, oppure quando stdin si chiude: se il
//  processo che l'ha lanciato muore, non deve restare un microfono
//  acceso in giro per il sistema.
// ─────────────────────────────────────────────────────────────────────

import AVFoundation
import CoreMedia
import Foundation
import Speech

// ── uscita: una riga JSON per evento ────────────────────────────────

let bloccoUscita = NSLock()

func emetti(_ campi: [String: Any]) {
    guard let dati = try? JSONSerialization.data(withJSONObject: campi, options: [.withoutEscapingSlashes]),
          let riga = String(data: dati, encoding: .utf8) else { return }
    bloccoUscita.lock()
    print(riga)
    fflush(stdout)
    bloccoUscita.unlock()
}

func muori(_ messaggio: String) -> Never {
    emetti(["evento": "errore", "messaggio": messaggio])
    exit(1)
}

// ── argomenti ───────────────────────────────────────────────────────

struct Opzioni {
    var file: URL?
    var salva: URL?
    var tempoReale = false
    var contesto: [String] = []
}

func leggiOpzioni() -> Opzioni {
    var o = Opzioni()
    var args = CommandLine.arguments.dropFirst().makeIterator()
    while let a = args.next() {
        switch a {
        case "--file": if let v = args.next() { o.file = URL(fileURLWithPath: v) }
        case "--salva": if let v = args.next() { o.salva = URL(fileURLWithPath: v) }
        case "--tempo-reale": o.tempoReale = true
        case "--contesto":
            if let v = args.next() {
                o.contesto = v.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            }
        default: muori("argomento sconosciuto: \(a)")
        }
    }
    return o
}

// ── conversione di formato ──────────────────────────────────────────

/// Converte un buffer nel formato richiesto. Il microfono lavora a
/// 48 kHz stereo, il riconoscitore vuole il suo: in mezzo serve questo.
func converti(_ buffer: AVAudioPCMBuffer, con conv: AVAudioConverter) -> AVAudioPCMBuffer? {
    let rapporto = conv.outputFormat.sampleRate / conv.inputFormat.sampleRate
    let capienza = AVAudioFrameCount((Double(buffer.frameLength) * rapporto).rounded(.up)) + 16
    guard let uscita = AVAudioPCMBuffer(pcmFormat: conv.outputFormat, frameCapacity: capienza) else { return nil }

    var consegnato = false
    var errore: NSError?
    conv.convert(to: uscita, error: &errore) { _, stato in
        if consegnato {
            stato.pointee = .noDataNow
            return nil
        }
        consegnato = true
        stato.pointee = .haveData
        return buffer
    }
    return errore == nil && uscita.frameLength > 0 ? uscita : nil
}

/// Livello in decibel, per la lucina che dice «ti sto sentendo».
func livello(_ buffer: AVAudioPCMBuffer) -> Double? {
    guard let canali = buffer.floatChannelData, buffer.frameLength > 0 else { return nil }
    let n = Int(buffer.frameLength)
    var somma: Float = 0
    for i in 0..<n { somma += canali[0][i] * canali[0][i] }
    let rms = sqrt(somma / Float(n))
    return rms > 0 ? Double(20 * log10(rms)) : -160
}

/// Quando è arrivato l'ultimo risultato definitivo, in secondi di audio.
final class UltimoFinale: @unchecked Sendable {
    private let blocco = NSLock()
    private var fine: Double = 0
    func segna(_ s: Double) { blocco.lock(); fine = max(fine, s); blocco.unlock() }
    var valore: Double { blocco.lock(); defer { blocco.unlock() }; return fine }
}

// ── il lavoro vero ──────────────────────────────────────────────────

@main
struct Ascolto {
    static func main() async {
        let opzioni = leggiOpzioni()
        let locale = Locale(identifier: "it-IT")

        guard SpeechTranscriber.isAvailable else { muori("SpeechTranscriber non disponibile su questo Mac") }
        guard let supportato = await SpeechTranscriber.supportedLocale(equivalentTo: locale) else {
            muori("l'italiano non è supportato dal riconoscitore")
        }

        let trascrittore = SpeechTranscriber(
            locale: supportato,
            transcriptionOptions: [],
            reportingOptions: [.volatileResults],
            attributeOptions: [.audioTimeRange]
        )

        // il modello italiano: di solito c'è già, altrimenti si scarica
        if await AssetInventory.status(forModules: [trascrittore]) != .installed {
            emetti(["evento": "stato", "messaggio": "scarico il modello italiano…"])
            do {
                try await AssetInventory.assetInstallationRequest(supporting: [trascrittore])?.downloadAndInstall()
            } catch {
                muori("download del modello fallito: \(error.localizedDescription)")
            }
        }

        let analizzatore = SpeechAnalyzer(modules: [trascrittore])

        // vocabolario: nomi della materia e degli appunti, perché
        // «Juvarra» esca «Juvarra» e non «giù Varra»
        if !opzioni.contesto.isEmpty {
            let contesto = AnalysisContext()
            contesto.contextualStrings[.general] = opzioni.contesto
            try? await analizzatore.setContext(contesto)
        }

        // ── i risultati, man mano che arrivano ──
        //
        //  I finali portano anche i tempi parola per parola: un
        //  segmento può durare undici secondi e coprire due blocchi
        //  diversi degli appunti, e per allinearlo bene serve sapere
        //  QUANDO è stata detta ciascuna parola, non solo la frase.
        let arrotonda = { (s: Double) -> Double in (s * 100).rounded() / 100 }
        let ultimoFinale = UltimoFinale()

        let lettore = Task {
            do {
                for try await r in trascrittore.results {
                    let testo = String(r.text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
                    if testo.isEmpty { continue }
                    var evento: [String: Any] = [
                        "evento": "testo",
                        "finale": r.isFinal,
                        "testo": testo,
                        "inizio": arrotonda(r.range.start.seconds),
                        "fine": arrotonda(r.range.end.seconds),
                    ]
                    if r.isFinal {
                        var parole: [[Any]] = []
                        for run in r.text.runs {
                            guard let tr = run.audioTimeRange else { continue }
                            let pezzo = String(r.text[run.range].characters).trimmingCharacters(in: .whitespaces)
                            if pezzo.isEmpty { continue }
                            parole.append([pezzo, arrotonda(tr.start.seconds), arrotonda(tr.end.seconds)])
                        }
                        evento["parole"] = parole
                        ultimoFinale.segna(r.range.end.seconds)
                    }
                    emetti(evento)
                }
            } catch {
                emetti(["evento": "errore", "messaggio": "lettura risultati: \(error.localizedDescription)"])
            }
        }

        let inizio = Date()

        // ── file alla massima velocità: la strada semplice ──
        if let file = opzioni.file, !opzioni.tempoReale {
            do {
                let audio = try AVAudioFile(forReading: file)
                emetti(["evento": "pronto", "sorgente": "file", "durata": Double(audio.length) / audio.fileFormat.sampleRate])
                try await analizzatore.start(inputAudioFile: audio, finishAfterFile: true)
            } catch {
                muori("file non leggibile: \(error.localizedDescription)")
            }
            _ = await lettore.result
            emetti(["evento": "fine", "durata": Date().timeIntervalSince(inizio)])
            exit(0)
        }

        // ── flusso: microfono, oppure file al ritmo del parlato ──
        let (flusso, rubinetto) = AsyncStream<AnalyzerInput>.makeStream()

        guard let formatoAnalisi = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [trascrittore]) else {
            muori("nessun formato audio compatibile col riconoscitore")
        }

        do {
            try await analizzatore.prepareToAnalyze(in: formatoAnalisi)
            try await analizzatore.start(inputSequence: flusso)
        } catch {
            muori("avvio del riconoscitore fallito: \(error.localizedDescription)")
        }

        // fermarsi per bene: si chiude il rubinetto, si finalizza,
        // si aspetta che escano gli ultimi risultati, poi si esce
        let fermo = NSLock()
        var fermato = false
        var chiudiSorgente: () -> Void = {}

        func ferma() {
            fermo.lock()
            if fermato { fermo.unlock(); return }
            fermato = true
            fermo.unlock()

            chiudiSorgente()
            rubinetto.finish()
            Task {
                try? await analizzatore.finalizeAndFinishThroughEndOfInput()
                _ = await lettore.result
                emetti(["evento": "fine", "durata": Date().timeIntervalSince(inizio)])
                exit(0)
            }
        }

        signal(SIGINT, SIG_IGN)
        signal(SIGTERM, SIG_IGN)
        let segnali = [SIGINT, SIGTERM].map { s -> DispatchSourceSignal in
            let sorgente = DispatchSource.makeSignalSource(signal: s, queue: .main)
            sorgente.setEventHandler { ferma() }
            sorgente.resume()
            return sorgente
        }
        _ = segnali

        // se chi ci ha lanciati muore, stdin si chiude: ci si ferma
        Thread.detachNewThread {
            while readLine() != nil {}
            DispatchQueue.main.async { ferma() }
        }

        if let file = opzioni.file {
            // ── file al ritmo del parlato: collaudo del percorso dal vivo ──
            do {
                let audio = try AVAudioFile(forReading: file)
                guard let conv = AVAudioConverter(from: audio.processingFormat, to: formatoAnalisi) else {
                    muori("conversione dal file impossibile")
                }
                emetti(["evento": "pronto", "sorgente": "file-dal-vivo",
                        "durata": Double(audio.length) / audio.fileFormat.sampleRate])

                let passo: AVAudioFrameCount = 4096
                Task.detached {
                    while audio.framePosition < audio.length {
                        guard let b = AVAudioPCMBuffer(pcmFormat: audio.processingFormat, frameCapacity: passo) else { break }
                        do { try audio.read(into: b, frameCount: passo) } catch { break }
                        if b.frameLength == 0 { break }
                        if let db = livello(b) { emetti(["evento": "livello", "db": (db * 10).rounded() / 10]) }
                        if let c = converti(b, con: conv) { rubinetto.yield(AnalyzerInput(buffer: c)) }
                        try? await Task.sleep(nanoseconds: UInt64(Double(b.frameLength) / audio.processingFormat.sampleRate * 1_000_000_000))
                    }
                    DispatchQueue.main.async { ferma() }
                }
            } catch {
                muori("file non leggibile: \(error.localizedDescription)")
            }
        } else {
            // ── microfono ──
            let motore = AVAudioEngine()
            let ingresso = motore.inputNode
            let naturale = ingresso.outputFormat(forBus: 0)
            guard naturale.sampleRate > 0 else { muori("nessun microfono disponibile") }
            guard let conv = AVAudioConverter(from: naturale, to: formatoAnalisi) else {
                muori("conversione dal microfono impossibile")
            }

            // l'audio si tiene solo se richiesto: il disco è pieno al 97%
            var registratore: (file: AVAudioFile, conv: AVAudioConverter)?
            if let dove = opzioni.salva {
                do {
                    try FileManager.default.createDirectory(at: dove.deletingLastPathComponent(), withIntermediateDirectories: true)
                    let file = try AVAudioFile(
                        forWriting: dove,
                        settings: [
                            AVFormatIDKey: kAudioFormatMPEG4AAC,
                            AVSampleRateKey: 16_000,
                            AVNumberOfChannelsKey: 1,
                            AVEncoderBitRateKey: 32_000,
                        ],
                        commonFormat: .pcmFormatFloat32,
                        interleaved: false
                    )
                    if let c = AVAudioConverter(from: naturale, to: file.processingFormat) {
                        registratore = (file, c)
                    }
                } catch {
                    emetti(["evento": "errore", "messaggio": "non riesco a salvare l'audio: \(error.localizedDescription)"])
                }
            }

            var ultimoLivello = Date.distantPast
            ingresso.installTap(onBus: 0, bufferSize: 4096, format: naturale) { buffer, _ in
                if let c = converti(buffer, con: conv) { rubinetto.yield(AnalyzerInput(buffer: c)) }
                if let r = registratore, let c = converti(buffer, con: r.conv) { try? r.file.write(from: c) }
                if Date().timeIntervalSince(ultimoLivello) > 0.2, let db = livello(buffer) {
                    ultimoLivello = Date()
                    emetti(["evento": "livello", "db": (db * 10).rounded() / 10])
                }
            }

            do { try motore.start() } catch { muori("il microfono non parte: \(error.localizedDescription)") }
            chiudiSorgente = {
                ingresso.removeTap(onBus: 0)
                motore.stop()
                registratore = nil   // chiude il file AAC
            }
            emetti(["evento": "pronto", "sorgente": "microfono", "salva": opzioni.salva?.path ?? NSNull()])
        }

        /*  Finalizzazione di sicurezza. Il riconoscitore chiude una
         *  frase quando sente una pausa; un professore che parla un
         *  minuto di fila senza respirare terrebbe tutto in sospeso, e
         *  se in quel momento il processo morisse quel minuto sarebbe
         *  perso. Oltre i 45 secondi di testo provvisorio si chiude
         *  d'ufficio fino a due secondi fa, per non tagliare l'ultima
         *  parola a metà. */
        let SOSPESO_MASSIMO = 45.0
        while true {
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            guard let volatile = await analizzatore.volatileRange else { continue }
            let fine = volatile.end.seconds
            if fine.isFinite, fine - ultimoFinale.valore > SOSPESO_MASSIMO {
                let fino = CMTime(seconds: max(ultimoFinale.valore, fine - 2), preferredTimescale: 600)
                try? await analizzatore.finalize(through: fino)
                emetti(["evento": "stato", "messaggio": "frase lunga chiusa d'ufficio a \(Int(fino.seconds)) s"])
            }
        }
    }
}
