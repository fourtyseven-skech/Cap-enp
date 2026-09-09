/** Ouvre la fiche de gestion d'un article et rapporte ce qu'elle contient.
    AUCUNE action n'est déclenchée : on regarde, on ne clique rien d'autre. */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = process.argv[2];
const PORT_CDP = 9341;
const PROFIL = "D:/Freelance/SitewebMegasoft/vite-project/.chrome-fiche";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

rmSync(PROFIL, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT_CDP}`, `--user-data-dir=${PROFIL}`,
  "--headless=new", "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
await dormir(2500);
const cibles = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json();
const ws = new WebSocket(cibles.find((c) => c.type === "page").webSocketDebuggerUrl);
let id = 0; const attente = new Map(); const erreurs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && attente.has(m.id)) { attente.get(m.id)(m.result); attente.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") erreurs.push(String(m.params.exceptionDetails.text));
});
await new Promise((r) => ws.addEventListener("open", r));
const envoyer = (methode, params = {}) =>
  new Promise((r) => { const n = ++id; attente.set(n, r); ws.send(JSON.stringify({ id: n, method: methode, params })); });
await envoyer("Page.enable"); await envoyer("Runtime.enable");
const ev = async (e) =>
  (await envoyer("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.value;

await envoyer("Page.navigate", { url: `${BASE}/admin` });
await dormir(4000);
await ev(`(() => {
  const poser = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const c = [...document.querySelectorAll('input')];
  poser(c[0], 'sonde@megasoft-office.com');
  poser(c[1], 'sonde-verification-6-septembre');
  document.querySelector('form').requestSubmit();
  return 1;
})()`);
await dormir(6000);

console.log(await ev(`
  (async () => {
    const attendre = (ms) => new Promise(r => setTimeout(r, ms));
    let boutons = [];
    for (let i = 0; i < 40 && !boutons.length; i += 1) {
      boutons = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Modifier');
      if (!boutons.length) await attendre(500);
    }
    if (!boutons.length) return 'aucune ligne d article';
    boutons[0].click();
    await attendre(1200);

    const fiche = boutons[0].closest('div').parentElement;
    const actions = [...document.querySelectorAll('button')]
      .map(b => b.textContent.trim())
      .filter(t => /Dépublier|Publier|Dupliquer|Versions|Retirer|Voir en ligne|Modifier le contenu|Fermer/.test(t));
    return 'fiche ouverte — boutons : ' + [...new Set(actions)].join(' | ')
      + ' || texte : ' + document.body.innerText.replace(/\s+/g,' ').match(/STATUT.{0,120}/i);
  })()`));
console.log("erreurs :", erreurs.length ? erreurs.join(" | ") : "aucune");
ws.close(); chrome.kill(); process.exit(0);
