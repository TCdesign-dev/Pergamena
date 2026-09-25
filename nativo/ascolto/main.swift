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
//
//  Su stdin accetta due comandi, una riga ciascuno: «pausa» e
//  «riprendi». In pausa il microfono resta aperto ma al riconoscitore
//  e al file arriva silenzio (vedi `Pausa`).
// ─────────────────────────────────────────────────────────────────────

import AVFoundation
import CoreAudio
import CoreMedia
import Foundation
import Speech

// ── rispondere di sé stessi, per il permesso del microfono ──────────
//
//  macOS chiede il microfono a nome del processo «responsabile»: di
//  solito l'app da cui tutto è partito. Ma se il server è stato
//  lanciato con la responsabilità rinunciata (come fa l'app Claude),
//  non c'è più nessuna app a cui chiedere, e il permesso viene negato
//  in silenzio.
//
//  Allora il programma si rilancia AL PROPRIO POSTO — stesso pid,
//  stessi stdin/stdout — rinunciando a sua volta alla responsabilità
//  ereditata: diventa responsabile di sé, e macOS chiede il permesso
//  a nome suo, con la descrizione cucita nel binario. Se la funzione
//  privata non c'è, si va avanti come prima.

func diventaResponsabile() {
    let chiave = "PERGAMENA_ASCOLTO_AUTONOMO"
    if getenv(chiave) != nil { return }
    setenv(chiave, "1", 1)

    typealias Rinuncia = @convention(c) (UnsafeMutablePointer<posix_spawnattr_t?>, Int32) -> Int32
    guard let simbolo = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "responsibility_spawnattrs_setdisclaim"),
          let eseguibile = Bundle.main.executablePath else { return }
    let rinuncia = unsafeBitCast(simbolo, to: Rinuncia.self)

    var attributi: posix_spawnattr_t?
    posix_spawnattr_init(&attributi)
    defer { posix_spawnattr_destroy(&attributi) }
    guard rinuncia(&attributi, 1) == 0 else { return }
    posix_spawnattr_setflags(&attributi, Int16(POSIX_SPAWN_SETEXEC))

    var argv: [UnsafeMutablePointer<CChar>?] = CommandLine.arguments.map { strdup($0) } + [nil]
    var pid: pid_t = 0
    // con SETEXEC, se riesce questa chiamata non ritorna
    _ = posix_spawn(&pid, eseguibile, nil, &attributi, &argv, environ)
}

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
    var dispositivo: String?     // uid; se manca, quello di sistema
    var lingua = "it-IT"         // la lingua in cui si ascolta
    var elenca = false           // --dispositivi: stampa gli ingressi ed esce
}

func leggiOpzioni() -> Opzioni {
    var o = Opzioni()
    var args = CommandLine.arguments.dropFirst().makeIterator()
    while let a = args.next() {
        switch a {
        case "--file": if let v = args.next() { o.file = URL(fileURLWithPath: v) }
        case "--salva": if let v = args.next() { o.salva = URL(fileURLWithPath: v) }
        case "--tempo-reale": o.tempoReale = true
        case "--dispositivo": o.dispositivo = args.next()
        case "--lingua": if let v = args.next(), !v.isEmpty { o.lingua = v }
        case "--dispositivi": o.elenca = true
        case "--contesto":
            if let v = args.next() {
                o.contesto = v.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            }
        default: muori("argomento sconosciuto: \(a)")
        }
    }
    return o
}

// ── dispositivi d'ingresso ──────────────────────────────────────────
//
//  Il microfono «di sistema» non è sempre un microfono. Qui era
//  BlackHole, un dispositivo virtuale che restituisce solo l'audio che
//  altre app gli mandano: senza nessuno che gli mandi niente, silenzio
//  perfetto, e il timer che corre come se tutto andasse bene.

struct Ingresso {
    let id: AudioDeviceID
    let uid: String
    let nome: String
    let virtuale: Bool
}

func indirizzo(_ s: AudioObjectPropertySelector, _ ambito: AudioObjectPropertyScope = kAudioObjectPropertyScopeGlobal) -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress(mSelector: s, mScope: ambito, mElement: kAudioObjectPropertyElementMain)
}

