
const app = document.getElementById("app");

// Ausschliesslich erfundene Testdaten
// Studiostammdaten
const TEST_STUDIOS = [
    {
        id: 1,
        ort: "Beispielort",
        adresse: "Musterstrasse 10",
        etablissement: "Studio Beispiel",
        gebaeude: "Gebäude A",
        kontakt: "Testkontakt",
        bemerkung: "Keine Bemerkung"
    },
    {
        id: 2,
        ort: "Musterstadt",
        adresse: "Bahnhofstrasse 5",
        etablissement: "Studio Muster",
        gebaeude: "Gebäude B",
        kontakt: "Testkontakt",
        bemerkung: ""
    }
];

let studios = JSON.parse(
    localStorage.getItem("studioStammdaten") ||
    JSON.stringify(TEST_STUDIOS)
);

// Originale Excel-Arbeitsmappe für den Export behalten
let excelArbeitsmappe = null;
let excelTabellenName = null;
let excelDateiDaten = null;

// Kontrollhistorie lokal auf dem Gerät speichern
const SPEICHER_SCHLUESSEL = "studioKontrollHistorie";

// Lokale Datenbank für Studio-Fotos
let fotoDatenbank;

const fotoDatenbankBereit = new Promise((resolve, reject) => {
    const anfrage = indexedDB.open("StudioKontrolleFotos", 1);

    anfrage.onupgradeneeded = function(e) {
        const datenbank = e.target.result;

        if (!datenbank.objectStoreNames.contains("fotos")) {
            datenbank.createObjectStore("fotos", {
                keyPath: "id",
                autoIncrement: true
            });
        }
    };

    anfrage.onsuccess = function(e) {
        fotoDatenbank = e.target.result;
        resolve(fotoDatenbank);
    };

    anfrage.onerror = function() {
        reject(anfrage.error);
    };
});


// Foto zu einem Studio speichern
async function studioFotoSpeichern(studioId, datei, kontrolleId = null) {
    await fotoDatenbankBereit;

    return new Promise((resolve, reject) => {
        const transaktion = fotoDatenbank.transaction(
            ["fotos"],
            "readwrite"
        );

        transaktion.objectStore("fotos").add({
            studioId: studioId,
            kontrolleId: kontrolleId,
            dateiname: datei.name,
            typ: datei.type,
            bild: datei,
            erstellt: new Date().toISOString()
        });

        transaktion.oncomplete = () => resolve();
        transaktion.onerror = () => reject(transaktion.error);
    });
}

// Einzelnes Studio-Foto löschen
async function studioFotoLoeschen(fotoId) {
    await fotoDatenbankBereit;

    return new Promise((resolve, reject) => {
        const transaktion = fotoDatenbank.transaction(
            ["fotos"],
            "readwrite"
        );

        transaktion.objectStore("fotos").delete(fotoId);

        transaktion.oncomplete = () => resolve();
        transaktion.onerror = () => reject(transaktion.error);
    });
}

// Fotos eines Studios laden
async function studioFotosLaden(studioId) {
    await fotoDatenbankBereit;

    return new Promise((resolve, reject) => {
        const transaktion = fotoDatenbank.transaction(
            ["fotos"],
            "readonly"
        );

        const anfrage = transaktion.objectStore("fotos").getAll();

        anfrage.onsuccess = function() {
            resolve(
                anfrage.result.filter(
                    foto => foto.studioId === studioId
                )
            );
        };

        anfrage.onerror = () => reject(anfrage.error);
    });
}


// Fotos eines Studios anzeigen
async function studioFotosAnzeigen(studioId) {
    const fotoListe = document.getElementById("studioFotoListe");
    const fotos = await studioFotosLaden(studioId);

    fotoListe.innerHTML = "";

    if (fotos.length === 0) {
        fotoListe.textContent = "Noch keine Fotos vorhanden.";
        return;
    }

    fotos.forEach(foto => {
        const container = document.createElement("div");
        container.style.marginTop = "15px";

        const bild = document.createElement("img");
        bild.src = URL.createObjectURL(foto.bild);
        bild.alt = foto.dateiname;
        bild.style.width = "100%";
        bild.style.maxWidth = "300px";
        bild.style.display = "block";
        bild.style.borderRadius = "8px";

        const loeschenButton = document.createElement("button");
        loeschenButton.textContent = "Foto löschen";

        loeschenButton.onclick = async function() {
            if (!confirm("Möchtest du dieses Foto wirklich löschen?")) {
                return;
            }

            await studioFotoLoeschen(foto.id);
            studioFotosAnzeigen(studioId);
        };

        container.appendChild(bild);
        container.appendChild(loeschenButton);
        fotoListe.appendChild(container);
    });
}

