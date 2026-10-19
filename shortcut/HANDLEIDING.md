# VOLGAS Gezondheid: iOS-Opdracht (eenmalig, ±10 min)

Stuurt elke ochtend je HRV (vannacht/vanochtend) en de rusthartslag van vandaag naar je trainer.
De opdracht is veilig om vaker te draaien: dezelfde meting wordt niet dubbel opgeslagen. Zonder data wordt niets opgeslagen.
Benodigd: je exec-URL en je token uit 'Koppeling instructies (privé)'. Plak die alleen in de opdracht, nergens anders.

1. Open **Opdrachten** › tab **Opdrachten** › **+**. Noem de opdracht `VOLGAS Gezondheid`.
2. Voeg **Zoek gezondheidsmonsters** toe. Zet *Type* op **Hartslagvariabiliteit** en voeg het filter **Startdatum · is vandaag** toe.
3. Voeg **Haal details van gezondheidsmonsters op** toe met **Waarde**. Zet daaronder **Combineer tekst** met **Nieuwe regels**.
4. Doe stap 3 nog een keer, maar dan met **Startdatum** in plaats van Waarde.
5. Voeg nog een **Zoek gezondheidsmonsters** toe: *Type* **Hartslag in rust**, **Startdatum · is vandaag**, *Sorteer op* **Startdatum**, **Nieuwste eerst**, *Beperk* **1**. Zet daaronder **Haal details van gezondheidsmonsters op** met **Waarde**.
6. Voeg **Haal inhoud van URL op** toe en vul je exec-URL in. Tik op **Toon meer** en kies *Methode* **POST**, *Verzoekhoofdtekst* **JSON**. Voeg deze tekstvelden toe:
   - `action` = `health`
   - `token` = je token
   - `hrv_ms` = de gecombineerde tekst uit stap 3
   - `hrv_ts` = de gecombineerde tekst uit stap 4
   - `resting_hr` = de details uit stap 5
7. Tik op ▶︎. iOS vraagt één keer om toegang tot **Gezondheid**: kies **Sta toe** en zet Hartslagvariabiliteit en Hartslag in rust aan. Verwacht antwoord: `{"ok":true,…}`. Krijg je `"skipped":"leeg"`, dan was er nog geen meting, en dat is prima.
8. Ga naar tab **Automatisering** › **+** › **Tijdstip**. Kies **09:00** en **Dagelijks**.
9. Kies **Voer direct uit** (dus niet *Vraag voor uitvoering*) en zet **Meld bij uitvoering** uit. Tik op **Volgende** en kies `VOLGAS Gezondheid`.
10. Maak een tweede automatisering op dezelfde manier voor **21:00**. Dat is de herkansing als de iPhone om 09:00 vergrendeld was, en dan staat ook de rusthartslag er meestal pas in.
11. Controleer of Toegang tot Gezondheid nog aan staat via **Instellingen** › **Gezondheid** › **Gegevenstoegang en apparaten** › **Opdrachten**.
12. Klaar. Na ongeveer 10 ochtenden verschijnt Herstel (HRV %) in Progressie › Hardlopen. Rusthartslag zie je meteen.

*Werkouts zitten er bewust niet in. Opdrachten geeft geen gemiddelde hartslag per workout, dus TRIMP rekent met je app-log (tijd en gem. HR).*
*Is er geen netwerk, dan kan iOS één melding geven ("Opdracht mislukt"). Gezondheid op slot of geen data geeft geen fout: er wordt gewoon niets opgeslagen.*