func stringa(_ id: AudioObjectID, _ s: AudioObjectPropertySelector) -> String {
    var ind = indirizzo(s)
    var valore: Unmanaged<CFString>?
    var dim = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    guard AudioObjectGetPropertyData(id, &ind, 0, nil, &dim, &valore) == noErr,
          let v = valore?.takeRetainedValue() else { return "" }
    return v as String
}

func canaliIngresso(_ id: AudioDeviceID) -> Int {
    var ind = indirizzo(kAudioDevicePropertyStreamConfiguration, kAudioObjectPropertyScopeInput)
    var dim: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(id, &ind, 0, nil, &dim) == noErr, dim > 0 else { return 0 }
    let memoria = UnsafeMutableRawPointer.allocate(byteCount: Int(dim), alignment: MemoryLayout<AudioBufferList>.alignment)
    defer { memoria.deallocate() }
    guard AudioObjectGetPropertyData(id, &ind, 0, nil, &dim, memoria) == noErr else { return 0 }
    let lista = UnsafeMutableAudioBufferListPointer(memoria.assumingMemoryBound(to: AudioBufferList.self))
    return lista.reduce(0) { $0 + Int($1.mNumberChannels) }
}

func ingressi() -> [Ingresso] {
    var ind = indirizzo(kAudioHardwarePropertyDevices)
    var dim: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &ind, 0, nil, &dim) == noErr else { return [] }
    var id = [AudioDeviceID](repeating: 0, count: Int(dim) / MemoryLayout<AudioDeviceID>.size)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &ind, 0, nil, &dim, &id) == noErr else { return [] }

    return id.compactMap { d in
        guard canaliIngresso(d) > 0 else { return nil }
        var ti = indirizzo(kAudioDevicePropertyTransportType)
        var trasporto: UInt32 = 0
        var dt = UInt32(MemoryLayout<UInt32>.size)
        AudioObjectGetPropertyData(d, &ti, 0, nil, &dt, &trasporto)
        return Ingresso(
            id: d,
            uid: stringa(d, kAudioDevicePropertyDeviceUID),
            nome: stringa(d, kAudioObjectPropertyName),
            virtuale: trasporto == kAudioDeviceTransportTypeVirtual || trasporto == kAudioDeviceTransportTypeAggregate
        )
    }
}

func ingressoDiSistema() -> AudioDeviceID {
    var ind = indirizzo(kAudioHardwarePropertyDefaultInputDevice)
    var id: AudioDeviceID = 0
    var dim = UInt32(MemoryLayout<AudioDeviceID>.size)
    AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &ind, 0, nil, &dim, &id)
    return id
}

/// I sorgenti dei segnali devono vivere quanto il processo. In una
/// variabile locale Swift può liberarli dopo l'ultimo uso: a quel
/// punto SIGINT, impostato su «ignora», veniva buttato e lo stop non
/// fermava più niente.
var segnaliVivi: [DispatchSourceSignal] = []

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

/*  La pausa.
 *
 *  Si potrebbe smettere di dare audio al riconoscitore, ma allora il
 *  suo orologio si fermerebbe: dopo una pausa di dieci minuti ogni
 *  frase uscirebbe con dieci minuti in meno, e non combacerebbe più con
 *  le àncore degli appunti (che contano il tempo vero) né col minuto
 *  da riascoltare nel file audio. Allora in pausa si manda SILENZIO:
 *  il tempo scorre, non si trascrive niente, e nel file restano dieci
 *  minuti muti invece della chiacchiera dell'intervallo. */
final class Pausa: @unchecked Sendable {
    private let blocco = NSLock()
    private var attiva = false
    /// true se lo stato è cambiato davvero
    func imposta(_ v: Bool) -> Bool {
        blocco.lock(); defer { blocco.unlock() }
        let cambia = attiva != v
        attiva = v
        return cambia
    }
    var valore: Bool { blocco.lock(); defer { blocco.unlock() }; return attiva }
}

/// Un buffer uguale a quello dato, ma muto.
func silenzio(come b: AVAudioPCMBuffer) -> AVAudioPCMBuffer {
    guard let muto = AVAudioPCMBuffer(pcmFormat: b.format, frameCapacity: b.frameLength) else { return b }
    muto.frameLength = b.frameLength
    for canale in UnsafeMutableAudioBufferListPointer(muto.mutableAudioBufferList) {
        if let dati = canale.mData { memset(dati, 0, Int(canale.mDataByteSize)) }
    }
    return muto
}