// Alle Fotos eines Studios teilen
async function studioFotosTeilen(studioId) {
    const fotos = await studioFotosLaden(studioId);

    if (fotos.length === 0) {
        alert("Für dieses Studio sind noch keine Fotos vorhanden.");
        return;
    }

    const studio = studios.find(s => String(s.id) === String(studioId));
    const studioName = studio ? studio.etablissement : "Studio";

    const dateien = [];

    for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];

        const endung = foto.dateiname.includes(".")
            ? foto.dateiname.split(".").pop()
            : "jpg";

        const dateiname = `${studioName.replace(/[^a-zA-Z0-9äöüÄÖÜ_-]/g, "_")}_${i + 1}.${endung}`;

        const datei = new File(
            [foto.bild],
            dateiname,
            { type: foto.typ || "image/jpeg" }
        );

        dateien.push(datei);
    }

    if (navigator.canShare && navigator.canShare({ files: dateien })) {
        await navigator.share({
            files: dateien,
            title: `Fotos – ${studioName}`
        });
    } else {
        alert("Das Teilen von Fotos wird auf diesem Gerät leider nicht unterstützt.");
    }
}

// Mitarbeiterkürzel einmalig speichern
let mitarbeiter = localStorage.getItem("mitarbeiter");

function startseite() {
    if (!mitarbeiter) {
        app.innerHTML = `
            <section>
                <h2>Willkommen</h2>
                <p>Bitte gib dein Mitarbeiterkürzel ein.</p>

                <form id="mitarbeiterForm">
                    <input id="kuerzel"
                        placeholder="Mitarbeiterkürzel"
                        maxlength="10"
                        required>
                    <button type="submit">Speichern</button>
                </form>
            </section>
        `;

        document.getElementById("mitarbeiterForm")
            .addEventListener("submit", function(e) {
                e.preventDefault();

                mitarbeiter = document.getElementById("kuerzel")
                    .value.trim().toUpperCase();

                if (!mitarbeiter) return;

                localStorage.setItem("mitarbeiter", mitarbeiter);
                startseite();
            });

        return;
    }

app.innerHTML = `
    <section>
        <h2>Studio-Kontrolle</h2>
        <p>Mitarbeiter: <strong>${sicher(mitarbeiter)}</strong></p>
        <button id="suche" style="margin-bottom: 35px;">
            Studios suchen
        </button>

        <button id="import">
            Excel-Datei importieren
        </button>

        <input type="file"
            id="excelDatei"
            accept=".xlsx,.xls"
            style="display:none;">

        <button id="export">
            Kontrollen exportieren
        </button>

        <button id="zusammenfuehren">
            Kontrollen zusammenführen
        </button>

    </section>
`;

    document.getElementById("suche")
        .addEventListener("click", studiosuche);
    document.getElementById("import")
        .addEventListener("click", () => {
        document.getElementById("excelDatei").click();
    });

    document.getElementById("excelDatei")
        .addEventListener("change", excelImportieren);
    document.getElementById("export")
        .addEventListener("click", kontrollenExportieren);
    document.getElementById("zusammenfuehren")
        .addEventListener("click", kontrollenZusammenfuehren);
}

// Suche nach Studios
function studiosuche() {
    app.innerHTML = `
        <section>
            <h2>Studios suchen</h2>

            <input id="suchfeld"
                placeholder="Ort, Adresse oder Studio">

            <div id="suchergebnisse"></div>

            <button id="zurueck">Zurück</button>
        </section>
    `;

    document.getElementById("suchfeld")
        .addEventListener("input", ergebnisse);

    document.getElementById("zurueck")
        .addEventListener("click", startseite);

    ergebnisse();
}

function ergebnisse() {
    const suche = document.getElementById("suchfeld")
        .value.toLowerCase();

    const treffer = studios.filter(studio =>
        Object.values(studio).some(wert =>
            String(wert).toLowerCase().includes(suche)
        )
    );

    const liste = document.getElementById("suchergebnisse");
    liste.innerHTML = "";

    treffer.forEach(studio => {
        const button = document.createElement("button");
        button.textContent =
            studio.etablissement + " – " + studio.ort;

        button.addEventListener("click", () =>
            studioAnzeigen(studio.id)
        );

        liste.appendChild(button);
    });

    if (treffer.length === 0) {
        liste.textContent = "Keine Studios gefunden.";
    }
}

