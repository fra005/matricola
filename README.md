# PACE — Personal Academic Control Engine

Web app che aiuta le matricole ad abituarsi allo studio universitario: un planner di studio verso gli appelli, un tutor AI e una guida al primo anno.

## Funzioni

- **Piano**: sessioni di studio di oggi da spuntare, grafico dei prossimi 7 giorni e "libretto" con le ore studiate per ogni esame. Il piano si ricalcola da solo se resti indietro e avvisa se le ore disponibili non bastano.
- **Settimana**: vista calendario (FullCalendar) con impegni, sessioni di studio a orario e appelli. Le sessioni si trascinano per cambiare orario nella stessa giornata; il nuovo orario vale anche per Google Calendar.
- **Esami**: ore settimanali, giorni di studio e, per ogni esame, CFU, data dell'appello, difficoltà e ore stimate (all'inizio 15 ore di studio per CFU).
- **Tutor AI**: spiegazioni a tre livelli (semplice, normale, da esame) e quiz interattivi da 5 domande.
- **Coach settimanale**: legge i progressi e dà consigli concreti per la settimana.
- **Guida**: checklist della matricola, glossario universitario con ricerca e consigli sul metodo di studio.
- **Pagine d'esame**: una pagina per ognuno dei 18 esami di Ingegneria Informatica al PoliTo, con gli argomenti presi dalle schede ufficiali dei corsi (A.A. 2026/27), una barra di progresso per argomento, un test di partenza (quiz AI con 2 domande per argomento oppure autovalutazione) e il pronostico delle ore da dedicare a ogni argomento, da inviare al planner.
- **PoliTo**: sezione per Ingegneria Informatica al Politecnico di Torino, con gli esami del primo anno da caricare nel planner, una guida all'ateneo, schede di studio e quiz per materia che funzionano anche senza AI. CFU e date sono indicativi: il riferimento ufficiale è il piano carriera sul Portale della Didattica.

## Come usarla

È un unico file HTML, senza installazione: apri `index.html` nel browser, oppure pubblicalo con GitHub Pages (Settings → Pages → Deploy from a branch → `main`, cartella `/`).

## Calendario con link iCal (qualsiasi calendario, senza configurazione)