/// Scrive l'audio in AAC 32 kbps mono. Usato dal microfono e — per
/// poterlo collaudare senza un microfono — anche dalla sorgente file.
final class Registratore: @unchecked Sendable {
    private let file: AVAudioFile
    private let conv: AVAudioConverter
    private let blocco = NSLock()

    init?(dove: URL, da formato: AVAudioFormat) {
        do {
            try FileManager.default.createDirectory(at: dove.deletingLastPathComponent(), withIntermediateDirectories: true)
            let f = try AVAudioFile(
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
            guard let c = AVAudioConverter(from: formato, to: f.processingFormat) else { return nil }
            file = f
            conv = c
        } catch {
            emetti(["evento": "errore", "messaggio": "non riesco a salvare l'audio: \(error.localizedDescription)"])
            return nil
        }
    }

    func scrivi(_ b: AVAudioPCMBuffer) {
        blocco.lock(); defer { blocco.unlock() }
        if let c = converti(b, con: conv) { try? file.write(from: c) }
    }
}

// ── il lavoro vero ──────────────────────────────────────────────────

@main
struct Ascolto {
    static func main() async {
        diventaResponsabile()
        let opzioni = leggiOpzioni()
        let locale = Locale(identifier: opzioni.lingua)

        if opzioni.elenca {
            let sistema = ingressoDiSistema()
            emetti(["evento": "dispositivi", "elenco": ingressi().map {
                ["uid": $0.uid, "nome": $0.nome, "virtuale": $0.virtuale, "sistema": $0.id == sistema]
            }])
            exit(0)
        }

        guard SpeechTranscriber.isAvailable else { muori("SpeechTranscriber non disponibile su questo Mac") }
        guard let supportato = await SpeechTranscriber.supportedLocale(equivalentTo: locale) else {
            muori("il riconoscitore non conosce \(opzioni.lingua)")
        }

        let trascrittore = SpeechTranscriber(
            locale: supportato,
            transcriptionOptions: [],
            reportingOptions: [.volatileResults],
            attributeOptions: [.audioTimeRange]
        )

        // il modello della lingua: di solito c'è già, altrimenti si scarica
        if await AssetInventory.status(forModules: [trascrittore]) != .installed {
            emetti(["evento": "stato", "messaggio": "scarico il modello di \(opzioni.lingua)…"])
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

        let pausa = Pausa()

        signal(SIGINT, SIG_IGN)
        signal(SIGTERM, SIG_IGN)
        segnaliVivi = [SIGINT, SIGTERM].map { s -> DispatchSourceSignal in
            let sorgente = DispatchSource.makeSignalSource(signal: s, queue: .main)
            sorgente.setEventHandler { ferma() }
            sorgente.resume()
            return sorgente
        }

        // i comandi arrivano su stdin; se chi ci ha lanciati muore,
        // stdin si chiude: ci si ferma
        Thread.detachNewThread {
            while let riga = readLine() {
                switch riga.trimmingCharacters(in: .whitespaces) {
                case "pausa": if pausa.imposta(true) { emetti(["evento": "pausa"]) }
                case "riprendi": if pausa.imposta(false) { emetti(["evento": "ripresa"]) }
                default: break
                }
            }
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

                var registratore = opzioni.salva.flatMap { Registratore(dove: $0, da: audio.processingFormat) }
                chiudiSorgente = { registratore = nil }   // chiude il file AAC
                let passo: AVAudioFrameCount = 4096
                Task.detached {
                    while audio.framePosition < audio.length {
                        guard let b = AVAudioPCMBuffer(pcmFormat: audio.processingFormat, frameCapacity: passo) else { break }
                        do { try audio.read(into: b, frameCount: passo) } catch { break }
                        if b.frameLength == 0 { break }
                        let dato = pausa.valore ? silenzio(come: b) : b
                        if !pausa.valore, let db = livello(b) { emetti(["evento": "livello", "db": (db * 10).rounded() / 10]) }
                        if let c = converti(dato, con: conv) { rubinetto.yield(AnalyzerInput(buffer: c)) }
                        registratore?.scrivi(dato)
                        try? await Task.sleep(nanoseconds: UInt64(Double(b.frameLength) / audio.processingFormat.sampleRate * 1_000_000_000))
                    }
                    DispatchQueue.main.async { ferma() }
                }
            } catch {
                muori("file non leggibile: \(error.localizedDescription)")
            }
        } else {
            // ── microfono ──
            switch AVCaptureDevice.authorizationStatus(for: .audio) {
            case .authorized: break
            case .notDetermined:
                if !(await AVCaptureDevice.requestAccess(for: .audio)) {
                    muori("microfono non autorizzato: Impostazioni di Sistema › Privacy e sicurezza › Microfono › attiva «pergamena-ascolto»")
                }
            default:
                muori("microfono non autorizzato: Impostazioni di Sistema › Privacy e sicurezza › Microfono › attiva «pergamena-ascolto»")
            }

            let motore = AVAudioEngine()
            let ingresso = motore.inputNode

            // il dispositivo scelto nell'app, altrimenti quello di sistema;
            // va impostato PRIMA di chiedere il formato, che dipende da lui
            let tutti = ingressi()
            var scelto = tutti.first { $0.id == ingressoDiSistema() }
            if let uid = opzioni.dispositivo {
                if let d = tutti.first(where: { $0.uid == uid }), var id = Optional(d.id), let au = ingresso.audioUnit {
                    let esito = AudioUnitSetProperty(au, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global,
                                                     0, &id, UInt32(MemoryLayout<AudioDeviceID>.size))
                    if esito == noErr { scelto = d }
                } else {
                    emetti(["evento": "stato", "messaggio": "il microfono scelto non c'è più: uso quello di sistema"])
                }
            }

            let naturale = ingresso.outputFormat(forBus: 0)
            guard naturale.sampleRate > 0 else { muori("nessun microfono disponibile") }
            guard let conv = AVAudioConverter(from: naturale, to: formatoAnalisi) else {
                muori("conversione dal microfono impossibile")
            }

            // l'audio si tiene solo se richiesto: sono circa 17 MB l'ora
            var registratore = opzioni.salva.flatMap { Registratore(dove: $0, da: naturale) }

            /*  Guardia del silenzio: se per 6 secondi non arriva niente
             *  sopra il rumore di fondo, lo si dice. Un timer che corre
             *  su un microfono muto è il modo peggiore di rompersi:
             *  scopri a fine lezione di non aver registrato niente. */
            var ultimoLivello = Date.distantPast
            var ultimoSuono = Date()
            var avvisato = false
            let nomeIngresso = scelto?.nome ?? "microfono"

            ingresso.installTap(onBus: 0, bufferSize: 4096, format: naturale) { buffer, _ in
                // in pausa passa silenzio, e il silenzio non va segnalato
                if pausa.valore {
                    let muto = silenzio(come: buffer)
                    if let c = converti(muto, con: conv) { rubinetto.yield(AnalyzerInput(buffer: c)) }
                    registratore?.scrivi(muto)
                    ultimoSuono = Date()
                    if avvisato { avvisato = false; emetti(["evento": "suono"]) }
                    return
                }
                if let c = converti(buffer, con: conv) { rubinetto.yield(AnalyzerInput(buffer: c)) }
                registratore?.scrivi(buffer)
                guard Date().timeIntervalSince(ultimoLivello) > 0.2, let db = livello(buffer) else { return }
                ultimoLivello = Date()
                emetti(["evento": "livello", "db": (db * 10).rounded() / 10])

                if db > -55 {
                    ultimoSuono = Date()
                    if avvisato { avvisato = false; emetti(["evento": "suono"]) }
                } else if !avvisato, Date().timeIntervalSince(ultimoSuono) > 6 {
                    avvisato = true
                    emetti(["evento": "silenzio", "dispositivo": nomeIngresso, "virtuale": scelto?.virtuale ?? false])
                }
            }

            do { try motore.start() } catch { muori("il microfono non parte: \(error.localizedDescription)") }
            chiudiSorgente = {
                ingresso.removeTap(onBus: 0)
                motore.stop()
                registratore = nil   // chiude il file AAC
            }
            emetti(["evento": "pronto", "sorgente": "microfono",
                    "dispositivo": nomeIngresso, "virtuale": scelto?.virtuale ?? false,
                    "salva": opzioni.salva?.path ?? NSNull()])
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