// Studio und Kontrollhistorie anzeigen
function studioAnzeigen(id) {
    const studio = studios.find(s => s.id === id);
    const kontrollListe = kontrollHistorie[id] || [];

    const sortiert = [...kontrollListe].sort((a, b) =>
        b.zeitpunkt.localeCompare(a.zeitpunkt)
    );

    app.innerHTML = `
        <section>
            <h2>${sicher(studio.etablissement)}</h2>

            <p><strong>Ort:</strong> ${sicher(studio.ort)}</p>
            <p><strong>Adresse:</strong> ${sicher(studio.adresse)}</p>
            <p><strong>Gebäude:</strong> ${sicher(studio.gebaeude)}</p>
            <p><strong>Kontakt:</strong> ${sicher(studio.kontakt)}</p>
            <p><strong>Bemerkung:</strong> ${sicher(studio.bemerkung)}</p>

            <button id="excelKontrollenButton">
            Bisherige Kontrollen anzeigen
            </button>

            <div id="excelKontrollen" style="display: none; white-space: pre-wrap;"></div>

            <h3>Neu erfasste Kontrollen</h3>
            <div id="historie"></div>

            <h3>Studio-Fotos</h3>

<input
    type="file"
    id="studioFotoDatei"
    accept="image/*"
    multiple
    style="display:none;"
>

<button id="studioFotoHinzufuegen">
    Fotos hinzufügen
</button>

<button id="studioFotosTeilen">
    Alle Fotos per E-Mail teilen
</button>

<div id="studioFotoListe"></div>

<button id="berichtErstellen">
    Bericht erstellen
</button>

<button id="neueKontrolle">
    Neue Kontrolle erfassen
</button>

            <button id="zurueck">Zurück zur Suche</button>
        </section>
    `;
    const excelKontrollen = document.getElementById("excelKontrollen");

        excelKontrollen.textContent =
        studio.kontrollen || "Keine bisherigen Kontrollen vorhanden.";

    const excelKontrollenButton =
    document.getElementById("excelKontrollenButton");

excelKontrollenButton.addEventListener("click", () => {
    if (excelKontrollen.style.display === "none") {
        excelKontrollen.style.display = "block";
        excelKontrollenButton.textContent = "Bisherige Kontrollen ausblenden";
    } else {
        excelKontrollen.style.display = "none";
        excelKontrollenButton.textContent = "Bisherige Kontrollen anzeigen";
    }
});
    
    const historie = document.getElementById("historie");

    if (sortiert.length === 0) {
        historie.textContent = "Noch keine Kontrollen vorhanden.";
    }

    sortiert.forEach(k => {
        const eintrag = document.createElement("p");
        eintrag.textContent =
            `${k.datum} | ${k.uhrzeit} | ${k.mitarbeiter} | ${k.personen} Personen`;
        historie.appendChild(eintrag);

        const details = document.createElement("p");
        details.textContent = k.feststellungen;
        historie.appendChild(details);
    });

    document.getElementById("neueKontrolle")
        .addEventListener("click", () => kontrolleErfassen(id));

    document.getElementById("berichtErstellen")
    .addEventListener("click", () => pdfBerichtErstellen(id));

    document.getElementById("zurueck")
        .addEventListener("click", studiosuche);

    document.getElementById("studioFotosTeilen")
    .addEventListener("click", () => studioFotosTeilen(id));

    // Fotos hinzufügen
document.getElementById("studioFotoHinzufuegen")
    .addEventListener("click", () => {
        document.getElementById("studioFotoDatei").click();
    });

// Ausgewählte Fotos speichern
document.getElementById("studioFotoDatei")
    .addEventListener("change", async function() {
        const dateien = Array.from(this.files);

        try {
            for (const datei of dateien) {
                await studioFotoSpeichern(id, datei);
            }

            await studioFotosAnzeigen(id);

            alert("Fotos wurden erfolgreich gespeichert.");
        } catch (fehler) {
            alert("Die Fotos konnten nicht gespeichert werden.");
            console.error(fehler);
        }

        this.value = "";
    });

// Bereits gespeicherte Fotos anzeigen
studioFotosAnzeigen(id);
}

// Neue Kontrolle erfassen
function kontrolleErfassen(id) {
    const jetzt = new Date();
    const lokal = new Date(
        jetzt.getTime() - jetzt.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 16);

app.innerHTML = `
    <section>
        <h2>${sicher(studio.etablissement)}</h2>

        <p><strong>Ort:</strong> ${sicher(studio.ort)}</p>
        <p><strong>Adresse:</strong> ${sicher(studio.adresse)}</p>
        <p><strong>Gebäude:</strong> ${sicher(studio.gebaeude)}</p>
        <p><strong>Kontakt:</strong> ${sicher(studio.kontakt)}</p>
        <p><strong>Bemerkung:</strong> ${sicher(studio.bemerkung)}</p>

        <button id="neueKontrolle">
            Neue Kontrolle erfassen
        </button>

        <h3>Studio-Fotos</h3>

        <input
            type="file"
            id="studioFotoDatei"
            accept="image/*"
            multiple
            style="display:none;"
        >

        <button id="studioFotoHinzufuegen">
            Fotos hinzufügen
        </button>

        <div id="studioFotoListe"></div>

        <button id="zurueck">
            Zurück zur Suche
        </button>

        <div style="margin-top: 35px;">

            <button id="berichtErstellen">
                Bericht erstellen
            </button>

            <button id="studioFotosTeilen">
                Alle Fotos per E-Mail teilen
            </button>

        </div>

        <button id="excelKontrollenButton">
            Bisherige Kontrollen anzeigen
        </button>

        <div id="excelKontrollen" style="display: none; white-space: pre-wrap;"></div>

        <h3>Neu erfasste Kontrollen</h3>
        <div id="historie"></div>

    </section>
`;

    document.getElementById("abbrechen")
        .addEventListener("click", () => studioAnzeigen(id));

    document.getElementById("kontrollForm")
        .addEventListener("submit", async function(e) {
            e.preventDefault();

            const zeitpunkt =
                document.getElementById("zeitpunkt").value;

            const zahlen = [
                ...document.querySelectorAll(".feststellung")
            ];

            const feststellungen = zahlen.map(input =>
                input.dataset.name + ": " + input.value
            ).join(" | ");

            const weitere =
                document.getElementById("weitere").value.trim();

            const k = {
                id: crypto.randomUUID(),
                zeitpunkt,
                datum: zeitpunkt.slice(0, 10),
                uhrzeit: zeitpunkt.slice(11, 16),
                mitarbeiter,
                personen: document.getElementById("personen").value,
                feststellungen,
                weitere,
                exportiert: false
            };

            if (weitere) {
                k.feststellungen += " | Weitere: " + weitere;
            }

            // Ausgewählte Fotos zur Kontrolle speichern
const fotoDateien = Array.from(
    document.getElementById("kontrollFotos").files
);

try {
    for (const datei of fotoDateien) {
        await studioFotoSpeichern(id, datei, k.id);
    }
} catch (fehler) {
    alert("Die Fotos konnten nicht gespeichert werden. Bitte nochmals versuchen.");
    return;
}
           
            if (!kontrollHistorie[id]) {
                kontrollHistorie[id] = [];
            }

            kontrollHistorie[id].push(k);

            localStorage.setItem(
                SPEICHER_SCHLUESSEL,
                JSON.stringify(kontrollHistorie)
            );

            studioAnzeigen(id);
        });
}

