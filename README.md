# App clienti di Taxi Mister Cab Driver Napoli

App per i clienti ispirata a Marriott Bonvoy, centrata sui servizi: tour privati e condivisi, transfer e "I miei viaggi" con tour pass.

È una **web app installabile (PWA)**: si apre dal link e il cliente la aggiunge alla schermata Home di iPhone o Android. Si apre a tutto schermo come un'app vera e non serve l'App Store.

## Cosa fa

| Sezione | Funzioni |
|---|---|
| **Home** | Saluto, scheda del prossimo viaggio, azioni rapide (tour privato, condiviso, transfer, altri porti), tour in evidenza, "come funziona" |
| **Explore → Private** | Gli 11 tour del listino 2027 (Opt 1 … Opt 8 Bis) con tappe, prezzi per veicolo ed esclusioni. Il modulo calcola il prezzo in base alle persone e invia su WhatsApp (o email) il Confirmation Form già compilato. Se il pick-up è fuori Napoli il prezzo resta "da confermare". In inverno appare un avviso sulla Costiera chiusa. |
| **Explore → Shared** | Gruppi aperti **in tempo reale** da taximrcabpooling.com (stessa base dati Supabase, solo lettura), con i posti liberi. "Join group" apre il sito pooling con tour e data già compilati. |
| **Explore → Transfers** | Richiesta di preventivo transfer via WhatsApp |
| **Trips** | Ogni richiesta ha un codice (es. `MC-6KNJQ`) e resta **Pending** finché Ciro non la conferma. Da confermata: tour pass con QR, saldo da pagare, promemoria biglietti Pompei, "Aggiungi al calendario". Sempre: chat WhatsApp con Ciro |
| **TOURISFIED** | Collegamento alla landing page tourisfied.com (driver di fiducia in Italia e in tutti i porti del Mediterraneo): in Home, nelle azioni rapide, nei viaggi confermati e completati, in Account e nel messaggio di conferma |
| **Account** | Dati del cliente, contatti, Termini e condizioni, istruzioni di installazione |

## Come arrivano le richieste
Ogni richiesta (tour privato, transfer, tour condiviso) può arrivare **su WhatsApp** (+39 329 755 6193) **oppure via email** a **mrcabdrivernapoli@gmail.com**: il cliente sceglie il pulsante. In tutti e due i casi c'è il **codice prenotazione** e il riferimento all'app:
- oggetto email: `[Mister Cab App] Booking request MC-TAJ5N – Opt 4 · Ravello, Amalfi & Positano – Wed, 2 Jun 2027` (oppure `Transfer request` / `Shared tour`)
- ultima riga del testo: `— Sent from the Taxi Mister Cab Driver app`

In Gmail puoi creare un filtro sull'oggetto `[Mister Cab App]` per dare a queste richieste un'etichetta.

L'email parte dall'app di posta del cliente: il cliente deve premere "Invia".

## Come si conferma una prenotazione
1. Il cliente invia la richiesta dall'app (WhatsApp o email) con il **codice prenotazione**. Nell'app risulta **Pending**.
2. Ciro manda a mano il link di pagamento dei 50 € (SumUp).
3. Dopo il pagamento Ciro apre **`admin.html`** sul suo telefono, incolla il messaggio WhatsApp o l'email del cliente, preme *Compila dal messaggio*, controlla i dati e preme *Crea il link di conferma*. Poi lo invia su WhatsApp (o lo copia).
4. Il cliente apre il link: la prenotazione diventa **Confirmed** e compare il tour pass. Funziona anche su un altro telefono o se il cliente non aveva l'app: la prenotazione viene aggiunta.

Il cliente **non può confermarsi da solo**: il link è firmato con una chiave segreta che esiste solo sul telefono di Ciro. Se il link viene modificato anche di un carattere, l'app lo rifiuta.

### Attivazione (una volta sola)
1. Apri `https://<indirizzo-app>/admin.html` sul telefono di Ciro e premi **Crea la chiave**.
2. Premi **Copia chiave pubblica** (non è segreta) e incollala in `config.js` alla voce `confirmPublicKey`, poi ripubblica il sito.
3. Premi **Scarica backup della chiave segreta** e conservalo in un posto sicuro. Non mandarlo a nessuno: serve solo per usare la chiave su un altro telefono (*Ho già una chiave*).

`admin.html` non è collegata dall'app e non è indicizzata dai motori di ricerca. Senza la chiave segreta non può creare link validi.

## Da configurare (`config.js`)
- `confirmPublicKey`: la chiave pubblica creata in `admin.html` (vedi sopra)
- `depositLink` (facoltativo): un link SumUp fisso mostrato nelle prenotazioni in attesa. Se resta vuoto, Ciro manda il link a mano.
- I prezzi dei tour sono in `data.js`

## Pubblicazione
Sono file statici, senza build. Su Netlify: *Add new site → Import from GitHub*, scegli questo repository, cartella di pubblicazione `.`. Poi collega un sottodominio, ad esempio `app.taximistercabdriver.com`.

Per provarla in locale: `python3 -m http.server` e apri http://localhost:8000.

## Limiti attuali (prototipo) e prossimi passi
1. **I dati del cliente e i viaggi sono salvati sul suo telefono** (localStorage). Se cambia telefono o cancella i dati del browser, li perde.
   La conferma però si recupera sempre riaprendo il link di Ciro.
   → Prossimo passo: prenotazioni su **Supabase** (lo stesso progetto del pooling), con un elenco delle richieste per Ciro.
2. Interfaccia solo in inglese (i clienti sono crocieristi). Si può aggiungere l'italiano.
3. Le foto sono le due immagini del sito pooling: vanno sostituite con foto vere per ogni tour (cartella `img/`).
