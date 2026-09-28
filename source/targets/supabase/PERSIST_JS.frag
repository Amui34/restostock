/* ================= Sauvegarde partagée (Supabase) =================
   Chaque produit, chaque fiche, chaque inventaire est une ligne séparée dans la
   base. C'est ce qui permet à deux personnes de saisir en même temps sans
   s'écraser : le chef de cuisine qui corrige une fiche et le barman qui saisit
   une livraison touchent des lignes différentes.

   On n'envoie que ce qui a changé depuis le dernier enregistrement, comparé à
   une empreinte gardée en mémoire — sinon chaque frappe renverrait les 477
   produits. */

function sbTable(){ return sbClient.from('documents'); }

// --- Conversion entre l'état de l'appli et les lignes de la base ---
function stateToRows(st){
  const rows = {};
  const put = (id, kind, data, ord) => { rows[id] = {id, kind, data, ord}; };
  put('meta/main', 'meta', st.meta || {}, 0);
  put('settings/main', 'settings', st.settings || {}, 0);
  (st.products||[]).forEach((p,i)   => put('product/'+p.id,   'product',   p, i));
  (st.recipes||[]).forEach((r,i)    => put('recipe/'+r.id,    'recipe',    r, i));
  (st.inventories||[]).forEach((v,i)=> put('inventory/'+v.id, 'inventory', v, i));
  (st.salesLog||[]).forEach((s,i)   => put('sale/'+s.id,      'sale',      s, i));
  return rows;
}
function rowsToState(rows){
  const st = { meta:{}, settings:{}, products:[], recipes:[], inventories:[], salesLog:[] };
  const buckets = { product:[], recipe:[], inventory:[], sale:[] };
  rows.forEach(r=>{
    if(r.kind==='meta') st.meta = r.data;
    else if(r.kind==='settings') st.settings = r.data;
    else if(buckets[r.kind]) buckets[r.kind].push(r);
  });
  // `ord` conserve l'ordre d'origine : un tri alphabétique sur « p1, p10, p2 »
  // réorganiserait le catalogue à chaque rechargement.
  const byOrd = a => a.sort((x,y)=>(x.ord||0)-(y.ord||0)).map(x=>x.data);
  st.products    = byOrd(buckets.product);
  st.recipes     = byOrd(buckets.recipe);
  st.inventories = byOrd(buckets.inventory);
  st.salesLog    = byOrd(buckets.sale);
  return st;
}
function snapshotOf(rows){
  const snap = {};
  Object.values(rows).forEach(r=>{ snap[r.id] = JSON.stringify(r.data); });
  return snap;
}

// --- Lecture ---
async function loadFromSupabase(){
  const all = [];
  const PAGE = 1000;
  for(let from=0; ; from+=PAGE){
    const { data, error } = await sbTable().select('id,kind,data,ord').range(from, from+PAGE-1);
    if(error) throw error;
    all.push(...data);
    if(data.length < PAGE) break;
  }
  return all;
}
async function loadInitialState(){
  try{
    const rows = await loadFromSupabase();
    if(rows.length){
      const st = rowsToState(rows);
      lastSnapshot = snapshotOf(stateToRows(st));
      try{ localStorage.setItem(CACHE_KEY, JSON.stringify(st)); }catch(e){}
      return st;
    }
    return null;   // base vide : on l'amorcera avec les données de départ
  }catch(err){
    console.error(err);
    // Réseau coupé en plein service : on repart de la dernière copie vue sur cet
    // appareil, en lecture seule, plutôt que d'afficher une page vide.
    try{
      const raw = localStorage.getItem(CACHE_KEY);
      if(raw){ sbReadOnly = true; return JSON.parse(raw); }
    }catch(e){}
    throw err;
  }
}