// Foto für die PDF-Erstellung vorbereiten
function fotoAlsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const leser = new FileReader();

        leser.onload = function() {
            resolve(leser.result);
        };

        leser.onerror = function() {
            reject(leser.error);
        };

        leser.readAsDataURL(blob);
    });
}

// PDF-Bericht für ein Studio erstellen
async function pdfBerichtErstellen(studioId) {

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("Die PDF-Bibliothek wurde nicht geladen.");
        return;
    }

    const studio = studios.find(
        s => String(s.id) === String(studioId)
    );

    if (!studio) {
        alert("Studio nicht gefunden.");
        return;
    }

    const kontrollen = [
        ...(kontrollHistorie[studioId] || [])
    ].sort((a, b) =>
        a.zeitpunkt.localeCompare(b.zeitpunkt)
    );

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();

        const seitenBreite =
            pdf.internal.pageSize.getWidth();

        const seitenHoehe =
            pdf.internal.pageSize.getHeight();

        const rand = 20;
        let y = 20;

        function platzPruefen(hoehe) {
            if (y + hoehe > seitenHoehe - 20) {
                pdf.addPage();
                y = 20;
            }
        }

        function textSchreiben(text, groesse = 10, fett = false) {
            pdf.setFont("helvetica", fett ? "bold" : "normal");
            pdf.setFontSize(groesse);

            const zeilen = pdf.splitTextToSize(
                String(text || ""),
                seitenBreite - rand * 2
            );

            platzPruefen(zeilen.length * 6 + 4);

            pdf.text(zeilen, rand, y);
            y += zeilen.length * 6 + 4;
        }

        // Titel
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("STUDIO-KONTROLLBERICHT", rand, y);
        y += 15;

        textSchreiben(studio.etablissement, 16, true);

        textSchreiben(
            "Berichtsdatum: " +
            new Date().toLocaleDateString("de-CH")
        );

        y += 5;

        // Studioangaben
        textSchreiben("ANGABEN ZUM STUDIO", 13, true);

        textSchreiben("Ort: " + studio.ort);
        textSchreiben("Adresse: " + studio.adresse);
        textSchreiben("Gebäude: " + studio.gebaeude);
        textSchreiben("Kontakt: " + studio.kontakt);
        textSchreiben("Bemerkung: " + studio.bemerkung);

        y += 8;

        // Fotos laden
        const fotos = await studioFotosLaden(studioId);

        // Alle Kontrollen
        textSchreiben("DURCHGEFÜHRTE KONTROLLEN", 13, true);

        if (kontrollen.length === 0) {
            textSchreiben("Noch keine Kontrollen vorhanden.");
        }

        for (const kontrolle of kontrollen) {

            platzPruefen(20);
            y += 5;

            textSchreiben(
                "Kontrolle vom " +
                kontrolle.datum +
                " um " +
                kontrolle.uhrzeit,
                12,
                true
            );

            textSchreiben(
                "Mitarbeiter: " + kontrolle.mitarbeiter
            );

            textSchreiben(
                "Kontrollierte Personen: " +
                kontrolle.personen
            );

const feststellungen = String(
    kontrolle.feststellungen || ""
)
    .split("|")
    .map(eintrag => eintrag.trim())
    .filter(eintrag => {
        const treffer = eintrag.match(/:\s*(-?\d+(?:[.,]\d+)?)\s*$/);

        if (!treffer) {
            return eintrag !== "";
        }

        return Number(
            treffer[1].replace(",", ".")
        ) !== 0;
    });

textSchreiben(
    "Feststellungen:" +
    (feststellungen.length > 0
        ? " " + feststellungen.join(" | ")
        : "")
);
        
            // Fotos dieser Kontrolle
            const kontrollFotos = fotos.filter(
                foto => foto.kontrolleId === kontrolle.id
            );

            for (const foto of kontrollFotos) {

                try {
                    const dataUrl =
                        await fotoAlsDataUrl(foto.bild);

                    const bildInfo =
                        pdf.getImageProperties(dataUrl);

                    const maxBreite =
                        seitenBreite - rand * 2;

                    const maxHoehe = 110;

                    const faktor = Math.min(
                        maxBreite / bildInfo.width,
                        maxHoehe / bildInfo.height
                    );

                    const bildBreite =
                        bildInfo.width * faktor;

                    const bildHoehe =
                        bildInfo.height * faktor;

                    platzPruefen(bildHoehe + 15);

                    pdf.addImage(
                        dataUrl,
                        undefined,
                        rand,
                        y,
                        bildBreite,
                        bildHoehe
                    );

                    y += bildHoehe + 10;

                } catch (fotoFehler) {
                    textSchreiben(
                        "Ein Foto konnte nicht eingefügt werden: " +
                        foto.dateiname
                    );
                }
            }
        }

        // Ältere Fotos ohne Kontrollzuordnung ebenfalls aufnehmen
        const weitereFotos = fotos.filter(
            foto => !foto.kontrolleId
        );

        if (weitereFotos.length > 0) {

            y += 5;
            textSchreiben("WEITERE STUDIOFOTOS", 13, true);

            for (const foto of weitereFotos) {

                try {
                    const dataUrl =
                        await fotoAlsDataUrl(foto.bild);

                    const bildInfo =
                        pdf.getImageProperties(dataUrl);

                    const faktor = Math.min(
                        (seitenBreite - rand * 2) / bildInfo.width,
                        110 / bildInfo.height
                    );

                    const bildBreite =
                        bildInfo.width * faktor;

                    const bildHoehe =
                        bildInfo.height * faktor;

                    platzPruefen(bildHoehe + 15);

                    pdf.addImage(
                        dataUrl,
                        undefined,
                        rand,
                        y,
                        bildBreite,
                        bildHoehe
                    );

                    y += bildHoehe + 10;

                } catch (fotoFehler) {
                    textSchreiben(
                        "Ein Foto konnte nicht eingefügt werden: " +
                        foto.dateiname
                    );
                }
            }
        }

        // Seitenzahlen
        const seitenAnzahl = pdf.internal.getNumberOfPages();

        for (let i = 1; i <= seitenAnzahl; i++) {
            pdf.setPage(i);
            pdf.setFontSize(9);
            pdf.setFont("helvetica", "normal");

            pdf.text(
                "Seite " + i + " von " + seitenAnzahl,
                seitenBreite / 2,
                seitenHoehe - 10,
                { align: "center" }
            );
        }

        // PDF-Dateiname
        const sichererName =
            studio.etablissement.replace(
                /[^a-zA-Z0-9äöüÄÖÜß_-]/g,
                "_"
            );

        const dateiname =
            "Studio-Bericht-" + sichererName + ".pdf";

        const pdfBlob = pdf.output("blob");

        const pdfDatei = new File(
            [pdfBlob],
            dateiname,
            { type: "application/pdf" }
        );

        if (
            navigator.canShare &&
            navigator.canShare({ files: [pdfDatei] })
        ) {
            await navigator.share({
                files: [pdfDatei],
                title: "Studio-Kontrollbericht"
            });
        } else {
            pdf.save(dateiname);
        }

    } catch (fehler) {
        console.error(fehler);
        alert("Der PDF-Bericht konnte nicht erstellt werden.");
    }
}

