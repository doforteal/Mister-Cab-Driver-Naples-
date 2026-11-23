# Mister Cab Club — l'app di Taxi Mister Cab Driver Napoli

App per i clienti ispirata a Marriott Bonvoy: tour privati e condivisi, transfer, "I miei viaggi" con tour pass, e un programma fedeltà a punti e livelli.

È una **web app installabile (PWA)**: si apre dal link e il cliente la aggiunge alla schermata Home di iPhone o Android. Si apre a tutto schermo come un'app vera e non serve l'App Store.

## Cosa fa

| Sezione | Funzioni |
|---|---|
| **Home** | Saluto, tessera socio (livello, punti, avanzamento), prossimo viaggio, azioni rapide, tour in evidenza, "Moments" |
| **Explore → Private** | Gli 11 tour del listino 2027 (Opt 1 … Opt 8 Bis) con tappe, prezzi per veicolo ed esclusioni. Il modulo calcola il prezzo in base alle persone e invia su WhatsApp (o email) il Confirmation Form già compilato. Se il pick-up è fuori Napoli il prezzo resta "da confermare". In inverno appare un avviso sulla Costiera chiusa. |
| **Explore → Shared** | Gruppi aperti **in tempo reale** da taximrcabpooling.com (stessa base dati Supabase, solo lettura), con i posti liberi. "Join group" apre il sito pooling con tour, data e codice amico già compilati. |
| **Explore → Transfers** | Richiesta di preventivo transfer via WhatsApp |
| **Trips** | Stato (Richiesta inviata → Anticipo pagato → Completato), pulsante per l'anticipo di 50 € (link SumUp), tour pass con QR, promemoria biglietti Pompei, "Aggiungi al calendario", chat WhatsApp con Ciro |
| **Rewards** | Livelli Member / Silver / Gold / Platinum, vantaggi, premi "Moments" riscattabili con i punti (voucher con codice), codice amico, storico punti |
| **Account** | Tessera socio con QR, profilo, contatti, Termini e condizioni, istruzioni di installazione, strumenti autista |

### Come guadagna punti il cliente
- 50 punti di benvenuto all'iscrizione
- A fine tour **l'autista** preme "Driver: complete tour" sul telefono del cliente e inserisce il **PIN staff**. I punti vengono accreditati: 1 punto per ogni € speso, più il bonus del livello.
- Bonus amico, recensione e cortesia: da *Account → Driver tools*, con il PIN

## Da configurare (`config.js`)
- `depositLink`: **inserisci il link SumUp** dell'anticipo. Finché è vuoto, il pulsante chiede il link a Ciro su WhatsApp.
- `staffPin`: **cambia il PIN** (ora è `2027`)
- Livelli, vantaggi, premi e punti: sono una **proposta**, modificali come vuoi
- I prezzi dei tour sono in `data.js`

## Pubblicazione
Sono file statici, senza build. Su Netlify: *Add new site → Import from GitHub*, scegli questo repository, cartella di pubblicazione `.`. Poi collega un sottodominio, ad esempio `app.taximistercabdriver.com`.

Per provarla in locale: `python3 -m http.server` e apri http://localhost:8000.

## Limiti attuali (prototipo) e prossimi passi
1. **I dati del socio (punti, viaggi, voucher) sono salvati sul telefono del cliente** (localStorage). Se cambia telefono o cancella i dati del browser, li perde. Il PIN staff è nel codice, quindi non è una vera protezione.
   → Prossimo passo: soci, viaggi e punti su **Supabase** (lo stesso progetto del pooling), con login via email e un pannello admin per Ciro.
2. Lo stato "anticipo pagato" lo segna il cliente. Con il backend, lo confermerebbe Ciro dall'admin o un webhook di SumUp.
3. Interfaccia solo in inglese (i clienti sono crocieristi). Si può aggiungere l'italiano.
4. Le foto sono le due immagini del sito pooling: vanno sostituite con foto vere per ogni tour (cartella `img/`).
