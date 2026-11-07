# Matricola

Web app che aiuta le matricole ad abituarsi allo studio universitario: un planner di studio verso gli appelli, un tutor AI e una guida al primo anno.

## Funzioni

- **Piano**: sessioni di studio di oggi da spuntare, grafico dei prossimi 7 giorni e "libretto" con le ore studiate per ogni esame. Il piano si ricalcola da solo se resti indietro e avvisa se le ore disponibili non bastano.
- **Esami**: ore settimanali, giorni di studio e, per ogni esame, CFU, data dell'appello, difficoltà e ore stimate (all'inizio 15 ore di studio per CFU).
- **Tutor AI**: spiegazioni a tre livelli (semplice, normale, da esame) e quiz interattivi da 5 domande.
- **Coach settimanale**: legge i progressi e dà consigli concreti per la settimana.
- **Guida**: checklist della matricola, glossario universitario con ricerca e consigli sul metodo di studio.
- **PoliTo**: sezione per Ingegneria Informatica al Politecnico di Torino, con gli esami del primo anno da caricare nel planner, una guida all'ateneo, schede di studio e quiz per materia che funzionano anche senza AI. CFU e date sono indicativi: il riferimento ufficiale è il piano carriera sul Portale della Didattica.

## Come usarla

È un unico file HTML, senza installazione: apri `index.html` nel browser, oppure pubblicalo con GitHub Pages (Settings → Pages → Deploy from a branch → `main`, cartella `/`).

## Limiti attuali

| Funzione | Su claude.ai | Fuori da claude.ai (browser, GitHub Pages) |
|---|---|---|
| Planner, libretto, guida | Sì | Sì |
| Salvataggio | Nell'account Claude | Solo nel browser di chi la usa |
| Tutor AI e coach | Sì | No: serve un server con una chiave API |

Una chiave API (OpenAI o altro) **non va mai messa** in questo file o in un sito statico: chiunque potrebbe leggerla. Per avere l'AI fuori da claude.ai serve un piccolo server che custodisca la chiave.

## Prossimi passi

- Server con chiave API per il tutor AI fuori da claude.ai
- Caricamento delle dispense, per far rispondere il tutor sul materiale del corso
- Collegamento a Moodle e timer Pomodoro