// Excel-Datei importieren
function excelImportieren(e) {
    const datei = e.target.files[0];

    if (!datei) return;

    const leser = new FileReader();

    leser.onload = function(event) {
        try {
            excelDateiDaten = event.target.result.slice(0);

            excelArbeitsmappe = XLSX.read(
                event.target.result,
                { type: "array" }
            );

            console.log("Excel-Arbeitsmappe:", excelArbeitsmappe);

            const importierteStudios = [];

            excelTabellenName = excelArbeitsmappe.SheetNames[0];

            excelArbeitsmappe.SheetNames.forEach(tabellenName => {

    if (tabellenName === "_KontrollIDs") {
        return;
    }

    const tabelle = XLSX.utils.sheet_to_json(
        excelArbeitsmappe.Sheets[tabellenName],
        {
            header: 1,
            defval: "",
            raw: false
        }
    );

                const studiosAusTabelle = tabelle
                    .slice(1)
                    .map((zeile, index) => ({
id: "excel-" +
    (tabellenName === excelArbeitsmappe.SheetNames[0]
        ? ""
        : tabellenName + "-") +
    (index + 2) + "-" +
    String(zeile[0] || "").trim() + "-" +
    String(zeile[1] || "").trim(),

                        excelTabellenName: tabellenName,
                        excelZeile: index + 2,
                        
                        ort: String(zeile[0] || "").trim(),
                        adresse: String(zeile[1] || "").trim(),
                        etablissement: String(zeile[2] || "").trim(),
                        gebaeude: String(zeile[3] || "").trim(),
                        kontrollen: String(zeile[4] || ""),
                        kontakt: String(zeile[5] || "").trim(),
                        bemerkung: String(zeile[6] || "").trim()
                    }))
                    .filter(studio =>
                        studio.ort ||
                        studio.adresse ||
                        studio.etablissement ||
                        studio.gebaeude ||
                        studio.kontrollen ||
                        studio.kontakt ||
                        studio.bemerkung
                    );

                importierteStudios.push(...studiosAusTabelle);
            });

            if (importierteStudios.length === 0) {
                alert("Keine Studios gefunden.");
                return;
            }

            const bestaetigt = confirm(
            "Möchtest du wirklich alle bisher gespeicherten Kontrollen löschen und die neue Excel-Datei importieren?\n\n" +
            "Dieser Vorgang kann nicht rückgängig gemacht werden."
        );

        if (!bestaetigt) {
            alert("Import abgebrochen. Die bisherigen Daten bleiben erhalten.");
            return;
        }

// Bisherige Kontrollhistorie löschen
kontrollHistorie = {};

localStorage.removeItem(SPEICHER_SCHLUESSEL);
            
            studios = importierteStudios;

            localStorage.setItem(
                "studioStammdaten",
                JSON.stringify(studios)
            );

            alert(
                importierteStudios.length +
                " Studios aus " +
                excelArbeitsmappe.SheetNames.length +
                " Tabellenblättern erfolgreich importiert."
            );

            startseite();

        } catch (fehler) {
            alert("Die Excel-Datei konnte nicht gelesen werden.");
            console.error(fehler);
        } finally {
            e.target.value = "";
        }
    };

    leser.onerror = function() {
        alert("Die Datei konnte nicht geöffnet werden.");
    };

    leser.readAsArrayBuffer(datei);
}

