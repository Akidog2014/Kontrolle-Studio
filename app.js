// ==========================================
// TEIL 1: GRUNDLAGEN, DATENBANK UND FOTOS
// ==========================================

const app = document.getElementById("app");

// Ausschliesslich erfundene Testdaten
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

let kontrollHistorie = JSON.parse(
    localStorage.getItem(SPEICHER_SCHLUESSEL) || "{}"
);

const fotoDatenbankBereit = new Promise((resolve, reject) => {
    const anfrage = indexedDB.open("StudioKontrolleFotos", 3);

    anfrage.onupgradeneeded = function(e) {
        const datenbank = e.target.result;

        if (!datenbank.objectStoreNames.contains("fotos")) {
            datenbank.createObjectStore("fotos", {
                keyPath: "id",
                autoIncrement: true
            });
        }

        if (!datenbank.objectStoreNames.contains("excel")) {
            datenbank.createObjectStore("excel");
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


// ==========================================
// FOTO-FUNKTIONEN
// ==========================================

// Foto zu einem Studio speichern
async function studioFotoSpeichern(
    studioId,
    datei,
    kontrolleId = null
) {
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

        const anfrage = transaktion
            .objectStore("fotos")
            .getAll();

        anfrage.onsuccess = function() {
            resolve(
                anfrage.result.filter(
                    foto => String(foto.studioId) === String(studioId)
                )
            );
        };

        anfrage.onerror = () => reject(anfrage.error);
    });
}


// Fotos eines Studios anzeigen
async function studioFotosAnzeigen(studioId) {
    const fotoListe = document.getElementById("studioFotoListe");

    if (!fotoListe) return;

    try {
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

                try {
                    await studioFotoLoeschen(foto.id);
                    await studioFotosAnzeigen(studioId);
                } catch (fehler) {
                    console.error(fehler);
                    alert("Das Foto konnte nicht gelöscht werden.");
                }
            };

            container.appendChild(bild);
            container.appendChild(loeschenButton);
            fotoListe.appendChild(container);
        });

    } catch (fehler) {
        console.error(fehler);
        fotoListe.textContent = "Die Fotos konnten nicht geladen werden.";
    }
}


// Alle Fotos eines Studios teilen
async function studioFotosTeilen(studioId) {
    const fotos = await studioFotosLaden(studioId);

    if (fotos.length === 0) {
        alert("Für dieses Studio sind noch keine Fotos vorhanden.");
        return;
    }

    const studio = studios.find(
        s => String(s.id) === String(studioId)
    );

    const studioName = studio
        ? studio.etablissement
        : "Studio";

    const dateien = [];

    for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];

        const endung = foto.dateiname.includes(".")
            ? foto.dateiname.split(".").pop()
            : "jpg";

        const dateiname =
            `${studioName.replace(/[^a-zA-Z0-9äöüÄÖÜ_-]/g, "_")}_${i + 1}.${endung}`;

        const datei = new File(
            [foto.bild],
            dateiname,
            { type: foto.typ || "image/jpeg" }
        );

        dateien.push(datei);
    }

    if (
        navigator.canShare &&
        navigator.canShare({ files: dateien })
    ) {
        await navigator.share({
            files: dateien,
            title: `Fotos – ${studioName}`
        });
    } else {
        alert(
            "Das Teilen von Fotos wird auf diesem Gerät leider nicht unterstützt."
        );
    }
}

// ==========================================
// TEIL 2: STARTSEITE UND STUDIOSUCHE
// ==========================================

// Mitarbeiterkürzel einmalig speichern
let mitarbeiter = localStorage.getItem("mitarbeiter");