Nel **Piano**, la scheda **Il tuo calendario** accetta il link privato iCal di Google Calendar, Apple iCloud, Outlook, Proton Calendar, Nextcloud e di qualsiasi calendario compatibile. La funzione `netlify/functions/ics.js` legge il calendario con [ical.js](https://github.com/kewisch/ical.js) (eventi ricorrenti, eccezioni, fusi orari) e restituisce all'app **solo gli intervalli occupati**, senza titoli né dettagli. Gli eventi "tutto il giorno" e quelli segnati come "libero" non bloccano il tempo. Gli impegni si aggiornano da soli quando l'app viene riaperta dopo più di 3 ore.

In alternativa si può **caricare un file .ics** (per esempio l'orario delle lezioni esportato dal Portale): il file viene letto nel browser con ical.js, non viene inviato a nessun server, e funziona anche nella versione su claude.ai. Vengono salvati solo gli orari occupati dei prossimi 200 giorni.

Con **Scarica le sessioni (.ics)** le sessioni dei prossimi 14 giorni e gli appelli si importano in qualsiasi calendario.

Il link iCal è privato come una password: resta salvato solo nel browser (o nell'account) di chi lo inserisce.

## Google Calendar

Sul sito pubblico lo studente può collegare Google Calendar:

- l'app legge **solo la disponibilità** del calendario principale (permesso `calendar.freebusy`): vede quando sei occupato, non i titoli né i dettagli degli eventi;
- il planner usa ogni giorno al massimo il tempo libero reale nella fascia oraria scelta in **Esami → Il tuo tempo** (blocchi, pause e margine attorno agli impegni);
- le sessioni dei prossimi 14 giorni e gli appelli vengono scritti in un calendario separato, **"Matricola · Studio"**, creato dall'app (permesso `calendar.app.created`: l'app non può modificare gli altri calendari).

### Attivazione (una volta, da chi gestisce il sito)

1. Su [Google Cloud Console](https://console.cloud.google.com) crea un progetto.
2. In **API e servizi → Libreria** abilita **Google Calendar API**.
3. In **Google Auth Platform** (schermata di consenso OAuth) scegli tipo **Esterno**, inserisci nome dell'app ed email di supporto, aggiungi gli ambiti `.../auth/calendar.freebusy` e `.../auth/calendar.app.created`. Finché l'app è in modalità **Test**, aggiungi tra gli **utenti di test** gli account Google che possono usarla (massimo 100).
4. In **Client** crea un **ID client OAuth** di tipo **Applicazione web**, con origine JavaScript autorizzata `https://matricola-primo-anno.netlify.app`.
5. Copia l'**ID client** (finisce con `.apps.googleusercontent.com`) in `index.html`, nella costante `GOOGLE_CLIENT_ID`. Non è un segreto: è normale che stia nel codice della pagina.

Per aprire l'app a più di 100 persone serve la verifica dell'app da parte di Google (privacy policy, dominio verificato).

Nella versione su claude.ai l'integrazione non è disponibile: lì la pagina non può collegarsi a Google.

## AI sul sito con la tua chiave API

Su claude.ai tutor e coach usano Claude. Sul sito (Netlify) passano dalla funzione `netlify/functions/ai.js`, che custodisce la chiave API sul server: la chiave non finisce mai nel browser né nel repository. Funziona con qualsiasi API compatibile con OpenAI.

Su Netlify, in **Site configuration → Environment variables**, imposta:

| Variabile | Obbligatoria | Cosa contiene |
|---|---|---|
| `AI_API_KEY` | Sì | La tua chiave API |
| `AI_MODEL` | Sì | Il nome del modello (per esempio uno economico del tuo fornitore) |
| `AI_BASE_URL` | No | Indirizzo dell'API; predefinito `https://api.openai.com/v1` |
| `ACCESS_CODE` | Consigliata | Codice che gli utenti inseriscono nella scheda Tutor AI per usare l'AI |
| `AI_MAX_TOKENS` | No | Lunghezza massima della risposta (predefinita 900). Alzala, per esempio a 4000, con i modelli che "ragionano" come Gemini |

Esempio con Google Gemini: `AI_BASE_URL` = `https://generativelanguage.googleapis.com/v1beta/openai`, chiave creata su Google AI Studio, un modello Flash come `AI_MODEL`.

Il sito deve essere collegato a questo repository (Site configuration → Build & deploy → Link repository) perché la funzione venga pubblicata. Imposta anche un limite di spesa mensile dal tuo fornitore: il sito è pubblico.

Dopo aver cambiato le variabili, rilancia la pubblicazione da **Deploys → Trigger deploy**.

## Prossimi passi

- Caricamento delle dispense, per far rispondere il tutor sul materiale del corso
- Collegamento a Moodle e timer Pomodoro

## App Android

La cartella `android/` contiene l'app Android: un'app nativa leggera (nessuna libreria esterna) che apre il sito a schermo intero. I dati restano sul telefono; AI e lettura dei calendari usano le funzioni del sito, quindi serve internet. I link esterni si aprono nel browser, i file `.ics` si caricano dal telefono e le sessioni esportate si salvano in **Download**. Il login con Google non è disponibile dentro l'app (Google lo vieta nelle WebView): si usano il link iCal o il file `.ics`.

Per compilare servono JDK 17+, Gradle 8.9+ e l'Android SDK (platform 35):

```bash
cd android
echo "sdk.dir=/percorso/android-sdk" > local.properties
gradle assembleRelease
```

La firma usa `android/keystore.properties` e la chiave in `android/keystore/`, che **non** sono nel repository: senza la stessa chiave non si può aggiornare l'app già installata (bisogna disinstallarla e reinstallarla).
