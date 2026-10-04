async function boot(){
  if(!SUPABASE_URL || SUPABASE_URL.indexOf('__') === 0){
    document.getElementById('app').innerHTML =
      '<div class="card empty"><div class="big">⚙</div><h3>Application non configurée</h3>'
      + '<p>L’adresse de la base de données n’a pas été renseignée au moment de la construction du fichier.</p></div>';
    return;
  }
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Posé avant toute autre chose : quelqu'un qui arrive par le lien « mot de
  // passe oublié » doit tomber sur le choix du nouveau mot de passe, pas sur
  // l'application — il entrerait sans jamais avoir pu le changer.
  watchPasswordRecovery();

  await ensureSignedIn();     // qui êtes-vous ?
  await ensureCompany();      // dans quel établissement ?

  let loaded = null;
  try{
    loaded = await loadInitialState();
  }catch(err){
    console.error(err);
    document.getElementById('app').innerHTML =
      '<div class="card empty"><div class="big">⚠</div><h3>Connexion impossible</h3>'
      + '<p>Impossible de joindre la base de données. Vérifiez la connexion internet, puis rechargez la page.</p></div>';
    setSaveIndicator('error','Hors ligne');
    return;
  }

  // Un établissement qui s'inscrit démarre SUR SA PROPRE PAGE BLANCHE. Lui
  // installer les produits d'un autre restaurant l'obligerait à tout effacer
  // avant de commencer — et alourdirait le fichier de 534 Ko pour rien.
  const premierLancement = !loaded;
  state = loaded || { meta:{}, settings:{}, products:[], recipes:[], inventories:[], salesLog:[] };
  migrateState();
  // Le nom saisi à la création de l'établissement fait foi.
  if(sbCompany && sbCompany.name) state.settings.establishment_name = sbCompany.name;

  if(premierLancement && !sbReadOnly){
    try{ await seedSupabase(state); }
    catch(err){ console.error(err); setSaveIndicator('error','Installation incomplète — rechargez la page'); }
  } else if(sbReadOnly){
    setSaveIndicator('readonly','Hors ligne — dernière copie de cet appareil');
  } else {
    setSaveIndicator('saved','À jour');
  }

  if(!sbReadOnly) watchRemoteChanges();

  const start = hashToView();
  if(start){ ui.view = start.view; ui.id = start.id; }
  render();
  if(needsOnboarding()) showOnboarding(0);
}
