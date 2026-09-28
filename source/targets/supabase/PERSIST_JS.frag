/* ================= Sauvegarde partagée (Supabase) =================
   Chaque entreprise a son espace, chaque personne son rôle.

   Deux principes gouvernent ce fichier :

   1. UNE LIGNE PAR OBJET. Un produit, une fiche, un inventaire sont des
      lignes distinctes. C'est ce qui permet à deux personnes de saisir en
      même temps sans s'écraser, et on n'envoie que ce qui a changé.

   2. LES PRIX VIVENT À PART. L'historique fournisseur quitte la fiche
      produit pour sa propre ligne, de type « price ». La base refuse de la
      servir à un équipier. Sans cette séparation, masquer les prix ne
      serait qu'un habillage : les données partiraient quand même dans la
      page, et la console du navigateur suffirait à les lire. */

function sbTable(){ return sbClient.from('documents'); }

/* ---- Conversion entre l'état de l'appli et les lignes de la base ---- */
function stateToRows(st){
  const rows = {};
  const cid = sbCompany.id;
  const put = (id, kind, data, ord) => { rows[id] = {company_id:cid, id, kind, data, ord}; };
  put('meta/main', 'meta', st.meta || {}, 0);
  put('settings/main', 'settings', st.settings || {}, 0);
  (st.products||[]).forEach((p,i)=>{
    const { suppliers, primary_supplier_id, ...sansPrix } = p;
    put('product/'+p.id, 'product', sansPrix, i);
    put('price/'+p.id,   'price',   { suppliers: suppliers||[], primary_supplier_id: primary_supplier_id||null }, i);
  });
  (st.recipes||[]).forEach((r,i)    => put('recipe/'+r.id,    'recipe',    r, i));
  (st.inventories||[]).forEach((v,i)=> put('inventory/'+v.id, 'inventory', v, i));
  (st.salesLog||[]).forEach((s,i)   => put('sale/'+s.id,      'sale',      s, i));
  return rows;
}
function rowsToState(rows){
  const st = { meta:{}, settings:{}, products:[], recipes:[], inventories:[], salesLog:[] };
  const buckets = { product:[], recipe:[], inventory:[], sale:[] };
  const prices = {};
  rows.forEach(r=>{
    if(r.kind==='meta') st.meta = r.data;
    else if(r.kind==='settings') st.settings = r.data;
    else if(r.kind==='price') prices[r.id.slice('price/'.length)] = r.data;
    else if(buckets[r.kind]) buckets[r.kind].push(r);
  });
  // `ord` conserve l'ordre d'origine : un tri alphabétique sur « p1, p10, p2 »
  // réorganiserait le catalogue à chaque rechargement.
  const byOrd = a => a.sort((x,y)=>(x.ord||0)-(y.ord||0)).map(x=>x.data);
  st.recipes     = byOrd(buckets.recipe);
  st.inventories = byOrd(buckets.inventory);
  st.salesLog    = byOrd(buckets.sale);
  st.products    = byOrd(buckets.product).map(p=>{
    const px = prices[p.id];
    // Pas de ligne de prix = équipier : le produit arrive sans historique, et
    // toute l'appli affiche « — » au lieu d'un coût. C'est voulu.
    return px ? Object.assign({}, p, px) : p;
  });
  return st;
}
function snapshotOf(rows){
  const snap = {};
  Object.values(rows).forEach(r=>{ snap[r.id] = JSON.stringify(r.data); });
  return snap;
}

