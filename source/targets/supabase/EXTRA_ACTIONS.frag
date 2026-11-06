  if(a==='reload-shared') return location.reload();
  if(a==='dismiss-remote'){ const b=document.getElementById('remote-banner'); if(b) b.remove(); return; }
  if(a==='sign-out'){
    if(!confirm('Se déconnecter ? Il faudra saisir à nouveau l’identifiant de l’équipe.')) return;
    sbClient.auth.signOut().then(()=>location.reload());
    return;
  }
  if(a==='export-backup') return exportBackup();
  if(a==='import-backup') return importBackup();
  if(a==='team-remove') return removeMember(act.dataset.uid);
  if(a==='team-retry'){ sbTeamError = null; sbMembers = null; render(); return; }
  if(a==='leave-company')  return leaveCompany();
  if(a==='delete-company') return deleteCompany();
  if(a==='delete-account') return deleteMyAccount();
  if(a==='change-password') return changeMyPassword();