// Startseite
function startseite() {
    if (!mitarbeiter) {
        app.innerHTML = `
            <section>
                <h2>Willkommen</h2>
                <p>Bitte gib dein Mitarbeiterkürzel ein.</p>

                <form id="mitarbeiterForm">
                    <input
                        id="kuerzel"
                        placeholder="Mitarbeiterkürzel"
                        maxlength="10"
                        required
                    >

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

            <p>
                Mitarbeiter:
                <strong>${sicher(mitarbeiter)}</strong>
            </p>

            <button id="suche" style="margin-bottom: 35px;">
                Studios suchen
            </button>

            <button id="import">
                Excel-Datei importieren
            </button>

            <input
                type="file"
                id="excelDatei"
                accept=".xlsx,.xls"
                style="display:none;"
            >

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


// Studiosuche
function studiosuche() {
    app.innerHTML = `
        <section>
            <h2>Studios suchen</h2>

            <input
                id="suchfeld"
                placeholder="Ort, Adresse oder Studio"
            >

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


// Suchergebnisse anzeigen
function ergebnisse() {
    const suchfeld = document.getElementById("suchfeld");

    if (!suchfeld) return;

    const suche = suchfeld.value.toLowerCase();

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

        button.addEventListener("click", () => {
            studioAnzeigen(studio.id);
        });

        liste.appendChild(button);
    });

    if (treffer.length === 0) {
        liste.textContent = "Keine Studios gefunden.";
    }
}


