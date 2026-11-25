# App clienti di Taxi Mister Cab Driver Napoli

App per i clienti ispirata a Marriott Bonvoy, centrata sui servizi: tour privati e condivisi, transfer e "I miei viaggi" con tour pass.

È una **web app installabile (PWA)**: si apre dal link e il cliente la aggiunge alla schermata Home di iPhone o Android. Si apre a tutto schermo come un'app vera e non serve l'App Store.

## Cosa fa

| Sezione | Funzioni |
|---|---|
| **Home** | Saluto, scheda del prossimo viaggio, azioni rapide (tour privato, condiviso, transfer, altri porti), tour in evidenza, "come funziona" |
| **Explore → Private** | Gli 11 tour del listino 2027 (Opt 1 … Opt 8 Bis) con tappe, prezzi per veicolo ed esclusioni. L'orario di inizio proposto per i **tour privati** è **7:30** (`defaultStart` in `config.js`), con la spiegazione: consigliato, modificabile solo se la nave arriva più tardi, orario definitivo fissato qualche giorno prima del tour (la spiegazione compare anche nella pagina del tour, nella prenotazione, nella conferma, nel calendario e nei Termini). I **transfer** non hanno un orario proposto: lo sceglie il cliente. Il modulo calcola il prezzo in base alle persone e invia su WhatsApp (o email) il Confirmation Form già compilato. Se il pick-up è fuori Napoli il prezzo resta "da confermare". In inverno appare un avviso sulla Costiera chiusa. |
| **Explore → Shared** | Gruppi aperti **in tempo reale** da taximrcabpooling.com (stessa base dati Supabase, solo lettura), con i posti liberi. "Join group" apre il sito pooling con tour e data già compilati. |
| **Explore → Transfers** | Richiesta di preventivo transfer via WhatsApp |
| **Trips** | Ogni richiesta ha un codice (es. `MC-6KNJQ`) e resta **Pending** finché Ciro non la conferma. Da confermata: tour pass con QR **che mostra tutti i dettagli della prenotazione come testo** (codice, stato, tour, data, ora, persone, ritiro con hotel/indirizzo, nave/volo/treno, cliente e telefono, prezzo e saldo, contatti dell'autista: chi lo scansiona con la fotocamera li legge subito), saldo da pagare, promemoria biglietti Pompei, **evento nel calendario completo** (Google Calendar oppure file .ics: codice, orario, ritiro con hotel/indirizzo, nave/volo/treno, tappe, prezzo e saldo, contatti di Ciro, due promemoria). Sempre: chat WhatsApp con Ciro |
| **TOURISFIED** | Collegamento alla landing page tourisfied.com (driver di fiducia in Italia e in tutti i porti del Mediterraneo): in Home, nelle azioni rapide, nei viaggi confermati e completati, in Account e nel messaggio di conferma |
| **Account** | Dati del cliente, contatti, Termini e condizioni, istruzioni di installazione |

## Come arrivano le richieste
Ogni richiesta (tour privato, transfer, tour condiviso) può arrivare **su WhatsApp** (+39 329 755 6193) **oppure via email** a **mrcabdrivernapoli@gmail.com**: il cliente sceglie il pulsante. In tutti e due i casi c'è il **codice prenotazione** e il riferimento all'app:
- oggetto email: `[Mister Cab App] Booking request MC-TAJ5N – Opt 4 · Ravello, Amalfi & Positano – Wed, 2 Jun 2027` (oppure `Transfer request` / `Shared tour`)
- ultima riga del testo: `— Sent from the Taxi Mister Cab Driver app`

In Gmail puoi creare un filtro sull'oggetto `[Mister Cab App]` per dare a queste richieste un'etichetta.

L'email parte dall'app di posta del cliente: il cliente deve premere "Invia".

## Come si conferma una prenotazione
1. Il cliente invia la richiesta dall'app (WhatsApp o email). Il messaggio contiene **tutti i dettagli**: codice prenotazione, nome, telefono, email, tour, data, ora, numero di persone, punto di ritiro con **hotel o indirizzo** (obbligatorio se il ritiro non è al porto), **nave, volo o treno** (nome o numero), note e prezzo. Nell'app la prenotazione risulta **Pending**.
2. Ciro gestisce tutto **fuori dall'app**: disponibilità, pagamento dei 50 € (link SumUp), accordi col cliente.
3. A cose fatte apre **`admin.html`** (scheda **Richiesta**) e incolla la richiesta (o tocca *Incolla dagli appunti*): i dati si compilano da soli, la richiesta va **in agenda come "Da confermare"** e compare un riepilogo. Se manca qualcosa lo segnala e lo si completa in *Correggi o completa i dati*. Per le richieste telefoniche c'è *Inserisci a mano*.
4. Preme **✅ Prenotazione completata – Conferma** (chiede un'ultima conferma) e poi *Invia su WhatsApp* (si apre la chat con il cliente) oppure *Invia per email*.
5. Il cliente apre il link: la prenotazione diventa **Confirmed** e compare il tour pass. Funziona anche su un altro telefono.

### Agenda (scheda **Agenda**)
- **Lista** per data e **Calendario** mensile (pallino blu = nuova richiesta, arancione = da confermare, verde = confermata). Filtri: Tutte / **Nuove richieste** / Da confermare / Confermate / Annullate; di base si vedono le date future, con la spunta anche quelle passate. Una richiesta incollata nel pannello nasce come **Nuova richiesta**; con *Presa in carico* diventa **Da confermare**, poi **Confermata**. Il numero sulla scheda Agenda indica quante nuove richieste non sono ancora state prese in carico. (Internamente resta una prenotazione "da confermare" con un segno "nuova": una versione precedente del pannello la mostrerebbe semplicemente come "Da confermare".)
- Toccando una prenotazione si apre e si può **modificare tutto** (data, persone, ritiro, nave/volo, note, prezzo…), poi *Salva le modifiche*. Da lì si può anche **Annullare**, **Riattivare** o **Eliminare**.
- Per una prenotazione già confermata il pulsante diventa **Aggiorna e reinvia la conferma**: crea un link nuovo (utile se il cliente lo perde, o se i dati sono cambiati). Annullare o modificare **non avvisa il cliente**: lo si scrive a mano.
- **Importare un foglio esistente**: in *Strumenti* c'è *Importa da foglio (CSV)*. Legge le colonne `Data, Cliente, Pax, Servizio, Tipo, Stato, Totale €, Anticipo €, Nave / Pick-up, Telefono, Email, Link SumUp, Calendario, Note` (separatore virgola, punto e virgola o tabulazione; date `gg/mm/aaaa` o `aaaa-mm-gg`). Stati: *Confermato* = confermata, *Cancellato* = annullata, *Da confermare* e *Da verificare (?)* = da confermare. *Tipo*: Transfer = transfer, Tour e Transfer + Tour = tour privato. **Annulla l'ultima importazione** (in *Strumenti*) toglie le prenotazioni dell'ultimo file importato che non sono state modificate o confermate nel frattempo. Prima di importare mostra un riepilogo (righe, stati, date, cosa resta da completare). Il codice prenotazione è generato dal contenuto della riga, quindi **importare lo stesso file due volte non crea doppioni** e non tocca le prenotazioni già presenti o modificate. L'orario si legge solo quando è chiaro ("ritrovo/incontro/pick-up HH:MM", un orario in fondo alla colonna *Nave / Pick-up* come "Hotel X, Sorrento – 8:00", per i transfer "Partenza HH:MM" o il primo orario del testo); mai gli orari di attracco, arrivo, treno o volo, né gli intervalli ("8:30-15:00"). Le date possono avere il giorno della settimana ("gio 12/11/2026"). I telefoni sono portati al formato internazionale solo quando il paese è chiaro (+39 per i cellulari italiani, +1 per i numeri americani con i trattini, +44 per 07xxx), altrimenti restano come scritti. Anticipo e link SumUp finiscono nelle note.
- **Se l'agenda risulta vuota**: ogni browser ha la sua memoria. L'agenda è visibile solo nello stesso browser (e stesso indirizzo) in cui è stata creata o importata: un altro browser, un altro dispositivo, il browser interno di WhatsApp/Gmail, la navigazione privata o la pulizia dei dati del browser mostrano un'agenda vuota. Il pannello lo segnala con un avviso e scrive in Agenda quante prenotazioni ci sono *in questo browser*. Per non perderla: usare sempre lo stesso browser (Chrome) e salvare la pagina nella schermata Home; per spostarla usare *Scarica una copia dell'agenda* / *Carica una copia*.
- L'agenda è salvata **sul telefono (o computer) dove si usa il pannello**, non in rete. Sotto *Strumenti* c'è una copia di sicurezza facoltativa (scarica/carica un file). Per un'agenda condivisa tra più dispositivi serve un archivio online (prossimo passo possibile).

### Link breve (circa 40 caratteri) — da attivare una volta
Il link normale (sotto) non scende sotto circa 130 caratteri perché 86 sono la firma digitale. Per avere un link davvero corto (`https://taximrcab.pages.dev/c/xxxxxxxxxx`) serve un piccolo archivio online gratuito, **Cloudflare KV**. Il codice c'è già (`functions/` e `_routes.json`); finché l'archivio non è collegato il pannello usa da solo il link normale e sotto il messaggio scrive "Link normale". Per attivarlo:
1. Cloudflare → *Storage & databases* → *KV* → *Create* → nome `mistercab-links`.
2. *Workers & Pages* → progetto `taximrcab` → *Settings* → *Bindings* → *Add* → *KV namespace* → nome variabile **`LINKS`**, archivio `mistercab-links` → salvare (almeno per *Production*).
3. *Deployments* → *Retry deployment* sull'ultima pubblicazione (oppure basta una nuova modifica).
4. In `admin.html` confermare una prenotazione: sotto il messaggio deve comparire **"Link breve attivo."**

Come funziona: il pannello firma la prenotazione con la chiave di Ciro e la invia a `POST /api/links`; il server controlla la firma con la sola chiave **pubblica** (nessun segreto sul server), salva la prenotazione con un codice casuale di 10 caratteri e restituisce il link. Il cliente apre `/c/<codice>` e l'app legge la prenotazione da `GET /api/links/<codice>`. Solo Ciro può creare o modificare un link; confermare di nuovo la stessa prenotazione aggiorna **lo stesso link**. Se la chiave di conferma cambia, va aggiornata anche in `functions/_shared.js`.

Il link di conferma è **corto** (circa 140 caratteri, `.../#/c/...`): contiene solo i dati essenziali in forma compatta (codice, data, ora, persone, prezzo, tour). Nome, ritiro, nave/volo e titolo viaggiano nel link **solo se sono diversi** da quanto aveva scritto il cliente (o se la prenotazione è stata inserita a mano), così le correzioni di Ciro arrivano comunque al cliente. I vecchi link lunghi (`.../#/confirm/...`) funzionano ancora. Una parte fissa di circa 86 caratteri è la firma digitale e non si può accorciare senza un archivio online.

Il cliente **non può confermarsi da solo**: il link è firmato con una chiave che si sblocca solo con il codice di accesso di Ciro. Se il link viene modificato anche di un carattere, l'app lo rifiuta.

## Da configurare (`config.js`)
- `confirmPublicKey`: la chiave pubblica che corrisponde al caveau `admin-vault.js` (già impostata)
- `depositLink` (facoltativo): un link SumUp fisso mostrato nelle prenotazioni in attesa. Se resta vuoto, Ciro manda il link a mano.
- I prezzi dei tour sono in `data.js`

## Pubblicazione
L'app è online su **https://taximrcab.pages.dev** (Cloudflare Pages, gratuito). Sono file statici, senza build. Ogni modifica salvata sul branch `ccr-e2b2a702-juxdkc` aggiorna il sito da sola in circa un minuto.

- Pagina admin: https://taximrcab.pages.dev/admin.html — si apre con **un solo codice di accesso** (formato `XXXX-XXXX-XXXX`), valido da qualsiasi telefono o computer. Nel repository non c'è il codice: c'è solo la chiave di firma **cifrata** (`admin-vault.js`), che si apre nel browser con quel codice. Il codice è nel PDF consegnato a Ciro.
- Se il codice si perde o va cambiato, si rigenera il caveau cifrato e la chiave pubblica in `config.js` (le conferme già inviate smettono di valere).
- Un dominio proprio (per esempio un sottodominio di `taximrcabpooling.com`) si può collegare dalle impostazioni del progetto su Cloudflare (*Custom domains*).

Per provarla in locale: `python3 -m http.server` e apri http://localhost:8000.

## Limiti attuali (prototipo) e prossimi passi
1. **I dati del cliente e i viaggi sono salvati sul suo telefono** (localStorage). Se cambia telefono o cancella i dati del browser, li perde.
   La conferma però si recupera sempre riaprendo il link di Ciro.
   → Prossimo passo: prenotazioni su **Supabase** (lo stesso progetto del pooling), con un elenco delle richieste per Ciro.
2. Interfaccia solo in inglese (i clienti sono crocieristi). Si può aggiungere l'italiano.
3. Le foto sono le due immagini del sito pooling: vanno sostituite con foto vere per ogni tour (cartella `img/`).

## Tornare a una versione precedente
- Ultima versione stabile prima del filtro "Nuove richieste" e dell'annullamento dell'importazione: commit **`bbc10a1`**.
- **Da Cloudflare** (un clic): *Workers & Pages* → il progetto → *Deployments* → scegliere la pubblicazione precedente → *Rollback to this deployment*.
- **Dal codice**: si annulla l'ultima modifica con `git revert` e si pubblica (il sito si aggiorna in circa un minuto). I dati dell'agenda sul telefono non vanno persi.