/* ---- Lecture ---- */
async function loadFromSupabase(){
  const all = [];
  const PAGE = 1000;
  for(let from=0; ; from+=PAGE){
    const { data, error } = await sbTable()
      .select('id,kind,data,ord')
      .eq('company_id', sbCompany.id)
      .range(from, from+PAGE-1);
    if(error) throw error;
    all.push(...data);
    if(data.length < PAGE) break;
  }
  return all;
}
function cacheKey(){ return CACHE_PREFIX + (sbCompany ? sbCompany.id : 'anon'); }
async function loadInitialState(){
  try{
    const rows = await loadFromSupabase();
    if(rows.length){
      const st = rowsToState(rows);
      lastSnapshot = snapshotOf(stateToRows(st));
      try{ localStorage.setItem(cacheKey(), JSON.stringify(st)); }catch(e){}
      return st;
    }
    return null;   // espace vide : l'entreprise démarre de zéro
  }catch(err){
    console.error(err);
    // Réseau coupé en plein service : on repart de la dernière copie vue sur
    // cet appareil, en lecture seule, plutôt que d'afficher une page vide.
    try{
      const raw = localStorage.getItem(cacheKey());
      if(raw){ sbReadOnly = true; return JSON.parse(raw); }
    }catch(e){}
    throw err;
  }
}

