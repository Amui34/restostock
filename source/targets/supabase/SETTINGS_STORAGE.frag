    <hr class="hairline">
    <div class="field">
      <label>Mon compte</label>
      <div class="hint">Qui vous êtes pour l’application, et ce que votre rôle vous permet.</div>
      <div class="fiche-metrics" style="margin-top:8px;">
        <div class="metric-box"><div class="l">Nom</div>
          <div class="v" style="font-family:var(--font-body);font-size:15px;">${esc(currentUserName() || '—')}</div></div>
        <div class="metric-box"><div class="l">Adresse e-mail</div>
          <div class="v" style="font-family:var(--font-body);font-size:15px;word-break:break-all;">${esc(myEmail() || '—')}</div></div>
        <div class="metric-box"><div class="l">Établissement</div>
          <div class="v" style="font-family:var(--font-body);font-size:15px;">${esc(sbCompany ? sbCompany.name : '—')}</div></div>
        <div class="metric-box"><div class="l">Mon rôle</div>
          <div class="v" style="font-family:var(--font-body);font-size:15px;">${esc(ROLE_LABELS[myRole()] || '—')}</div></div>
      </div>
      <div class="hint" style="margin-top:8px;">${esc(ROLE_EXPLAIN[myRole()] || '')}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button type="button" class="btn" data-action="change-password">${ico('lock')} Changer mon mot de passe</button>
      </div>
    </div>
    <hr class="hairline">
    <div class="field">
      <label>Données de l’équipe</label>
      <div class="hint">Tout le monde voit les mêmes données, mises à jour en direct. Une sauvegarde de secours reste utile avant une grosse opération (inventaire, reprise de fiches).</div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
        <button type="button" class="btn" data-action="export-backup">${ico('download')} Exporter une sauvegarde (.json)</button>
        ${canEditSettings() ? `<button type="button" class="btn" data-action="import-backup">${ico('upload')} Importer une sauvegarde (.json)</button>` : ''}
        <button type="button" class="btn btn-ghost" data-action="sign-out">Se déconnecter</button>
      </div>
      ${canEditSettings() ? `<div class="hint" style="margin-top:6px;">L’import remplace tout le contenu de l’espace. Pratique pour reprendre un catalogue existant ou essayer l’outil avec un jeu de données complet.</div>` : ''}
    </div>
    ${state.meta && state.meta.source ? `<hr class="hairline">
    <div class="field">
      <div class="hint">Source d’import initial : ${esc(state.meta.source)}${state.meta.imported_at ? ` — importé le ${fmtDate(state.meta.imported_at)}` : ''}.</div>
    </div>` : ''}
    <hr class="hairline">
    <div class="field">
      <label style="color:var(--critical);">S’en aller</label>
      <div class="hint">Ces actions sont définitives : il n’y a pas de corbeille, et rien n’est conservé.
        Pensez à exporter une sauvegarde avant.</div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <button type="button" class="btn btn-ghost" data-action="leave-company">Quitter ${esc(sbCompany ? sbCompany.name : 'cet établissement')}</button>
        ${canEditSettings() ? `<button type="button" class="btn btn-ghost" style="color:var(--critical);" data-action="delete-company">Supprimer l’établissement</button>` : ''}
        <button type="button" class="btn btn-ghost" style="color:var(--critical);" data-action="delete-account">Supprimer mon compte</button>
      </div>
    </div>
