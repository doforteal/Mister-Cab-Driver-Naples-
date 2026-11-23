# App clienti di Taxi Mister Cab Driver Napoli

App per i clienti ispirata a Marriott Bonvoy, centrata sui servizi: tour privati e condivisi, transfer e "I miei viaggi" con tour pass.

È una **web app installabile (PWA)**: si apre dal link e il cliente la aggiunge alla schermata Home di iPhone o Android. Si apre a tutto schermo come un'app vera e non serve l'App Store.

## Cosa fa

| Sezione | Funzioni |
|---|---|
| **Home** | Saluto, scheda del prossimo viaggio, azioni rapide (tour privato, condiviso, transfer, WhatsApp), tour in evidenza, "come funziona" |
| **Explore → Private** | Gli 11 tour del listino 2027 (Opt 1 … Opt 8 Bis) con tappe, prezzi per veicolo ed esclusioni. Il modulo calcola il prezzo in base alle persone e invia su WhatsApp (o email) il Confirmation Form già compilato. Se il pick-up è fuori Napoli il prezzo resta "da confermare". In inverno appare un avviso sulla Costiera chiusa. |
| **Explore → Shared** | Gruppi aperti **in tempo reale** da taximrcabpooling.com (stessa base dati Supabase, solo lettura), con i posti liberi. "Join group" apre il sito pooling con tour e data già compilati. |
| **Explore → Transfers** | Richiesta di preventivo transfer via WhatsApp |
| **Trips** | Stato (Richiesta inviata → Anticipo pagato → Giorno del tour; dopo la data passa in "Past"), pulsante per l'anticipo di 50 € (link SumUp), tour pass con QR, promemoria biglietti Pompei, "Aggiungi al calendario", chat WhatsApp con Ciro |
| **Account** | Dati del cliente, contatti, Termini e condizioni, istruzioni di installazione |

## Da configurare (`config.js`)
- `depositLink`: **inserisci il link SumUp** dell'anticipo. Finché è vuoto, il pulsante chiede il link a Ciro su WhatsApp.
- I prezzi dei tour sono in `data.js`

## Pubblicazione
Sono file statici, senza build. Su Netlify: *Add new site → Import from GitHub*, scegli questo repository, cartella di pubblicazione `.`. Poi collega un sottodominio, ad esempio `app.taximistercabdriver.com`.

Per provarla in locale: `python3 -m http.server` e apri http://localhost:8000.

## Limiti attuali (prototipo) e prossimi passi
1. **I dati del cliente e i viaggi sono salvati sul suo telefono** (localStorage). Se cambia telefono o cancella i dati del browser, li perde.
   → Prossimo passo: prenotazioni su **Supabase** (lo stesso progetto del pooling), con un pannello admin per Ciro.
2. Lo stato "anticipo pagato" lo segna il cliente. Con il backend, lo confermerebbe Ciro dall'admin o un webhook di SumUp.
3. Interfaccia solo in inglese (i clienti sono crocieristi). Si può aggiungere l'italiano.
4. Le foto sono le due immagini del sito pooling: vanno sostituite con foto vere per ogni tour (cartella `img/`).