/* ---- Écriture ---- */
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
  // Au premier enregistrement ce sont des centaines de lignes d'un coup : on
  // découpe, sinon la requête dépasse la taille acceptée et échoue en bloc.
  const SIZE = 150;
  for(let i=0; i<list.length; i+=SIZE){
    const { error } = await sbTable().upsert(list.slice(i, i+SIZE));
    if(error) throw error;
  }
}
async function doSave(){
  if(!sbClient || !sbCompany || sbReadOnly) return;
  const rows = stateToRows(state);
  const changed = [];
  Object.values(rows).forEach(r=>{
    const json = JSON.stringify(r.data);
    if(lastSnapshot[r.id] !== json) changed.push(r);
  });
  const removed = Object.keys(lastSnapshot).filter(id => !(id in rows));
  if(!changed.length && !removed.length){ setSaveIndicator('saved','À jour'); return; }
  try{
    if(changed.length) await chunkedUpsert(changed);
    if(removed.length){
      const { error } = await sbTable().delete().eq('company_id', sbCompany.id).in('id', removed);
      if(error) throw error;
    }
    lastSnapshot = snapshotOf(rows);
    sbIgnoreUntil = Date.now() + 2500;   // nos propres échos ne sont pas des alertes
    try{ localStorage.setItem(cacheKey(), JSON.stringify(state)); }catch(e){}
    setSaveIndicator('saved','Enregistré ' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
  }catch(err){
    console.error(err);
    // Un refus de la base n'est pas une panne : c'est le rôle qui ne permet pas
    // ce geste. Réessayer en boucle ne ferait que masquer le vrai message.
    const refus = err && (err.code === '42501' || /row-level security/i.test(err.message||''));
    if(refus){ setSaveIndicator('error','Votre rôle ne permet pas cette modification'); return; }
    setSaveIndicator('error','Échec de l’enregistrement — nouvel essai…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 5000);
  }
}

/* ---- Premier remplissage d'un espace vide ---- */
async function seedSupabase(st){
  setSaveIndicator('pending','Installation des données…');
  await chunkedUpsert(Object.values(stateToRows(st)));
  lastSnapshot = snapshotOf(stateToRows(st));
  setSaveIndicator('saved','Données installées');
}

/* ---- Travail à plusieurs ---- */
function watchRemoteChanges(){
  sbClient.channel('documents-' + sbCompany.id)
    .on('postgres_changes',
        { event:'*', schema:'public', table:'documents', filter:'company_id=eq.'+sbCompany.id },
        ()=>{ if(Date.now() >= sbIgnoreUntil) showRemoteBanner(); })
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

/* ================= Comptes, établissements, rôles ================= */
const ROLE_LABELS = { patron:'Responsable', manager:'Chef', employe:'Équipier' };

function authShellHTML(inner){
  return `<div style="position:fixed;inset:0;z-index:10000;background:var(--paper);overflow-y:auto;display:flex;align-items:center;justify-content:center;padding:24px;">
    <div style="width:100%;max-width:400px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-family:var(--font-display);font-weight:700;font-size:26px;">RestoStock</div>
      </div>
      ${inner}
    </div>
  </div>`;
}
function authError(msg){
  return msg ? `<div class="hint" style="color:var(--critical);margin:8px 0;">${esc(msg)}</div>` : '';
}
function showAuth(html){ document.getElementById('overlay-root').innerHTML = html; }

// Les messages de Supabase arrivent en anglais et sans contexte : on les traduit
// en quelque chose qu'un cuisinier puisse comprendre et corriger.
function authMessage(error){
  const m = ((error && error.message) || '').toLowerCase();
  if(m.includes('invalid login')) return 'Adresse e-mail ou mot de passe incorrect.';
  if(m.includes('already registered')) return 'Un compte existe déjà avec cette adresse. Connectez-vous.';
  if(m.includes('password')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if(m.includes('fetch') || m.includes('network')) return 'Serveur injoignable. Vérifiez la connexion internet.';
  return (error && error.message) ? error.message : 'Une erreur est survenue.';
}

function signInHTML(mode, message){
  const inscription = mode === 'signup';
  return authShellHTML(`
    <form id="auth-form">
      <h2 style="font-family:var(--font-display);font-size:23px;margin-bottom:6px;">
        ${inscription ? 'Créer votre compte' : 'Se connecter'}</h2>
      <p style="color:var(--ink-muted);margin-bottom:20px;font-size:14.5px;">
        ${inscription ? 'Chaque personne a son propre compte : c’est lui qui porte ses droits.'
                      : 'Avec votre adresse e-mail personnelle.'}</p>
      ${inscription ? `<div class="field"><label>Votre nom</label>
        <input type="text" name="fullname" autocomplete="name" required></div>` : ''}
      <div class="field"><label>Adresse e-mail</label>
        <input type="email" name="email" autocomplete="username" required></div>
      <div class="field"><label>Mot de passe</label>
        <input type="password" name="password" autocomplete="${inscription?'new-password':'current-password'}" required minlength="6"></div>
      ${authError(message)}
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:14px;">
        ${inscription ? 'Créer mon compte' : 'Entrer'}</button>
      <button type="button" class="btn btn-ghost" style="width:100%;margin-top:8px;" id="auth-toggle">
        ${inscription ? 'J’ai déjà un compte' : 'Créer un compte'}</button>
    </form>`);
}

function companyChoiceHTML(message){
  return authShellHTML(`
    <form id="company-form">
      <h2 style="font-family:var(--font-display);font-size:23px;margin-bottom:6px;">Votre établissement</h2>
      <p style="color:var(--ink-muted);margin-bottom:20px;font-size:14.5px;">
        Créez-le si vous êtes responsable, ou rejoignez celui de votre équipe avec le code qu’on vous a donné.</p>
      <div class="field"><label>Créer un établissement</label>
        <input type="text" name="newname" placeholder="Ex : Le Comptoir du Marché"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;" value="create" name="choix">Créer</button>
      <hr class="hairline" style="margin:22px 0;">
      <div class="field"><label>Rejoindre avec un code</label>
        <input type="text" name="code" placeholder="Ex : A3F9K2" style="text-transform:uppercase;"></div>
      <button type="submit" class="btn" style="width:100%;margin-top:8px;" value="join" name="choix">Rejoindre</button>
      ${authError(message)}
      <button type="button" class="btn btn-ghost" style="width:100%;margin-top:18px;" data-action="sign-out">Changer de compte</button>
    </form>`);
}

function companyPickHTML(list){
  return authShellHTML(`
    <h2 style="font-family:var(--font-display);font-size:23px;margin-bottom:16px;">Quel établissement ?</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${list.map(c=>`<button type="button" class="btn" style="width:100%;justify-content:space-between;"
        data-action="pick-company" data-id="${esc(c.company_id)}">
        <span>${esc(c.company_name)}</span>
        <span class="hint">${esc(ROLE_LABELS[c.role]||c.role)}</span></button>`).join('')}
    </div>
    <button type="button" class="btn btn-ghost" style="width:100%;margin-top:18px;" data-action="sign-out">Changer de compte</button>`);
}

async function ensureSignedIn(){
  const { data } = await sbClient.auth.getSession();
  if(data && data.session) return true;
  return new Promise(resolve=>{
    let mode = 'signin';
    const render = msg => {
      showAuth(signInHTML(mode, msg));
      document.getElementById('auth-form').addEventListener('submit', async e=>{
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Un instant…';
        const fd = new FormData(form);
        const email = String(fd.get('email')).trim();
        const password = String(fd.get('password'));
        const res = mode === 'signup'
          ? await sbClient.auth.signUp({ email, password,
              options:{ data:{ full_name: String(fd.get('fullname')||'').trim() } } })
          : await sbClient.auth.signInWithPassword({ email, password });
        if(res.error){ render(authMessage(res.error)); return; }
        // Sans session après inscription, c'est que la confirmation par e-mail
        // est exigée : on le dit, au lieu de laisser un écran muet.
        if(mode === 'signup' && res.data && !res.data.session){
          mode = 'signin';
          render('Compte créé. Confirmez votre adresse par e-mail, puis connectez-vous.');
          return;
        }
        document.getElementById('overlay-root').innerHTML = '';
        resolve(true);
      });
      const toggle = document.getElementById('auth-toggle');
      if(toggle) toggle.addEventListener('click', ()=>{ mode = (mode==='signup'?'signin':'signup'); render(''); });
    };
    render('');
  });
}

async function myCompanies(){
  const { data, error } = await sbClient.rpc('my_companies');
  if(error) throw error;
  return data || [];
}

async function ensureCompany(){
  const list = await myCompanies();

  if(list.length === 1){ sbCompany = normCompany(list[0]); return; }

  if(list.length > 1){
    const saved = localStorage.getItem('restostock_company');
    const known = list.find(c=>c.company_id === saved);
    if(known){ sbCompany = normCompany(known); return; }
    sbCompany = await new Promise(resolve=>{
      showAuth(companyPickHTML(list));
      document.getElementById('overlay-root').addEventListener('click', e=>{
        const b = e.target.closest('[data-action="pick-company"]');
        if(!b) return;
        const choisi = list.find(c=>c.company_id === b.dataset.id);
        localStorage.setItem('restostock_company', choisi.company_id);
        document.getElementById('overlay-root').innerHTML = '';
        resolve(normCompany(choisi));
      });
    });
    return;
  }

  // Aucun établissement : on en crée un, ou on rejoint celui d'un collègue.
  sbCompany = await new Promise(resolve=>{
    const render = msg => {
      showAuth(companyChoiceHTML(msg));
      document.getElementById('company-form').addEventListener('submit', async e=>{
        e.preventDefault();
        const form = e.target;
        const choix = (e.submitter && e.submitter.value) || 'create';
        const fd = new FormData(form);
        const nom  = String(fd.get('newname')||'').trim();
        const code = String(fd.get('code')||'').trim();
        try{
          if(choix === 'create'){
            if(!nom){ render('Donnez un nom à votre établissement.'); return; }
            const { error } = await sbClient.rpc('create_company', { company_name: nom });
            if(error) throw error;
          } else {
            if(!code){ render('Saisissez le code reçu.'); return; }
            const { error } = await sbClient.rpc('join_company', { code });
            if(error) throw error;
          }
          const maj = await myCompanies();
          document.getElementById('overlay-root').innerHTML = '';
          resolve(normCompany(maj[maj.length-1]));
        }catch(err){
          render(/invalide/i.test(err.message||'')
            ? 'Ce code ne correspond à aucun établissement.'
            : authMessage(err));
        }
      });
    };
    render('');
  });
}

function normCompany(c){
  return { id: c.company_id, name: c.company_name, role: c.role, join_code: c.join_code };
}

/* Ce que le rôle autorise, côté interface. La base applique exactement les
   mêmes règles : ceci ne sert qu'à ne pas proposer un bouton qui échouerait. */
function myRole(){ return sbCompany ? sbCompany.role : null; }
function canSeeMoney(){ const r = myRole(); return r === 'patron' || r === 'manager'; }
function canEditRecipes(){ const r = myRole(); return r === 'patron' || r === 'manager'; }
function canEditSettings(){ return myRole() === 'patron'; }

function exportBackup(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `restostock-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