// Kontrollen in die importierte Original-Excel-Datei schreiben
function kontrolltextErstellen(k) {
    const datum = k.datum
        ? k.datum.split("-").reverse().join(".")
        : "";

    const basis =
        datum + ", " +
        k.uhrzeit + " Uhr, " +
        k.mitarbeiter + ": " +
        k.personen + " Personen kontrolliert";

    const feststellungen = String(k.feststellungen || "")
        .split("|")
        .map(eintrag => eintrag.trim())
        .filter(eintrag => {
            if (eintrag.startsWith("Weitere:")) {
                return false;
            }

            const treffer = eintrag.match(/^(.+?):\s*(\d+)$/);

            return treffer && Number(treffer[2]) > 0;
        });

    if (k.weitere && k.weitere.trim()) {
        feststellungen.push("Weitere: " + k.weitere.trim());
    }

    return [
        basis,
        ...feststellungen
    ].join(", ");
}

async function kontrollenExportieren() {
if (!window.XLSX || typeof ExcelJS === "undefined") {
    alert("Eine benötigte Excel-Bibliothek wurde nicht geladen.");
    return;
}

if (!excelDateiDaten) {
    alert("Bitte zuerst die Excel-Datei importieren.");
    return;
}

    if (!excelArbeitsmappe || !excelTabellenName) {
        alert("Bitte zuerst die Excel-Datei importieren.");
        return;
    }

const neueArbeitsmappe = new ExcelJS.Workbook();

await neueArbeitsmappe.xlsx.load(excelDateiDaten);

if (studios.length === 0) {
    alert("Es wurden keine Studios importiert.");
    return;
}

let idArbeitsblatt =
    neueArbeitsmappe.getWorksheet("_KontrollIDs");

if (!idArbeitsblatt) {
    idArbeitsblatt =
        neueArbeitsmappe.addWorksheet("_KontrollIDs");

    idArbeitsblatt.state = "veryHidden";
    
idArbeitsblatt.addRow([
    "Kontroll-ID",
    "Excel-Zeile",
    "Kontrolldatum",
    "Mitarbeiter",
    "Kontrolltext",
    "Excel-Tabellenblatt"
]);
}

    let anzahlExportiert = 0;

    const exportierteKontrollen = [];

    studios.forEach((studio, index) => {
        const kontrollen = kontrollHistorie[studio.id] || [];

        const nichtExportiert = kontrollen.filter(
            k => k.exportiert !== true
        );

        if (nichtExportiert.length === 0) return;

const neuesArbeitsblatt =
    neueArbeitsmappe.getWorksheet(studio.excelTabellenName);

if (!neuesArbeitsblatt) {
    alert(
        "Das Tabellenblatt " +
        studio.excelTabellenName +
        " wurde nicht gefunden."
    );
    return;
}
       
const excelZeile = studio.excelZeile;

if (!excelZeile) {
    alert(
        "Die Excel-Zeilennummer für " +
        studio.etablissement +
        " wurde nicht gefunden."
    );
    return;
}

const zelle = neuesArbeitsblatt.getCell(
    excelZeile,
    5
);

const alteKontrollen =
    zelle.value == null ? "" : String(zelle.value);

const neueEintraege = nichtExportiert
    .sort((a, b) =>
        a.zeitpunkt.localeCompare(b.zeitpunkt)
    )
    .map(k => kontrolltextErstellen(k));

zelle.value = [
    alteKontrollen,
    ...neueEintraege
].filter(Boolean).join("\n");

        anzahlExportiert += nichtExportiert.length;
        exportierteKontrollen.push(...nichtExportiert);
nichtExportiert.forEach(k => {
    const kontrolltext = kontrolltextErstellen(k);

idArbeitsblatt.addRow([
    k.id,
    excelZeile,
    k.datum || "",
    k.mitarbeiter || "",
    kontrolltext,
    studio.excelTabellenName
]);
});

});
    // Arbeitsmappe erstellen

    const jetzt = new Date();

    const zeitstempel =
        jetzt.getFullYear() + "-" +
        String(jetzt.getMonth() + 1).padStart(2, "0") + "-" +
        String(jetzt.getDate()).padStart(2, "0") + "-" +
        String(jetzt.getHours()).padStart(2, "0") +
        String(jetzt.getMinutes()).padStart(2, "0");

    const dateiname =
        "Studio-Kontrolle-Export-" + zeitstempel + ".xlsx";

if (exportierteKontrollen.length === 0) {
    alert("Es gibt keine neuen Kontrollen zum Exportieren.");
    return;
}

try {
    const buffer = await neueArbeitsmappe.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const exportDatei = new File(
    [blob],
    dateiname,
    {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    );

// Fotos der exportierten Kontrollen zusammensuchen
const dateienZumTeilen = [exportDatei];

for (const studio of studios) {
    const kontrollenDiesesStudios = exportierteKontrollen.filter(
        k => (kontrollHistorie[studio.id] || [])
            .some(eintrag => eintrag.id === k.id)
    );

    if (kontrollenDiesesStudios.length === 0) continue;

    const fotos = await studioFotosLaden(studio.id);

    const passendeFotos = fotos.filter(foto =>
        kontrollenDiesesStudios.some(
            kontrolle => kontrolle.id === foto.kontrolleId
        )
    );

    for (let i = 0; i < passendeFotos.length; i++) {
        const foto = passendeFotos[i];

        const endung = foto.dateiname.includes(".")
            ? foto.dateiname.split(".").pop()
            : "jpg";

        const studioName = studio.etablissement.replace(
            /[^a-zA-Z0-9äöüÄÖÜß_-]/g,
            "_"
        );

        const fotoDatei = new File(
            [foto.bild],
            `${studioName}_Foto_${i + 1}.${endung}`,
            { type: foto.typ || "image/jpeg" }
        );

        dateienZumTeilen.push(fotoDatei);
    }
}
    
if (navigator.canShare && navigator.canShare({ files: dateienZumTeilen })) {

    await navigator.share({
        files: dateienZumTeilen,
        title: "Studio-Kontrolle Export",
        text: "Hier ist die exportierte Kontrollliste."
    });

} else {

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = dateiname;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

} catch (fehler) {
    alert("Export fehlgeschlagen.");
    console.error(fehler);
    return;
}
    
alert(
    anzahlExportiert +
    " Kontrollen wurden exportiert."
);

exportBestaetigen(exportierteKontrollen);
}


function exportBestaetigen(exportierteKontrollen) {
    const bestaetigt = confirm(
        "Wurde die Excel-Datei erfolgreich heruntergeladen?\n\n" +
        "Möchtest du " + exportierteKontrollen.length +
        " Kontrollen als exportiert markieren?"
    );

    if (!bestaetigt) {
        alert("Die Kontrollen bleiben als nicht exportiert gespeichert.");
        return;
    }

    exportierteKontrollen.forEach(k => {
        k.exportiert = true;
    });

    localStorage.setItem(
        SPEICHER_SCHLUESSEL,
        JSON.stringify(kontrollHistorie)
    );

    alert("Die Kontrollen wurden als exportiert markiert.");
}


// Dynamische Texte sicher anzeigen
function sicher(text) {
    return String(text ?? "").replace(/[&<>"']/g, zeichen => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[zeichen]);
}


async function kontrollenZusammenfuehren() {
    alert("Neue Version der Zusammenführung wurde geladen.");
    const dateiAuswahl = document.createElement("input");

    dateiAuswahl.type = "file";
    dateiAuswahl.accept = ".xlsx";
    dateiAuswahl.multiple = true;

    dateiAuswahl.addEventListener("change", async function() {
        const dateien = Array.from(dateiAuswahl.files);

        if (dateien.length !== 3) {
            alert("Bitte die Masterdatei und beide Exportdateien auswählen.");
            return;
        }

        try {
            const geladeneDateien = [];

            for (const datei of dateien) {
                const arbeitsmappe = new ExcelJS.Workbook();

                await arbeitsmappe.xlsx.load(
                    await datei.arrayBuffer()
                );

                geladeneDateien.push({
                    datei,
                    name: datei.name,
                    arbeitsmappe,
                istExport: datei.name.includes("Export")
                });
            }

            const masterDateien = geladeneDateien.filter(d => !d.istExport);
            const exportDateien = geladeneDateien.filter(d => d.istExport);

if (masterDateien.length !== 1 || exportDateien.length !== 2) {
    throw new Error(
        "Erkennung der Dateien:\n" +
        "Masterdateien: " + masterDateien.length + "\n" +
        "Exportdateien: " + exportDateien.length
    );
}

            const masterEintrag = masterDateien[0];
            const master = masterEintrag.arbeitsmappe;

            if (master.worksheets.length === 0) {
                throw new Error("Die Masterdatei enthält kein Tabellenblatt.");
            }

            let masterIDs = master.getWorksheet("_KontrollIDs");

            if (!masterIDs) {
                masterIDs = master.addWorksheet("_KontrollIDs");
                masterIDs.state = "veryHidden";

masterIDs.addRow([
    "Kontroll-ID",
    "Excel-Zeile",
    "Kontrolldatum",
    "Mitarbeiter",
    "Kontrolltext",
    "Excel-Tabellenblatt"
]);
            }

            const vorhandeneIDs = new Set();

            masterIDs.eachRow((zeile, nummer) => {
                if (nummer > 1 && zeile.getCell(1).value) {
                    vorhandeneIDs.add(String(zeile.getCell(1).value));
                }
            });

            let hinzugefuegt = 0;
            let uebersprungen = 0;

            for (const exportDatei of exportDateien) {
                const exportIDs =
                    exportDatei.arbeitsmappe.getWorksheet("_KontrollIDs");

                exportIDs.eachRow((zeile, nummer) => {
                    if (nummer === 1) return;
                    
const id = String(zeile.getCell(1).value || "");
const excelZeile = Number(zeile.getCell(2).value);
const kontrolltext = zeile.getCell(5).value;
const excelTabellenName = String(zeile.getCell(6).value || "");

                    if (!id || !excelZeile || !kontrolltext) return;

                    if (vorhandeneIDs.has(id)) {
                        uebersprungen++;
                        return;
                    }

                    const masterBlatt = master.getWorksheet(excelTabellenName);

                        if (!masterBlatt) {
                        throw new Error(
                            "Das Tabellenblatt " + excelTabellenName +
                            " wurde in der Masterdatei nicht gefunden."
                        );
                    }

const zielzelle = masterBlatt.getCell(excelZeile, 5);

                    const bisherigerInhalt =
                        zielzelle.value == null
                            ? ""
                            : String(zielzelle.value);

                    zielzelle.value = [
                        bisherigerInhalt,
                        String(kontrolltext)
                    ].filter(Boolean).join("\n");

masterIDs.addRow([
    id,
    excelZeile,
    zeile.getCell(3).value,
    zeile.getCell(4).value,
    kontrolltext,
    excelTabellenName
]);

                    vorhandeneIDs.add(id);
                    hinzugefuegt++;
                });
            }

            if (hinzugefuegt === 0) {
                alert(
                    "Es gibt keine neuen Kontrollen.\n" +
                    uebersprungen + " doppelte Kontrollen wurden erkannt."
                );
                return;
            }

            const bestaetigt = confirm(
                "Die Zusammenführung ist vorbereitet.\n\n" +
                hinzugefuegt + " neue Kontrollen werden ergänzt.\n" +
                uebersprungen + " doppelte Kontrollen werden übersprungen.\n\n" +
                "Möchtest du die bestehende Masterdatei überschreiben?"
            );

            if (!bestaetigt) {
                alert("Vorgang abgebrochen. Die Masterdatei blieb unverändert.");
                return;
            }

            const speicherButton = document.createElement("button");

speicherButton.textContent =
    "Masterdatei jetzt überschreiben";

speicherButton.style.margin = "15px";

app.appendChild(speicherButton);

speicherButton.addEventListener("click", async function() {

    speicherButton.disabled = true;

    try {
        const dateiHandle = await window.showSaveFilePicker({
            suggestedName: masterEintrag.name,
            types: [{
                description: "Excel-Arbeitsmappe",
                accept: {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
                }
            }]
        });

        const buffer = await master.xlsx.writeBuffer();

        const schreibzugriff =
            await dateiHandle.createWritable();

        await schreibzugriff.write(buffer);
        await schreibzugriff.close();

        speicherButton.remove();

        alert(
            "Zusammenführung erfolgreich!\n\n" +
            hinzugefuegt + " neue Kontrollen hinzugefügt.\n" +
            uebersprungen + " doppelte Kontrollen übersprungen.\n\n" +
            "Die Datei wurde gespeichert."
        );

    } catch (fehler) {
        speicherButton.disabled = false;

        if (fehler.name === "AbortError") {
            alert("Speichern abgebrochen. Die Masterdatei blieb unverändert.");
            return;
        }

        console.error(fehler);
        alert("Speicherfehler: " + fehler.message);
    }
});

        } catch (fehler) {
            if (fehler.name === "AbortError") {
                alert("Speichern wurde abgebrochen. Die Masterdatei blieb unverändert.");
                return;
            }

            console.error(fehler);
            alert("Fehler beim Zusammenführen: " + fehler.message);
        }
    });

    dateiAuswahl.click();
}

// Anwendung starten
startseite();
