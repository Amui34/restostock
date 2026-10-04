  if(t.matches('[data-onchange="teamRole"]')){
    // On remet la valeur affichée telle quelle : c'est le rechargement de
    // l'équipe, une fois la base d'accord, qui fera foi. Sans ça, un refus
    // laisserait un rôle à l'écran que personne n'a réellement.
    const uid = t.dataset.uid, role = t.value;
    t.disabled = true;
    setMemberRole(uid, role).finally(()=>{ t.disabled = false; render(); });
    return;
  }