// Studio und Kontrollhistorie anzeigen
function studioAnzeigen(id) {
    const studio = studios.find(
        s => String(s.id) === String(id)
    );

    if (!studio) {
        alert("Studio nicht gefunden.");
        return;
    }

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

            <button id="neueKontrolle">
                Neue Kontrolle erfassen
            </button>

            <button id="zurueck">
                Zurück zur Suche
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

            <div style="margin-top: 35px;">
                <button id="berichtErstellen">
                    Bericht erstellen
                </button>

                <button id="studioFotosTeilen">
                    Alle Fotos per E-Mail teilen
                </button>
            </div>

            <div style="display:block;">
                <button id="excelKontrollenButton">
                    Bisherige Kontrollen anzeigen
                </button>

                <div
                    id="excelKontrollen"
                    style="display:none; white-space:pre-wrap;"
                ></div>

                <h3>Neu erfasste Kontrollen</h3>

                <div id="historie"></div>
            </div>
        </section>
    `;

    // Bisherige Kontrollen aus der Excel-Datei
    const excelKontrollen =
        document.getElementById("excelKontrollen");

    excelKontrollen.textContent =
        studio.kontrollen ||
        "Keine bisherigen Kontrollen vorhanden.";

    const excelKontrollenButton =
        document.getElementById("excelKontrollenButton");

    excelKontrollenButton.addEventListener("click", () => {
        if (excelKontrollen.style.display === "none") {
            excelKontrollen.style.display = "block";

            excelKontrollenButton.textContent =
                "Bisherige Kontrollen ausblenden";
        } else {
            excelKontrollen.style.display = "none";

            excelKontrollenButton.textContent =
                "Bisherige Kontrollen anzeigen";
        }
    });

    // Neu erfasste Kontrollen anzeigen
    const historie = document.getElementById("historie");

    if (sortiert.length === 0) {
        historie.textContent =
            "Noch keine Kontrollen vorhanden.";
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

    // Schaltflächen verbinden
    document.getElementById("neueKontrolle")
        .addEventListener("click", () => {
            kontrolleErfassen(id);
        });

    document.getElementById("berichtErstellen")
        .addEventListener("click", () => {
            pdfBerichtErstellen(id);
        });

    document.getElementById("zurueck")
        .addEventListener("click", studiosuche);

    document.getElementById("studioFotosTeilen")
        .addEventListener("click", () => {
            studioFotosTeilen(id);
        });

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

// ==========================================
// TEIL 3: KONTROLLEN UND PDF-BERICHTE
// ==========================================


// Neue Kontrolle erfassen
function kontrolleErfassen(id) {
    const studio = studios.find(
        s => String(s.id) === String(id)
    );

    if (!studio) {
        alert("Studio nicht gefunden.");
        return;
    }

    const jetzt = new Date();

    const lokal = new Date(
        jetzt.getTime() - jetzt.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 16);

    app.innerHTML = `
        <section>
            <h2>Neue Kontrolle erfassen</h2>

            <h3>${sicher(studio.etablissement)}</h3>

            <p><strong>Ort:</strong> ${sicher(studio.ort)}</p>
            <p><strong>Adresse:</strong> ${sicher(studio.adresse)}</p>

            <form id="kontrollForm">

                <label for="zeitpunkt">Datum und Uhrzeit:</label>
                <input
                    type="datetime-local"
                    id="zeitpunkt"
                    value="${lokal}"
                    required
                >

                <p>
                    <strong>Mitarbeiter:</strong>
                    ${sicher(mitarbeiter)}
                </p>

                <label for="personen">Kontrollierte Personen:</label>
                <input
                    type="number"
                    id="personen"
                    min="0"
                    value="0"
                    required
                >

                <h3>Feststellungen</h3>

                <label>Meldeverstoss:</label>
                <input
                    type="number"
                    class="feststellung"
                    data-name="Meldeverstoss"
                    min="0"
                    value="0"
                >

                <label>Festnahme:</label>
                <input
                    type="number"
                    class="feststellung"
                    data-name="Festnahme"
                    min="0"
                    value="0"
                >

                <label>RIPOL-Ausschreibung:</label>
                <input
                    type="number"
                    class="feststellung"
                    data-name="RIPOL-Ausschreibung"
                    min="0"
                    value="0"
                >

                <label>Bericht allgemein:</label>
                <input
                    type="number"
                    class="feststellung"
                    data-name="Bericht allgemein"
                    min="0"
                    value="0"
                >

                <label>Aufenthaltsnachforschung:</label>
                <input
                    type="number"
                    class="feststellung"
                    data-name="Aufenthaltsnachforschung"
                    min="0"
                    value="0"
                >

                <label for="weitere">
                    Weitere Feststellungen / Bemerkungen:
                </label>

                <textarea
                    id="weitere"
                    rows="4"
                ></textarea>

                <h3>Fotos zur Kontrolle</h3>

                <input
                    type="file"
                    id="kontrollFotos"
                    accept="image/*"
                    multiple
                >

                <button type="submit">
                    Kontrolle speichern
                </button>

                <button type="button" id="abbrechen">
                    Abbrechen
                </button>

            </form>
        </section>
    `;

    document.getElementById("abbrechen")
        .addEventListener("click", () => {
            studioAnzeigen(id);
        });

    document.getElementById("kontrollForm")
        .addEventListener("submit", async function(e) {
            e.preventDefault();

            const zeitpunkt =
                document.getElementById("zeitpunkt").value;

            if (!zeitpunkt) {
                alert("Bitte Datum und Uhrzeit angeben.");
                return;
            }

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
                alert(
                    "Die Fotos konnten nicht gespeichert werden. " +
                    "Bitte nochmals versuchen."
                );

                console.error(fehler);
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


// ==========================================
// PDF-FUNKTIONEN
// ==========================================


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
            pdf.setFont(
                "helvetica",
                fett ? "bold" : "normal"
            );

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

        pdf.text(
            "STUDIO-KONTROLLBERICHT",
            rand,
            y
        );

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

        // Kontrollen
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

            // Feststellungen ohne Nullwerte anzeigen
            const feststellungen = String(
                kontrolle.feststellungen || ""
            )
                .split("|")
                .map(eintrag => eintrag.trim())
                .filter(eintrag => {
                    const treffer = eintrag.match(
                        /:\s*(-?\d+(?:[.,]\d+)?)\s*$/
                    );

                    if (!treffer) {
                        return eintrag !== "";
                    }

                    return Number(
                        treffer[1].replace(",", ".")
                    ) !== 0;
                });

            textSchreiben(
                "Feststellungen:" +
                (
                    feststellungen.length > 0
                        ? " " + feststellungen.join(" | ")
                        : ""
                )
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

        // Ältere Fotos ohne Kontrollzuordnung aufnehmen
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
        const seitenAnzahl =
            pdf.internal.getNumberOfPages();

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

        alert(
            "Der PDF-Bericht konnte nicht erstellt werden."
        );
    }
}

// ==========================================
// TEIL 4: EXCEL-IMPORT
// ==========================================

async function excelImportieren() {

    await fotoDatenbankBereit;

    const dateiInput = document.createElement("input");

    dateiInput.type = "file";
    dateiInput.accept = ".xlsx,.xls";

    dateiInput.addEventListener("change", async function() {

        const datei = dateiInput.files[0];

        if (!datei) {
            return;
        }

        const bestaetigt = confirm(
            "Beim Import einer neuen Excel-Datei wird die bisherige " +
            "Kontrollhistorie ersetzt.\n\n" +
            "Möchtest du fortfahren?"
        );

        if (!bestaetigt) {
            return;
        }

        try {
            const arrayBuffer = await datei.arrayBuffer();

            const workbook = XLSX.read(arrayBuffer, {
                type: "array"
            });

            const neueStudios = [];

            workbook.SheetNames.forEach(tabellenName => {

                if (tabellenName === "_KontrollIDs") {
                    return;
                }

                const arbeitsblatt =
                    workbook.Sheets[tabellenName];

                const zeilen = XLSX.utils.sheet_to_json(
                    arbeitsblatt,
                    {
                        header: 1,
                        defval: ""
                    }
                );

                zeilen.forEach((zeile, index) => {

                    // Erste Zeile enthält normalerweise die Überschriften
                    if (index === 0) {
                        return;
                    }

                    // Leere Zeilen überspringen
                    if (
                        !zeile ||
                        zeile.every(wert =>
                            String(wert).trim() === ""
                        )
                    ) {
                        return;
                    }

                    neueStudios.push({
                        id: "excel-" +
                            Date.now() +
                            "-" +
                            tabellenName +
                            "-" +
                            index,

                        ort: String(zeile[0] || ""),
                        adresse: String(zeile[1] || ""),
                        etablissement: String(zeile[2] || ""),
                        gebaeude: String(zeile[3] || ""),
                        kontrollen: String(zeile[4] || ""),
                        kontakt: String(zeile[5] || ""),
                        bemerkung: String(zeile[6] || "")
                    });
                });
            });

            if (neueStudios.length === 0) {
                alert(
                    "In der Excel-Datei wurden keine Studios gefunden."
                );
                return;
            }

            // Originaldatei in IndexedDB speichern
            await new Promise((resolve, reject) => {

                const transaktion =
                    fotoDatenbank.transaction(["excel"], "readwrite");

                const speicher =
                    transaktion.objectStore("excel");

                speicher.put(
                    {
                        datei: arrayBuffer,
                        name: datei.name,
                        datum: new Date().toISOString()
                    },
                    "original"
                );

                transaktion.oncomplete = resolve;
                transaktion.onerror = () => reject(transaktion.error);
                transaktion.onabort = () => reject(transaktion.error);
            });

            // Neue Studiendaten übernehmen
            studios = neueStudios;

            localStorage.setItem(
                "studioStammdaten",
                JSON.stringify(studios)
            );

            // Bisherige Kontrollhistorie zurücksetzen
            kontrollHistorie = {};

            localStorage.setItem(
                SPEICHER_SCHLUESSEL,
                JSON.stringify(kontrollHistorie)
            );

            excelArbeitsmappe = workbook;
            excelTabellenName = workbook.SheetNames[0];
            excelDateiDaten = arrayBuffer;

            alert(
                neueStudios.length +
                " Studios wurden erfolgreich importiert."
            );

            startseite();

        } catch (fehler) {

            console.error(fehler);

            alert(
                "Die Excel-Datei konnte nicht importiert werden."
            );
        }
    });

    dateiInput.click();
}

// ==========================================
// TEIL 5: EXCEL-EXPORT
// ==========================================

function kontrolltextErstellen(k) {

    const datum = k.zeitpunkt
        ? new Date(k.zeitpunkt).toLocaleDateString("de-CH")
        : k.datum || "";

    const uhrzeit = k.zeitpunkt
        ? new Date(k.zeitpunkt).toLocaleTimeString(
            "de-CH",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )
        : k.uhrzeit || "";

    return [
        "Datum: " + datum,
        "Zeit: " + uhrzeit,
        "Mitarbeiter: " + (k.mitarbeiter || ""),
        "Kontrollierte Personen: " + (k.personen || "0"),
        "Feststellungen: " + (k.feststellungen || ""),
        "Weitere Bemerkungen: " + (k.weitere || "")
    ].join("\n");
}


// Kontrollen exportieren
async function kontrollenExportieren() {

    const auswahl = [];

    Object.keys(kontrollHistorie).forEach(studioId => {

        const studio = studios.find(
            s => String(s.id) === String(studioId)
        );

        if (!studio) {
            return;
        }

        const kontrollen = kontrollHistorie[studioId] || [];

        kontrollen.forEach(k => {

            if (!k.exportiert) {
                auswahl.push({
                    studioId,
                    studio,
                    kontrolle: k
                });
            }
        });
    });

    if (auswahl.length === 0) {
        alert("Es gibt keine neuen Kontrollen zum Exportieren.");
        return;
    }

    const bestaetigt = confirm(
        auswahl.length +
        " neue Kontrollen werden exportiert.\n\n" +
        "Möchtest du fortfahren?"
    );

    if (!bestaetigt) {
        return;
    }

    if (typeof ExcelJS === "undefined") {
        alert("Die ExcelJS-Bibliothek wurde nicht geladen.");
        return;
    }

    try {

        const workbook = new ExcelJS.Workbook();

        const worksheet = workbook.addWorksheet("Kontroll-Export");

        worksheet.columns = [
            { header: "Studio-ID", key: "studioId", width: 22 },
            { header: "Ort", key: "ort", width: 20 },
            { header: "Adresse", key: "adresse", width: 28 },
            { header: "Etablissement", key: "etablissement", width: 28 },
            { header: "Gebäude", key: "gebaeude", width: 20 },
            { header: "Kontakt", key: "kontakt", width: 25 },
            { header: "Kontrolle", key: "kontrolle", width: 70 }
        ];

        worksheet.getRow(1).font = {
            bold: true
        };

        const idsWorksheet = workbook.addWorksheet("_KontrollIDs");

        idsWorksheet.state = "veryHidden";

        idsWorksheet.columns = [
            { header: "Kontroll-ID", key: "id", width: 40 },
            { header: "Studio-ID", key: "studioId", width: 30 }
        ];

        for (const eintrag of auswahl) {

            const studio = eintrag.studio;
            const k = eintrag.kontrolle;

            worksheet.addRow({
                studioId: studio.id,
                ort: studio.ort || "",
                adresse: studio.adresse || "",
                etablissement: studio.etablissement || "",
                gebaeude: studio.gebaeude || "",
                kontakt: studio.kontakt || "",
                kontrolle: kontrolltextErstellen(k)
            });

            idsWorksheet.addRow({
                id: k.id,
                studioId: studio.id
            });
        }

        worksheet.eachRow((row, rowNumber) => {

            if (rowNumber > 1) {
                row.alignment = {
                    vertical: "top",
                    wrapText: true
                };
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();

        const dateiname =
            "Studio-Export-" +
            new Date().toISOString().slice(0, 10) +
            ".xlsx";

        const exportDatei = new File(
            [buffer],
            dateiname,
            {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        );

        // Fotos der exportierten Kontrollen sammeln
        const fotoDateien = [];

        for (const eintrag of auswahl) {

            const fotos = await studioFotosLaden(
                eintrag.studioId
            );

            const kontrollFotos = fotos.filter(
                foto => foto.kontrolleId === eintrag.kontrolle.id
            );

            for (const foto of kontrollFotos) {

                const datei = new File(
                    [foto.bild],
                    foto.dateiname || "Kontrollfoto.jpg",
                    {
                        type: foto.bild.type || "image/jpeg"
                    }
                );

                fotoDateien.push(datei);
            }
        }

        const alleDateien = [
            exportDatei,
            ...fotoDateien
        ];

        if (
            navigator.canShare &&
            navigator.canShare({ files: alleDateien })
        ) {

            await navigator.share({
                files: alleDateien,
                title: "Studio-Kontroll-Export"
            });

        } else {

            // Excel-Datei herunterladen
            const url = URL.createObjectURL(exportDatei);

            const link = document.createElement("a");

            link.href = url;
            link.download = dateiname;

            document.body.appendChild(link);
            link.click();
            link.remove();

            URL.revokeObjectURL(url);

            // Fotos einzeln herunterladen
            for (const foto of fotoDateien) {

                const fotoUrl = URL.createObjectURL(foto);

                const fotoLink = document.createElement("a");

                fotoLink.href = fotoUrl;
                fotoLink.download = foto.name;

                document.body.appendChild(fotoLink);
                fotoLink.click();
                fotoLink.remove();

                URL.revokeObjectURL(fotoUrl);
            }
        }

        // Erst nach Bestätigung als exportiert markieren
        exportBestaetigen(
            auswahl.map(eintrag => ({
                studioId: eintrag.studioId,
                kontrolleId: eintrag.kontrolle.id
            }))
        );

    } catch (fehler) {

        console.error(fehler);

        alert(
            "Der Export konnte nicht abgeschlossen werden."
        );
    }
}


// Exportierte Kontrollen markieren
function exportBestaetigen(exportierteKontrollen) {

    const bestaetigt = confirm(
        "Wurde die Exportdatei erfolgreich gespeichert oder geteilt?\n\n" +
        "Nur wenn du dies bestätigst, werden die Kontrollen als " +
        "exportiert markiert."
    );

    if (!bestaetigt) {
        return;
    }

    exportierteKontrollen.forEach(eintrag => {

        const kontrollen =
            kontrollHistorie[eintrag.studioId] || [];

        const kontrolle = kontrollen.find(
            k => k.id === eintrag.kontrolleId
        );

        if (kontrolle) {
            kontrolle.exportiert = true;
        }
    });

    localStorage.setItem(
        SPEICHER_SCHLUESSEL,
        JSON.stringify(kontrollHistorie)
    );

    alert("Die Kontrollen wurden als exportiert markiert.");
}

// ==========================================
// TEIL 6: ZUSAMMENFÜHREN UND APP-START
// ==========================================


// HTML-Sonderzeichen sicher darstellen
function sicher(text) {
    return String(text ?? "").replace(/[&<>"']/g, zeichen => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[zeichen]);
}


// ==========================================
// KONTROLLEN ZUSAMMENFÜHREN
// ==========================================

async function kontrollenZusammenfuehren() {

    const dateiInput = document.createElement("input");

    dateiInput.type = "file";
    dateiInput.accept = ".xlsx";
    dateiInput.multiple = true;

    dateiInput.addEventListener("change", async function() {

        const dateien = Array.from(dateiInput.files);

        if (dateien.length !== 2) {
            alert(
                "Bitte genau zwei Dateien auswählen: " +
                "eine Masterdatei und eine Exportdatei."
            );
            return;
        }

        const masterDateien = dateien.filter(
            datei => !datei.name.toLowerCase().includes("export")
        );

        const exportDateien = dateien.filter(
            datei => datei.name.toLowerCase().includes("export")
        );

        if (
            masterDateien.length !== 1 ||
            exportDateien.length !== 1
        ) {
            alert(
                "Die Dateien konnten nicht eindeutig zugeordnet werden.\n\n" +
                "Die Masterdatei darf im Namen nicht «Export» enthalten. " +
                "Die Exportdatei muss «Export» im Dateinamen enthalten."
            );
            return;
        }

        if (typeof ExcelJS === "undefined") {
            alert("Die ExcelJS-Bibliothek wurde nicht geladen.");
            return;
        }

        const bestaetigt = confirm(
            "Folgende Dateien werden zusammengeführt:\n\n" +
            "Master: " + masterDateien[0].name + "\n" +
            "Export: " + exportDateien[0].name + "\n\n" +
            "Möchtest du fortfahren?"
        );

        if (!bestaetigt) {
            return;
        }

        try {

            const master = new ExcelJS.Workbook();
            const exportWorkbook = new ExcelJS.Workbook();

            await master.xlsx.load(
                await masterDateien[0].arrayBuffer()
            );

            await exportWorkbook.xlsx.load(
                await exportDateien[0].arrayBuffer()
            );

            const exportSheet =
                exportWorkbook.getWorksheet("Kontroll-Export");

            if (!exportSheet) {
                alert(
                    "In der Exportdatei wurde das Tabellenblatt " +
                    "«Kontroll-Export» nicht gefunden."
                );
                return;
            }

            const exportIDs =
                exportWorkbook.getWorksheet("_KontrollIDs");

            if (!exportIDs) {
                alert(
                    "Das interne Tabellenblatt «_KontrollIDs» fehlt " +
                    "in der Exportdatei. Der Export kann nicht sicher " +
                    "zusammengeführt werden."
                );
                return;
            }

            let masterIDs =
                master.getWorksheet("_KontrollIDs");

            if (!masterIDs) {
                masterIDs = master.addWorksheet("_KontrollIDs");
                masterIDs.state = "veryHidden";

                masterIDs.columns = [
                    { header: "Kontroll-ID", key: "id", width: 40 },
                    { header: "Studio-ID", key: "studioId", width: 30 }
                ];
            }

            // Bereits vorhandene IDs erfassen
            const vorhandeneIDs = new Set();

            masterIDs.eachRow((row, rowNumber) => {
                if (rowNumber === 1) {
                    return;
                }

                const id = row.getCell(1).value;

                if (id) {
                    vorhandeneIDs.add(String(id));
                }
            });

            // IDs aus dem Export auslesen
            const exportIDZuordnung = new Map();

            exportIDs.eachRow((row, rowNumber) => {
                if (rowNumber === 1) {
                    return;
                }

                const id = row.getCell(1).value;
                const studioId = row.getCell(2).value;

                if (id) {
                    exportIDZuordnung.set(String(id), studioId);
                }
            });

            let uebernommen = 0;
            let bereitsVorhanden = 0;
            let nichtGefunden = 0;

            // Exportzeilen durchgehen
            exportSheet.eachRow((exportRow, rowNumber) => {

                if (rowNumber === 1) {
                    return;
                }

                const exportStudioId =
                    exportRow.getCell(1).value;

                const ort =
                    String(exportRow.getCell(2).value || "").trim();

                const adresse =
                    String(exportRow.getCell(3).value || "").trim();

                const etablissement =
                    String(exportRow.getCell(4).value || "").trim();

                const kontrolle =
                    String(exportRow.getCell(7).value || "").trim();

                if (!kontrolle) {
                    return;
                }

                // Kontroll-ID über die Studio-ID zuordnen
                let kontrollID = null;

                for (const [id, studioId] of exportIDZuordnung) {
                    if (
                        String(id) &&
                        String(studioId) === String(exportStudioId)
                    ) {
                        // Eine Studio-ID kann mehrere Kontrollen haben.
                        // Deshalb wird die ID anhand der Zeilenposition
                        // weiter unten nochmals eindeutig bestimmt.
                        kontrollID = id;
                        break;
                    }
                }

                // Die Kontroll-ID anhand der entsprechenden Exportzeile
                // bestimmen. Die Reihenfolge entspricht dem Export.
                const idZeile = exportIDs.getRow(rowNumber);

                if (idZeile && idZeile.getCell(1).value) {
                    kontrollID = String(idZeile.getCell(1).value);
                }

                if (!kontrollID) {
                    return;
                }

                if (vorhandeneIDs.has(kontrollID)) {
                    bereitsVorhanden++;
                    return;
                }

                // Passendes Studio in der Masterdatei suchen
                let zielZeile = null;

                master.eachSheet(sheet => {

                    if (
                        sheet.name === "_KontrollIDs" ||
                        zielZeile
                    ) {
                        return;
                    }

                    sheet.eachRow((row, nummer) => {

                        if (nummer === 1 || zielZeile) {
                            return;
                        }

                        const masterOrt =
                            String(row.getCell(1).value || "").trim();

                        const masterAdresse =
                            String(row.getCell(2).value || "").trim();

                        const masterEtablissement =
                            String(row.getCell(3).value || "").trim();

                        if (
                            masterOrt === ort &&
                            masterAdresse === adresse &&
                            masterEtablissement === etablissement
                        ) {
                            zielZeile = row;
                        }
                    });
                });

                if (!zielZeile) {
                    nichtGefunden++;
                    return;
                }

                // Bestehende Kontrollen in Spalte E ergänzen
                const bisherigerText =
                    String(zielZeile.getCell(5).value || "").trim();

                zielZeile.getCell(5).value =
                    bisherigerText
                        ? bisherigerText + "\n\n" + kontrolle
                        : kontrolle;

                // ID in Masterdatei eintragen
                masterIDs.addRow([
                    kontrollID,
                    exportStudioId
                ]);

                vorhandeneIDs.add(kontrollID);

                uebernommen++;
            });

            if (uebernommen === 0) {
                alert(
                    "Es wurden keine neuen Kontrollen übernommen.\n\n" +
                    "Bereits vorhanden: " + bereitsVorhanden + "\n" +
                    "Nicht zugeordnete Studios: " + nichtGefunden
                );
                return;
            }

            const buffer = await master.xlsx.writeBuffer();

            const dateiname =
                masterDateien[0].name.replace(/\.xlsx$/i, "") +
                "-zusammengefuehrt.xlsx";

            const blob = new Blob(
                [buffer],
                {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            );

            // Speicherdialog: Masterdatei bewusst auswählen
            if (window.showSaveFilePicker) {

                const handle = await window.showSaveFilePicker({
                    suggestedName: dateiname,
                    types: [{
                        description: "Excel-Datei",
                        accept: {
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
                                ".xlsx"
                            ]
                        }
                    }]
                });

                const writable = await handle.createWritable();

                await writable.write(blob);
                await writable.close();

            } else {

                const url = URL.createObjectURL(blob);

                const link = document.createElement("a");

                link.href = url;
                link.download = dateiname;

                document.body.appendChild(link);
                link.click();
                link.remove();

                URL.revokeObjectURL(url);
            }

            alert(
                "Zusammenführung abgeschlossen!\n\n" +
                "Neu übernommen: " + uebernommen + "\n" +
                "Bereits vorhanden: " + bereitsVorhanden + "\n" +
                "Nicht zugeordnete Studios: " + nichtGefunden
            );

        } catch (fehler) {

            console.error(fehler);

            alert(
                "Die Dateien konnten nicht zusammengeführt werden."
            );
        }
    });

    dateiInput.click();
}


// ==========================================
// GESPEICHERTE EXCEL-DATEI WIEDERHERSTELLEN
// ==========================================

async function excelWiederherstellen() {
    await fotoDatenbankBereit;

    try {

        const gespeicherteDatei = await new Promise(
            (resolve, reject) => {

                const transaktion =
                    fotoDatenbank.transaction(["excel"], "readonly");

                const speicher =
                    transaktion.objectStore("excel");

                const anfrage = speicher.get("original");

                anfrage.onsuccess = () => resolve(anfrage.result);
                anfrage.onerror = () => reject(anfrage.error);
            }
        );

        if (gespeicherteDatei && gespeicherteDatei.datei) {

            excelDateiDaten = gespeicherteDatei.datei;

            const workbook = XLSX.read(
                excelDateiDaten,
                { type: "array" }
            );

            excelArbeitsmappe = workbook;
            excelTabellenName = workbook.SheetNames[0];
        }

    } catch (fehler) {

        console.error(
            "Die gespeicherte Excel-Datei konnte nicht geladen werden:",
            fehler
        );
    }

    startseite();
}


// ==========================================
// APP STARTEN
// ==========================================

excelWiederherstellen();

