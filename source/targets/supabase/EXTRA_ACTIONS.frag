  if(a==='reload-shared') return location.reload();
  if(a==='dismiss-remote'){ const b=document.getElementById('remote-banner'); if(b) b.remove(); return; }
  if(a==='sign-out'){
    if(!confirm('Se déconnecter ? Il faudra saisir à nouveau l’identifiant de l’équipe.')) return;
    sbClient.auth.signOut().then(()=>location.reload());
    return;
  }
  if(a==='export-backup') return exportBackup();
  if(a==='import-backup') return importBackup();