# Essensplanung

In **Essensplanung** legt die planende Person einen Haushalt an, stellt einen Wochenplan zusammen und gibt ihn frei. Einladungscodes sind einmalig und 48 Stunden gültig. Eingeladene Personen melden sich mit ihrem eigenen BodyDashboard-Konto an und geben den Code auf derselben Seite ein. In **Rezepte** lassen sich Gerichte und Nährwertquellen pflegen und für den Haushalt freigeben. Freigegebene Gerichte zeigen eine Portionsvorschau mit Übernahme ins eigene Ernährungstagebuch.

## Betrieb

Die Migration wird vom bestehenden Release-Prozess mit dem SQLite-Backup vor dem Start der neuen API angewendet. Manuelle Planung, Rezepte, Einkaufsliste und Vorratsschrank stehen ohne externe Konfiguration bereit. Optionale Dienste werden über die API-Umgebung konfiguriert.

| Konfiguration | Verwendung |
| --- | --- |
| `MEAL_OPENWEBUI_URL`, `MEAL_OPENWEBUI_KEY`, `MEAL_OPENWEBUI_MODEL` | Open-WebUI-Basis-URL, API-Schlüssel und Modell-ID. Das Modell muss Textantworten in JSON liefern können. |
| `MEAL_PICNIC_URL`, `MEAL_PICNIC_TOKEN`, `MEAL_PICNIC_OWNER_ID` | Authentifizierter Streamable-HTTP-MCP-Endpunkt und BodyDashboard-Konto-ID der Haushaltsverwaltung. Der Endpunkt muss `picnic_search`, `picnic_get_cart` und `picnic_add_to_cart` bereitstellen. |
| `MEAL_COMFY_URL`, `MEAL_COMFY_TOKEN`, `MEAL_COMFY_WORKFLOW`, `MEAL_IMAGE_DIR` | ComfyUI-Basis-URL, optionaler Zugriffstoken, absoluter Pfad zu einem als API-JSON exportierten Workflow und persistenter Ordner für Bilddateien. Der Text-Prompt im Workflow enthält `{{MEAL_PROMPT}}`, die Ausgabe einen SaveImage-Node. |
| `MEAL_NTFY_URL`, `MEAL_NTFY_TOKEN`, `MEAL_NTFY_OWNER_ID`, `MEAL_PUBLIC_URL` | Vollständige URL des privaten ntfy-Topics, optionaler Zugriffstoken, BodyDashboard-Konto-ID der Empfängerin oder des Empfängers und öffentliche URL der App. |

Für den Livebetrieb zunächst Open WebUI mit einem Testhaushalt prüfen. In diesem Haushalt kann anschließend die Automatisierung für Sonntag 09:00 Uhr (Europe/Berlin) aktiviert werden. Die Ansicht **Automatisierung** zeigt gespeicherte Aufträge und bietet einen Neustart bei Fehlern. Für Picnic zuerst Produktsuche und Warenkorb-Lesezugriff mit dem bereitgestellten Endpunkt prüfen. Änderungen am Warenkorb erfordern eine separate Bestätigung in der App. Zeigt die App einen unklaren Übertragungsstatus, den Warenkorb in Picnic prüfen und anschließend den Abgleich in BodyDashboard erneut auslösen. Bilder werden durch die App aus dem persistenten Ordner ausgeliefert. Diesen Ordner bei aktivierter Bildgenerierung in die Datensicherung aufnehmen.

## MCP

Für Meal-Planner-Tools nutzt der bestehende MCP-Server den kontogebundenen `BODYDASH_API_KEY`. `meal-planner:read` erlaubt Abrufe. `meal-planner:write` erlaubt Änderungen gemäß Haushaltsrolle. Beide Scopes können für einen Client kombiniert werden. Die Verzehrerfassung erwartet `requestKey` als UUID. Bei Wiederholung desselben Aufrufs dieselbe UUID verwenden. Die Warenkorbübertragung wird in der PWA bestätigt.

Mit `create_recipe` kann ein MCP-Client Rezepte direkt im Rezeptbuch speichern. Neue Rezepte bleiben standardmäßig privat. Für eine Freigabe im Haushalt dient `shared: true`.
