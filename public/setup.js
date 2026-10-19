// public/setup.js — first-launch wizard, Settings panel and "Add a car" dialog.
(function () {
  const FUELS = ["diesel", "petrol", "hybrid", "plugin", "electric", "lpg"];
  const BODIES = ["estate", "van", "hatchback", "saloon", "suv", "coupe", "convertible"];
  const EQUIP = ["carplay", "camera", "acc", "ahk", "led", "pano", "navi", "seatheat"];
  const WEIGHTS = ["km", "docs", "gearbox", "seller", "price", "distance", "equip"];
  const L = {
    en: {
      wizard: "Set up your car hunt", settings: "Settings", next: "Next", back: "Back", save: "Save", cancel: "Cancel", finish: "Start tracking",
      steps: ["You and home", "The car", "Money", "Distance and equipment", "Problem drivetrains and weights", "Contacting sellers"],
      name: "Name of this hunt", owner: "Your name", home: "Home address", find: "Find", found: "Found:", notFound: "Address not found", travel: "How do you get to viewings?", byCar: "By car", byTransit: "By public transport", languages: "Languages on the page",
      intro: "Car Hunt keeps track of the used cars you are considering: price, mileage, distance from home, equipment and your conversations with sellers, ranked by what matters to you. Everything you set here can be changed later in Settings.",
      fuels: "Fuel", gearbox: "Gearbox", bodies: "Body", minSeats: "Seats at least", include: "Only these makes (comma-separated, empty = all)", exclude: "Never these makes", makesPh: "e.g. VW, Skoda, Toyota", modelsPh: "e.g. Golf, Octavia, Corolla", models: "Models of interest (comma-separated)", yearFrom: "First registration from", yearTo: "First registration until (empty = no limit)", maxKm: "Max mileage (km)", minHp: "Min power (hp)",
      maxPrice: "Max asking price (€)", negotiableUpTo: "Accept up to (€) if negotiable", finance: "I want to finance", monthlyCap: "Max monthly rate (€)", months: "Months", downPayment: "Down payment (€)", apr: "Interest (APR %)",
      maxDriveMin: "Longest trip to a viewing (min)", must: "Must have", nice: "Nice to have",
      avoid: "Avoid these drivetrains", custom: "Add your own (name and words to match, e.g. “Rotary” and “RX-8|Wankel”)", customLabel: "Name", customMatch: "Words to match", weights: "How much each part counts in the score", weightHint: "0 = ignore this part",
      outreach: "Let the Claude routine send a short first message to shortlisted sellers in my name", outLang: "Message language", sender: "Sign messages as",
      outreachHint: "The website never sends messages. Only the optional Claude routine does, and only when this is ticked.",
      fuel: { diesel: "Diesel", petrol: "Petrol", hybrid: "Hybrid", plugin: "Plug-in hybrid", electric: "Electric", lpg: "LPG" },
      gb: { automatic: "Automatic", manual: "Manual", any: "Any" },
      body: { estate: "Estate", van: "Van / MPV", hatchback: "Hatchback", saloon: "Saloon", suv: "SUV", coupe: "Coupé", convertible: "Convertible" },
      eq: { carplay: "CarPlay", camera: "Rear camera", acc: "Adaptive cruise", ahk: "Tow hitch", led: "LED/Xenon", pano: "Panorama roof", navi: "Navigation", seatheat: "Heated seats" },
      w: { km: "Mileage & age", docs: "Maintenance records", gearbox: "Gearbox risk", seller: "Seller & warranty", price: "Price", distance: "Distance", equip: "Equipment" },
      lang: { en: "English", de: "Deutsch", pt: "Português" },
      editCar: "Edit car", saveChanges: "Save changes", month: "Month (optional)", negotiable: "Price is negotiable", add: "Add a car", url: "Listing link", title: "Make and model", price: "Price (€)", km: "Mileage (km)", year: "First registration year", town: "Postcode and town", notes: "Notes", hp: "Power (hp, optional)", added: "Car added", homeNeeded: "Please find your home address first.", loadFail: "Could not load the drivetrain list; you can still save.", needNumber: "Please enter a number for:", netFail: "Could not reach the server:", customOn: "Avoid"
    },
    de: {
      wizard: "Autosuche einrichten", settings: "Einstellungen", next: "Weiter", back: "Zurück", save: "Speichern", cancel: "Abbrechen", finish: "Los geht’s",
      steps: ["Du und dein Zuhause", "Das Auto", "Geld", "Entfernung und Ausstattung", "Problem-Antriebe und Gewichtung", "Verkäufer anschreiben"],
      name: "Name dieser Suche", owner: "Dein Name", home: "Wohnadresse", find: "Suchen", found: "Gefunden:", notFound: "Adresse nicht gefunden", travel: "Wie kommst du zu Besichtigungen?", byCar: "Mit dem Auto", byTransit: "Mit Bus und Bahn", languages: "Sprachen auf der Seite",
      intro: "Car Hunt behält die Gebrauchtwagen im Blick, die für dich in Frage kommen: Preis, Kilometerstand, Entfernung von zu Hause, Ausstattung und deine Gespräche mit Verkäufern, sortiert nach dem, was dir wichtig ist. Alles hier lässt sich später in den Einstellungen ändern.",
      fuels: "Kraftstoff", gearbox: "Getriebe", bodies: "Karosserie", minSeats: "Mindestens Sitze", include: "Nur diese Marken (kommagetrennt, leer = alle)", exclude: "Nie diese Marken", makesPh: "z. B. VW, Skoda, Toyota", modelsPh: "z. B. Golf, Octavia, Corolla", models: "Interessante Modelle (kommagetrennt)", yearFrom: "Erstzulassung ab", yearTo: "Erstzulassung bis (leer = egal)", maxKm: "Max. Laufleistung (km)", minHp: "Mindestleistung (PS)",
      maxPrice: "Höchstpreis (€)", negotiableUpTo: "Bei VB akzeptieren bis (€)", finance: "Ich möchte finanzieren", monthlyCap: "Max. Monatsrate (€)", months: "Monate", downPayment: "Anzahlung (€)", apr: "Zins (eff. %)",
      maxDriveMin: "Längste Anfahrt zur Besichtigung (Min.)", must: "Muss haben", nice: "Wäre schön",
      avoid: "Diese Antriebe meiden", custom: "Eigene hinzufügen (Name und Suchwörter, z. B. „Wankel“ und „RX-8|Wankel“)", customLabel: "Name", customMatch: "Suchwörter", weights: "Wie stark jeder Teil in die Punkte eingeht", weightHint: "0 = diesen Teil nicht werten",
      outreach: "Die Claude-Routine darf vorgemerkten Verkäufern in meinem Namen eine kurze erste Nachricht schicken", outLang: "Sprache der Nachrichten", sender: "Nachrichten unterschreiben mit",
      outreachHint: "Die Website verschickt nie Nachrichten. Das tut nur die optionale Claude-Routine, und nur wenn dies angehakt ist.",
      fuel: { diesel: "Diesel", petrol: "Benzin", hybrid: "Hybrid", plugin: "Plug-in-Hybrid", electric: "Elektro", lpg: "Autogas" },
      gb: { automatic: "Automatik", manual: "Schaltung", any: "Egal" },
      body: { estate: "Kombi", van: "Van", hatchback: "Kompakt", saloon: "Limousine", suv: "SUV", coupe: "Coupé", convertible: "Cabrio" },
      eq: { carplay: "CarPlay", camera: "Rückfahrkamera", acc: "Abstandstempomat", ahk: "Anhängerkupplung", led: "LED/Xenon", pano: "Panoramadach", navi: "Navi", seatheat: "Sitzheizung" },
      w: { km: "Laufleistung & Alter", docs: "Wartungsnachweise", gearbox: "Getrieberisiko", seller: "Verkäufer & Gewährleistung", price: "Preis", distance: "Entfernung", equip: "Ausstattung" },
      lang: { en: "English", de: "Deutsch", pt: "Português" },
      editCar: "Auto bearbeiten", saveChanges: "Änderungen speichern", month: "Monat (optional)", negotiable: "Preis verhandelbar", add: "Auto hinzufügen", url: "Link zum Inserat", title: "Marke und Modell", price: "Preis (€)", km: "Kilometerstand", year: "Erstzulassung (Jahr)", town: "PLZ und Ort", notes: "Notizen", hp: "Leistung (PS, optional)", added: "Auto hinzugefügt", homeNeeded: "Bitte zuerst die Wohnadresse suchen.", loadFail: "Die Liste der Antriebe konnte nicht geladen werden; Speichern geht trotzdem.", needNumber: "Bitte eine Zahl eingeben für:", netFail: "Server nicht erreichbar:", customOn: "Meiden"
    },
    pt: {
      wizard: "Configure sua busca", settings: "Configurações", next: "Próximo", back: "Voltar", save: "Salvar", cancel: "Cancelar", finish: "Começar",
      steps: ["Você e sua casa", "O carro", "Dinheiro", "Distância e equipamentos", "Motores problemáticos e pesos", "Contato com vendedores"],
      name: "Nome desta busca", owner: "Seu nome", home: "Endereço de casa", find: "Buscar", found: "Encontrado:", notFound: "Endereço não encontrado", travel: "Como você vai às visitas?", byCar: "De carro", byTransit: "De transporte público", languages: "Idiomas da página",
      intro: "O Car Hunt acompanha os carros usados que você está considerando: preço, quilometragem, distância de casa, equipamentos e suas conversas com vendedores, em ordem do que importa para você. Tudo o que você definir aqui pode ser alterado depois nas Configurações.",
      fuels: "Combustível", gearbox: "Câmbio", bodies: "Carroceria", minSeats: "Lugares no mínimo", include: "Só estas marcas (separadas por vírgula, vazio = todas)", exclude: "Nunca estas marcas", makesPh: "ex.: VW, Skoda, Toyota", modelsPh: "ex.: Golf, Octavia, Corolla", models: "Modelos de interesse (separados por vírgula)", yearFrom: "Primeiro registro a partir de", yearTo: "Primeiro registro até (vazio = sem limite)", maxKm: "Quilometragem máx. (km)", minHp: "Potência mín. (cv)",
      maxPrice: "Preço máximo (€)", negotiableUpTo: "Aceitar até (€) se negociável", finance: "Quero financiar", monthlyCap: "Parcela máxima (€)", months: "Meses", downPayment: "Entrada (€)", apr: "Juros (% ao ano)",
      maxDriveMin: "Viagem máxima até a visita (min)", must: "Obrigatório", nice: "Desejável",
      avoid: "Evitar estes motores e câmbios", custom: "Adicionar o seu (nome e palavras, ex.: “Wankel” e “RX-8|Wankel”)", customLabel: "Nome", customMatch: "Palavras", weights: "Quanto cada parte conta na pontuação", weightHint: "0 = ignorar esta parte",
      outreach: "Permitir que a rotina do Claude envie uma primeira mensagem curta aos vendedores salvos em meu nome", outLang: "Idioma das mensagens", sender: "Assinar mensagens como",
      outreachHint: "O site nunca envia mensagens. Só a rotina opcional do Claude, e só se isto estiver marcado.",
      fuel: { diesel: "Diesel", petrol: "Gasolina", hybrid: "Híbrido", plugin: "Híbrido plug-in", electric: "Elétrico", lpg: "GLP" },
      gb: { automatic: "Automático", manual: "Manual", any: "Tanto faz" },
      body: { estate: "Perua", van: "Minivan", hatchback: "Hatch", saloon: "Sedã", suv: "SUV", coupe: "Cupê", convertible: "Conversível" },
      eq: { carplay: "CarPlay", camera: "Câmera de ré", acc: "Piloto adaptativo", ahk: "Engate", led: "LED/Xenon", pano: "Teto panorâmico", navi: "Navegação", seatheat: "Bancos aquecidos" },
      w: { km: "Quilometragem e idade", docs: "Histórico de manutenção", gearbox: "Risco do câmbio", seller: "Vendedor e garantia", price: "Preço", distance: "Distância", equip: "Equipamentos" },
      lang: { en: "English", de: "Deutsch", pt: "Português" },
      editCar: "Editar carro", saveChanges: "Salvar alterações", month: "Mês (opcional)", negotiable: "Preço negociável", add: "Adicionar carro", url: "Link do anúncio", title: "Marca e modelo", price: "Preço (€)", km: "Quilometragem (km)", year: "Ano do primeiro registro", town: "CEP e cidade", notes: "Anotações", hp: "Potência (cv, opcional)", added: "Carro adicionado", homeNeeded: "Busque primeiro o endereço de casa.", loadFail: "Não foi possível carregar a lista de motores; ainda dá para salvar.", needNumber: "Informe um número para:", netFail: "Não foi possível falar com o servidor:", customOn: "Evitar"
    }
  };

  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === "text") e.textContent = v; else if (k.startsWith("on")) e[k] = v; else if (v === true) e.setAttribute(k, ""); else if (v !== false && v != null) e.setAttribute(k, v); } kids.flat().forEach(k => k && e.append(k)); return e; };
  const get = (o, path) => path.split(".").reduce((x, k) => x && x[k], o);
  const set = (o, path, v) => { const ks = path.split("."); const last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };
  const list = s => s.split(",").map(x => x.trim()).filter(Boolean);

  // Field builders return [element, read(), input?] where read() writes the value into the profile
  // and returns a label (or a list of labels) for number fields that are empty or not a number.
  function text(t, p, path, label, type = "text") { const i = el("input", { type, value: get(p, path) ?? "" }); return [el("label", {}, t[label] || label, i), () => set(p, path, i.value.trim()), i]; }
  function number(t, p, path, label, opts = {}) {
    const v = get(p, path); const i = el("input", { type: "number", value: v ?? "", min: opts.min, max: opts.max, step: opts.step || 1, required: !opts.nullable, inputmode: "numeric" });
    return [el("label", {}, t[label] || label, i), () => {
      const raw = i.value.trim();
      if (raw === "" && opts.nullable) { set(p, path, null); return; }
      if (raw === "" || !Number.isFinite(Number(raw))) return t[label] || label; // reported by readStep, profile left unchanged
      set(p, path, Number(raw));
    }, i];
  }
  function check(t, p, path, label) { const i = el("input", { type: "checkbox" }); i.checked = !!get(p, path); return [el("div", { class: "opts" }, el("label", {}, i, t[label] || label)), () => set(p, path, i.checked), i]; }
  function multi(t, p, path, label, options, names) {
    const cur = new Set(get(p, path)); const boxes = options.map(o => { const b = el("input", { type: "checkbox", value: o }); b.checked = cur.has(o); return b; });
    return [el("fieldset", {}, el("legend", { text: t[label] || label }), el("div", { class: "opts" }, boxes.map((b, i) => el("label", {}, b, names[options[i]])))), () => set(p, path, boxes.filter(b => b.checked).map(b => b.value))];
  }
  function select(t, p, path, label, options, names) {
    const s = el("select", {}, options.map(o => { const op = el("option", { value: o, text: names[o] }); op.selected = get(p, path) === o; return op; }));
    return [el("label", {}, t[label] || label, s), () => set(p, path, s.value), s];
  }
  function csv(t, p, path, label, ph) { const i = el("input", { type: "text", value: (get(p, path) || []).join(", "), placeholder: ph ? t[ph] : null }); return [el("label", {}, t[label] || label, i), () => set(p, path, list(i.value)), i]; }
  // Short fields side by side; wraps to one column on narrow screens.
  function group(...fields) { return [el("div", { class: "frow" }, fields.map(f => f[0])), () => fields.map(f => f[1]())]; }
  // A checkbox that shows its dependent fields only while it is ticked. Hidden fields are not read, so their values stay in the profile.
  function reveal(ctrl, fields, onOpen) {
    const box = el("div", { class: "sub" }, fields.map(f => f[0]));
    const sync = () => { box.hidden = !ctrl[2].checked; if (ctrl[2].checked && onOpen) onOpen(); };
    ctrl[2].addEventListener("change", sync); sync();
    return [el("div", { class: "grp" }, ctrl[0], box), () => [ctrl[1](), ...(box.hidden ? [] : fields.map(f => f[1]()))], null, () => sync()];
  }
  // One question sets both owner.hasCar and distance.preferTransit.
  function travelField(t, p) {
    const byCar = !p.distance.preferTransit;
    const radio = (v, label, on) => { const r = el("input", { type: "radio", name: "sx-travel", value: v }); r.checked = on; return [r, el("label", {}, r, label)]; };
    const [car, carL] = radio("car", t.byCar, byCar), [, busL] = radio("transit", t.byTransit, !byCar);
    return [el("fieldset", { role: "radiogroup" }, el("legend", { text: t.travel }), el("div", { class: "opts" }, carL, busL)), () => { p.owner.hasCar = car.checked; p.distance.preferTransit = !car.checked; }];
  }

  function homeField(t, p) {
    const i = el("input", { type: "text", value: p.home ? p.home.label : "", autocomplete: "street-address", maxlength: 200 }); const out = el("p", { class: "hint", "aria-live": "polite" });
    let lastHome = p.home;
    const b = el("button", { type: "button", class: "primary", text: t.find });
    const find = async () => {
      const q = i.value.trim().slice(0, 200); if (!q) { i.focus(); return; }
      out.textContent = "…"; b.disabled = true;
      try {
        const r = await fetch("/api/geocode?q=" + encodeURIComponent(q));
        if (!r.ok) throw new Error(String(r.status));
        const g = await r.json();
        // Keep the address as typed; the long geocoder name is only shown as confirmation.
        p.home = lastHome = { label: q, lat: g.lat, lon: g.lon }; out.textContent = `${t.found} ${g.label}`;
      } catch (e) { out.textContent = t.notFound; }
      finally { b.disabled = false; }
    };
    b.onclick = find;
    // Enter looks the address up instead of submitting the form.
    i.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); find(); } });
    // Changing the text invalidates the coordinates until Find is pressed again.
    i.addEventListener("input", () => { p.home = lastHome && i.value.trim() === lastHome.label ? lastHome : null; if (!p.home) out.textContent = ""; });
    return [el("div", { class: "fld" }, el("label", { for: "sx-home" }, t.home), el("div", { class: "addr" }, Object.assign(i, { id: "sx-home" }), b), out), () => {}];
  }

  function avoidField(t, p, catalogue, lang) {
    const state = new Map((p.avoid || []).map(a => [a.id, a]));
    const boxes = catalogue.map(d => { const b = el("input", { type: "checkbox", value: d.id }); b.checked = state.has(d.id) ? state.get(d.id).on : d.default; return [b, d]; });
    const customs = (p.avoid || []).filter(a => a.id.startsWith("custom-"));
    // Entries the catalogue does not list (e.g. it failed to load) are kept as they are.
    const known = new Set(catalogue.map(d => d.id));
    const kept = (p.avoid || []).filter(a => !a.id.startsWith("custom-") && !known.has(a.id));
    const rows = el("div", { style: "display:grid;gap:8px" }); const custom = [];
    const addRow = (a = { label: "", match: "", on: true }) => {
      const c = el("input", { type: "checkbox" }); c.checked = a.on !== false;
      const n = el("input", { type: "text", value: a.label, placeholder: t.customLabel }); const m = el("input", { type: "text", value: a.match, placeholder: t.customMatch });
      custom.push([c, n, m]); rows.append(el("div", { class: "frow" }, el("div", { class: "opts" }, el("label", {}, c, t.customOn)), n, m));
    };
    customs.forEach(addRow); addRow();
    const read = () => {
      const out = boxes.map(([b, d]) => ({ id: d.id, on: b.checked })).concat(kept);
      let k = 1;
      for (const [c, n, m] of custom) { const label = n.value.trim(), match = m.value.trim(); if (label && match) out.push({ id: `custom-${k++}`, on: c.checked, label, match }); }
      p.avoid = out;
    };
    return [el("fieldset", {}, el("legend", { text: t.avoid }), el("div", { class: "opts" }, boxes.map(([b, d]) => el("label", { title: d.reason[lang] || d.reason.en }, b, d.label[lang] || d.label.en))), el("p", { class: "hint", text: t.custom }), rows), read];
  }

  function weightsField(t, p) {
    const inputs = Object.fromEntries(Object.keys(t.w).map(k => [k, el("input", { type: "range", min: 0, max: 5, step: 0.5, value: p.weights[k] })]));
    const fmt = v => new Intl.NumberFormat(document.documentElement.lang || "en", { maximumFractionDigits: 1 }).format(Number(v));
    const labels = Object.entries(inputs).map(([k, i]) => {
      const out = el("output", { class: "wv", text: fmt(i.value) });
      i.addEventListener("input", () => { out.textContent = fmt(i.value); });
      return el("label", { class: "weight" }, el("span", { class: "wl" }, el("span", { text: t.w[k] }), out), i);
    });
    return [el("fieldset", {}, el("legend", { text: t.weights }), el("p", { class: "hint", text: t.weightHint }), el("div", { class: "frow" }, labels)), () => { for (const [k, i] of Object.entries(inputs)) p.weights[k] = Number(i.value); }];
  }

  function steps(t, p, catalogue, lang) {
    const owner = text(t, p, "owner.name", "owner"), sender = text(t, p, "outreach.senderName", "sender");
    // Prefill the signature with the name from step 1 when it is still empty.
    const prefill = () => { if (!sender[2].value.trim()) sender[2].value = owner[2].value.trim(); };
    return [
      [text(t, p, "name", "name"), owner, homeField(t, p), travelField(t, p), multi(t, p, "languages", "languages", ["en", "de", "pt"], t.lang)],
      [multi(t, p, "car.fuels", "fuels", FUELS, t.fuel), select(t, p, "car.gearbox", "gearbox", ["automatic", "manual", "any"], t.gb), multi(t, p, "car.bodies", "bodies", BODIES, t.body),
        csv(t, p, "car.makes.include", "include", "makesPh"), csv(t, p, "car.makes.exclude", "exclude", "makesPh"), csv(t, p, "car.models", "models", "modelsPh"),
        group(number(t, p, "car.minSeats", "minSeats", { min: 2, max: 9 }), number(t, p, "car.yearFrom", "yearFrom", { min: 1990, max: 2100 }), number(t, p, "car.yearTo", "yearTo", { min: 1990, max: 2100, nullable: true })),
        group(number(t, p, "car.maxKm", "maxKm", { min: 0, max: 1000000, step: 5000 }), number(t, p, "car.minHp", "minHp", { min: 0, max: 1000 }))],
      [group(number(t, p, "money.maxPrice", "maxPrice", { min: 0, max: 1000000, step: 250 }), number(t, p, "money.negotiableUpTo", "negotiableUpTo", { min: 0, max: 1000000, step: 250 })),
        reveal(check(t, p, "money.finance.enabled", "finance"), [group(number(t, p, "money.finance.monthlyCap", "monthlyCap", { min: 0, max: 100000 }), number(t, p, "money.finance.months", "months", { min: 6, max: 120 }), number(t, p, "money.finance.downPayment", "downPayment", { min: 0, max: 1000000, step: 250 }), number(t, p, "money.finance.apr", "apr", { min: 0, max: 30, step: 0.1 }))])],
      [number(t, p, "distance.maxDriveMin", "maxDriveMin", { min: 5, max: 600, step: 5 }), multi(t, p, "equipment.must", "must", EQUIP, t.eq), multi(t, p, "equipment.nice", "nice", EQUIP, t.eq)],
      [avoidField(t, p, catalogue, lang), weightsField(t, p)],
      [reveal(check(t, p, "outreach.enabled", "outreach"), [select(t, p, "outreach.language", "outLang", ["de", "en", "pt"], t.lang), sender], prefill), [el("p", { class: "hint", text: t.outreachHint }), () => {}]]
    ];
  }

  function defaultProfile() {
    return { version: 1, name: "Car Hunt", owner: { name: "", hasCar: true }, home: null, languages: ["en", "de", "pt"],
      car: { fuels: ["diesel", "petrol", "hybrid"], gearbox: "any", bodies: ["estate", "van", "hatchback", "saloon", "suv"], minSeats: 5, makes: { include: [], exclude: [] }, models: [], exceptions: [], yearFrom: 2015, yearTo: null, maxKm: 200000, minHp: 0 },
      money: { maxPrice: 15000, negotiableUpTo: 15000, finance: { enabled: false, monthlyCap: 250, months: 60, downPayment: 0, apr: 7.5 } },
      distance: { maxDriveMin: 60, preferTransit: false }, equipment: { must: [], nice: ["carplay", "camera", "acc", "navi", "seatheat"] }, avoid: [],
      weights: { km: 2, docs: 2, gearbox: 1, seller: 1.5, price: 1, distance: 1.5, equip: 1 }, outreach: { enabled: false, language: "de", senderName: "" } };
  }

  async function open({ mode, lang, onSaved }) {
    const t = L[lang] || L.en;
    let catalogue = [], loadFail = false;
    try { const r = await fetch("drivetrains.json"); if (!r.ok) throw new Error(String(r.status)); catalogue = await r.json(); if (!Array.isArray(catalogue)) throw new Error("bad list"); }
    catch (e) { catalogue = []; loadFail = true; }
    let p = mode === "settings" && window.CarHunt ? structuredClone(window.CarHunt.profile()) : defaultProfile();
    if (mode === "wizard") p.avoid = catalogue.map(d => ({ id: d.id, on: d.default }));
    const all = steps(t, p, catalogue, lang);
    const err = el("p", { class: "err" });
    const dlg = el("dialog", { class: "sx" + (mode === "wizard" ? " wiz" : "") });
    const form = el("form", { method: "dialog" });
    const intro = el("p", { class: "intro", text: t.intro });
    let at = 0, saved = false, busy = false;
    const show = () => {
      form.innerHTML = "";
      const sections = mode === "wizard" ? [at] : all.map((_, i) => i);
      const head = el("div", { class: "sxhead" }, el("h2", { text: mode === "wizard" ? t.wizard : t.settings }));
      // Stepper: every step by name, the current one highlighted, earlier ones marked done.
      if (mode === "wizard") head.append(el("ol", { class: "stepper" }, t.steps.map((name, i) => el("li", { class: i < at ? "done" : i === at ? "cur" : "", "aria-current": i === at ? "step" : null }, el("span", { class: "dot", text: i < at ? "✓" : String(i + 1) }), el("span", { class: "nm", text: name })))));
      const body = el("div", { class: "sxbody" });
      if (loadFail) body.append(el("p", { class: "err", text: t.loadFail }));
      sections.forEach(i => {
        if (mode === "wizard" && i === 0) body.append(intro);
        body.append(el("fieldset", {}, el("h3", { text: t.steps[i] }), all[i].map(([node]) => node)));
        all[i].forEach(f => typeof f[3] === "function" && f[3]());
      });
      const bar = el("div", { class: "bar" });
      if (mode === "wizard" && at > 0) bar.append(el("button", { type: "button", text: t.back, onclick: () => { readStep(at); err.textContent = ""; at--; show(); } }));
      if (mode === "settings") bar.append(el("button", { type: "button", text: t.cancel, onclick: () => dlg.close() }));
      bar.append(el("span"));
      if (mode === "wizard" && at < all.length - 1) bar.append(el("button", { type: "button", class: "primary", text: t.next, onclick: next }));
      else bar.append(el("button", { type: "button", class: "primary", text: mode === "wizard" ? t.finish : t.save, onclick: submit }));
      form.append(head, body, el("div", { class: "sxfoot" }, err, bar));
      body.scrollTop = 0;
    };
    // readStep returns the labels of number fields that are empty or not a number.
    const readStep = i => all[i].map(([, read]) => read()).flat(Infinity).filter(x => typeof x === "string");
    const badNumbers = bad => { if (!bad.length) return false; err.textContent = `${t.needNumber} ${bad.join(", ")}`; return true; };
    function next() {
      if (badNumbers(readStep(at))) return;
      if (at === 0 && !p.home) { err.textContent = t.homeNeeded; return; }
      err.textContent = ""; at++; show();
    }
    async function submit() {
      if (busy) return;
      if (badNumbers(all.flatMap((_, i) => readStep(i)))) return;
      if (!p.home) { err.textContent = t.homeNeeded; return; }
      let r; const btn = form.querySelector(".bar .primary"); busy = true; if (btn) btn.disabled = true;
      try { r = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }); }
      catch (e) { err.textContent = `${t.netFail} ${e.message}`; return; }
      finally { busy = false; if (btn) btn.disabled = false; }
      if (!r.ok) { const j = await r.json().catch(() => ({})); err.textContent = (j.details || [String(r.status)]).join("\n"); return; }
      saved = true; dlg.close(); document.body.classList.remove("setup"); onSaved && onSaved();
    }
    // Enter never closes the form natively: it acts as Next, or as Save/Start on the last step.
    form.addEventListener("submit", e => { e.preventDefault(); if (mode === "wizard" && at < all.length - 1) next(); else submit(); });
    dlg.append(form); document.body.append(dlg);
    // The wizard cannot be dismissed before a profile is saved.
    dlg.addEventListener("close", () => { if (mode === "wizard" && !saved) dlg.showModal(); else dlg.remove(); });
    if (mode === "wizard") {
      dlg.addEventListener("cancel", e => e.preventDefault());
      dlg.addEventListener("keydown", e => { if (e.key === "Escape") e.preventDefault(); });
    }
    show(); dlg.showModal();
  }

  // The add-car and edit-car dialogs share this form. car prefills it and switches it to editing:
  // no notes field (they live on the car card) and only changed fields are sent.
  function carDialog({ lang, car, onSaved }) {
    const t = L[lang] || L.en, editing = !!car;
    const f = { url: el("input", { type: "url", required: true }), title: el("input", { type: "text", required: true }), price: el("input", { type: "number", min: 0, required: true }), km: el("input", { type: "number", min: 0, required: true }), regYear: el("input", { type: "number", min: 1980, max: 2100, required: true }), regMonth: el("input", { type: "number", min: 1, max: 12 }), hp: el("input", { type: "number", min: 1 }),
      fuel: el("select", {}, FUELS.map(x => el("option", { value: x, text: t.fuel[x] }))), gearbox: el("select", {}, ["automatic", "manual"].map(x => el("option", { value: x, text: t.gb[x] }))), town: el("input", { type: "text", required: true }), negotiable: el("input", { type: "checkbox" }), notes: el("textarea", { rows: 3 }) };
    // Form values in the shape the API takes; optional numbers are null when empty.
    const num = i => i.value.trim() === "" ? null : Number(i.value);
    const read = () => ({ url: f.url.value.trim(), title: f.title.value.trim(), price: num(f.price), km: num(f.km), regYear: num(f.regYear), regMonth: num(f.regMonth), hp: num(f.hp), fuel: f.fuel.value, gearbox: f.gearbox.value, town: f.town.value.trim(), negotiable: f.negotiable.checked });
    let before = null;
    if (editing) {
      const v = { url: car.url, title: car.title, price: car.price, km: car.km, regYear: car.regYear, regMonth: car.regMonth, hp: car.hp, town: car.location || car.city };
      for (const [k, x] of Object.entries(v)) f[k].value = x ?? "";
      const fuel = Criteria.fuelOf(car), gb = Criteria.gearboxOf(car);
      if (fuel) f.fuel.value = fuel;
      if (gb) f.gearbox.value = gb;
      f.negotiable.checked = !!car.negotiable;
      before = read();
    }
    const err = el("p", { class: "err" });
    const dlg = el("dialog", { class: "sx" });
    const form = el("form", { method: "dialog" },
      el("div", { class: "sxhead" }, el("h2", { text: editing ? t.editCar : t.add })),
      el("div", { class: "sxbody" }, el("label", {}, t.url, f.url), el("label", {}, t.title, f.title),
      el("div", { class: "frow" }, el("label", {}, t.price, f.price), el("label", {}, t.km, f.km), el("label", {}, t.hp, f.hp)),
      el("div", { class: "frow" }, el("label", {}, t.year, f.regYear), el("label", {}, t.month, f.regMonth)),
      el("div", { class: "frow" }, el("label", {}, t.fuels, f.fuel), el("label", {}, t.gearbox, f.gearbox), el("label", {}, t.town, f.town)),
      el("div", { class: "opts" }, el("label", {}, f.negotiable, t.negotiable)),
      editing ? null : el("label", {}, t.notes, f.notes)),
      el("div", { class: "sxfoot" }, err, el("div", { class: "bar" }, el("button", { type: "button", text: t.cancel, onclick: () => dlg.close() }), el("span"), el("button", { type: "submit", class: "primary", text: editing ? t.saveChanges : t.add }))));
    form.onsubmit = async e => {
      e.preventDefault();
      const now = read();
      let body;
      if (editing) body = Object.fromEntries(Object.entries(now).filter(([k, v]) => v !== before[k]));
      else {
        body = Object.fromEntries(Object.entries(now).filter(([k, v]) => v != null && (k !== "negotiable" || v)));
        if (f.notes.value.trim()) body.notes = f.notes.value.trim();
      }
      if (editing && !Object.keys(body).length) { dlg.close(); return; }
      const btn = form.querySelector(".bar .primary"); if (btn.disabled) return; btn.disabled = true;
      let r;
      const req = editing ? ["/api/cars/" + encodeURIComponent(car.id) + "/listing", "PATCH"] : ["/api/cars", "POST"];
      try { r = await fetch(req[0], { method: req[1], headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      catch (x) { err.textContent = `${t.netFail} ${x.message}`; return; }
      finally { btn.disabled = false; }
      if (!r.ok) { const j = await r.json().catch(() => ({})); err.textContent = (j.details || [j.error || String(r.status)]).join("\n"); return; }
      dlg.close(); onSaved && onSaved();
    };
    dlg.append(form); document.body.append(dlg); dlg.addEventListener("close", () => dlg.remove()); dlg.showModal();
  }
  const addCar = ({ lang, onSaved }) => carDialog({ lang, onSaved });
  const editCar = ({ car, lang, onSaved }) => carDialog({ car, lang, onSaved });

  window.Setup = { open, addCar, editCar };
})();