// --- Écriture ---
function setSaveIndicator(kind, text){
  const el = document.getElementById('save-indicator');
  const t = document.getElementById('save-indicator-text');
  if(!el || !t) return;
  el.className = 'state-' + kind;
  t.textContent = text;
}
function scheduleSave(){
  if(sbReadOnly){ setSaveIndicator('readonly','Hors ligne — modifications non envoyées'); return; }
  setSaveIndicator('pending','Enregistrement…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 900);
}
async function chunkedUpsert(list){
  // Au premier enregistrement, ce sont les 477 produits d'un coup : on découpe,
  // sinon la requête dépasse la taille acceptée et échoue en bloc.
  const SIZE = 150;
  for(let i=0; i<list.length; i+=SIZE){
    const { error } = await sbTable().upsert(list.slice(i, i+SIZE));
    if(error) throw error;
  }
}
async function doSave(){
  if(!sbClient || sbReadOnly) return;
  const rows = stateToRows(state);
  const changed = [];
  Object.values(rows).forEach(r=>{
    const json = JSON.stringify(r.data);
    if(lastSnapshot[r.id] !== json) changed.push(r);
  });
  const removed = Object.keys(lastSnapshot).filter(id => !(id in rows));
  if(!changed.length && !removed.length){
    setSaveIndicator('saved','À jour');
    return;
  }
  try{
    if(changed.length) await chunkedUpsert(changed);
    if(removed.length){
      const { error } = await sbTable().delete().in('id', removed);
      if(error) throw error;
    }
    lastSnapshot = snapshotOf(rows);
    sbIgnoreUntil = Date.now() + 2500;   // nos propres échos ne sont pas des alertes
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(state)); }catch(e){}
    setSaveIndicator('saved','Enregistré ' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
  }catch(err){
    console.error(err);
    setSaveIndicator('error','Échec de l’enregistrement — nouvel essai…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 5000);
  }
}

// --- Amorçage de la base au tout premier lancement ---
async function seedSupabase(st){
  const rows = Object.values(stateToRows(st));
  setSaveIndicator('pending','Première installation : envoi des données…');
  await chunkedUpsert(rows);
  lastSnapshot = snapshotOf(stateToRows(st));
  setSaveIndicator('saved','Données installées');
}

// --- Travail à plusieurs ---
function watchRemoteChanges(){
  sbClient.channel('documents-live')
    .on('postgres_changes', { event:'*', schema:'public', table:'documents' }, ()=>{
      if(Date.now() < sbIgnoreUntil) return;      // c'est nous
      showRemoteBanner();
    })
    .subscribe();
}
// On ne recharge jamais tout seul : quelqu'un peut être en pleine saisie
// d'inventaire. On signale, et c'est la personne qui décide quand recharger.
function showRemoteBanner(){
  if(document.getElementById('remote-banner')) return;
  const b = document.createElement('div');
  b.id = 'remote-banner';
  b.className = 'no-print';
  b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9999;'
    + 'background:var(--paper);border:1px solid var(--border);border-radius:10px;'
    + 'box-shadow:0 6px 24px rgba(0,0,0,.28);padding:10px 14px;display:flex;gap:10px;align-items:center;';
  b.innerHTML = '<span>Un collègue vient de modifier les données.</span>'
    + '<button class="btn btn-sm btn-primary" data-action="reload-shared">Recharger</button>'
    + '<button class="btn btn-ghost btn-sm" data-action="dismiss-remote">Plus tard</button>';
  document.body.appendChild(b);
}

// --- Connexion de l'équipe ---
function loginScreenHTML(message){
  return `<div style="position:fixed;inset:0;z-index:10000;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;">
    <form id="login-form" style="width:100%;max-width:360px;">
      <div style="text-align:center;margin-bottom:22px;">
        <div class="mark" style="font-size:24px;">Livre de Prix</div>
        <div class="sub">Connexion de l’équipe</div>
      </div>
      <div class="field"><label>Adresse e-mail de l’équipe</label>
        <input type="email" name="email" autocomplete="username" required autofocus></div>
      <div class="field"><label>Mot de passe</label>
        <input type="password" name="password" autocomplete="current-password" required></div>
      ${message ? `<div class="hint" style="color:var(--critical);margin:6px 0;">${esc(message)}</div>` : ''}
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px;">Ouvrir le livre de prix</button>
      <div class="hint" style="margin-top:14px;text-align:center;">Un seul identifiant pour toute l’équipe. Demandez-le au responsable.</div>
    </form>
  </div>`;
}
function askLogin(message){
  return new Promise(resolve=>{
    const root = document.getElementById('overlay-root');
    root.innerHTML = loginScreenHTML(message);
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Connexion…';
      const fd = new FormData(form);
      const { error } = await sbClient.auth.signInWithPassword({
        email: String(fd.get('email')).trim(),
        password: String(fd.get('password')),
      });
      if(error){
        // Un serveur injoignable et un mot de passe faux ne se corrigent pas de la
        // même façon : confondre les deux ferait chercher au mauvais endroit.
        const refus = error.status && error.status >= 400 && error.status < 500;
        root.innerHTML = '';
        resolve(await askLogin(refus
          ? 'Identifiant ou mot de passe incorrect.'
          : 'Impossible de joindre le serveur. Vérifiez la connexion internet, puis réessayez.'));
        return;
      }
      root.innerHTML = '';
      resolve(true);
    });
  });
}
async function ensureSignedIn(){
  const { data } = await sbClient.auth.getSession();
  if(data && data.session) return true;
  return await askLogin('');
}

// Sauvegarde de secours : un fichier qu'on garde de côté avant une grosse
// opération, et qui permet de repartir si quelque chose tourne mal.
function exportBackup(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `livre-de-prix-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
