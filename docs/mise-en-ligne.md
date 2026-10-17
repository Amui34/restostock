# RestoStock — mise en ligne et exploitation

Objectif : une adresse que toute l'équipe ouvre, avec **les mêmes données pour
tout le monde**, mises à jour en direct, et où **chacun ne voit que ce que son
rôle autorise** (patron · manager · employé).

> Mis à jour le 2026-10-17 — remplace l'ancienne procédure « Cloudflare Pages +
> compte d'équipe unique », qui ne correspond plus ni à l'application ni au
> déploiement réel.

---

## Comment ça tient ensemble

| Brique | Rôle | Où |
|---|---|---|
| **Supabase** | Base de données, comptes utilisateurs, règles d'accès (RLS), temps réel | Projet **Restostock**, organisation **Amui studio** |
| **Serveur OVH** | Sert la page (`app/`) via Caddy, derrière le proxy partagé `amui-proxy` qui gère le HTTPS | Conteneur Docker `restostock` |
| **GitHub Actions** | Déploie automatiquement sur le serveur à chaque `push` sur `main` | `.github/workflows/main.yaml` |

La page ne contient **aucune donnée** : tout vit dans Supabase. Redéployer la
page ne touche jamais aux données.

---

## 1. Supabase

### Le projet
- Organisation **Amui studio** → projet **Restostock** (`iuzmerktgvgskhsojdha`,
  `https://iuzmerktgvgskhsojdha.supabase.co`), région eu-west-1.
- L'ancien projet (`fimkglvsbwxyxevlxiny`, autre organisation) est abandonné
  depuis le 2026-10-17 ; ses données n'ont pas été reprises (décision d'équipe).

### Le schéma (tables, rôles, cloisonnement, temps réel)
Tout est dans [`supabase-schema.sql`](supabase-schema.sql). Il est
**idempotent** : on peut le rejouer sans rien casser, et il **refuse** de
supprimer la table `documents` si elle contient des données.

Pour l'appliquer (projet neuf ou mise à jour du schéma) :
1. Supabase → **SQL Editor** → **New query**.
2. Coller tout le contenu de `supabase-schema.sql` → **Run** (⌘↵).
3. Supabase affiche « Potential issue detected » à cause des `drop policy if
   exists` : c'est attendu, cliquer **Run query**.
4. Résultat attendu : *Success. No rows returned*.

Ce que le schéma garantit, côté base (pas côté page — un employé qui
bidouillerait la page ne verrait pas un prix de plus) :
- chaque entreprise est cloisonnée (`company_id`) ;
- l'employé ne lit pas les prix, ventes, réglages ; il écrit le stock et les
  inventaires en cours ; le manager tout sauf les réglages et les inventaires
  validés ; le patron tout ;
- temps réel sur `documents` avec `REPLICA IDENTITY FULL` (indispensable pour
  que les modifications/suppressions des collègues se propagent).

### Les comptes
Plus de compte d'équipe unique : **chacun s'inscrit depuis l'application**
(e-mail + mot de passe). Le patron crée son entreprise ; les autres la
rejoignent avec le **code à 6 caractères** affiché dans son écran Équipe, et
arrivent en « employé » (le patron les promeut ensuite). Personne ne
s'auto-promeut.

**Confirmation d'e-mail** — réglage *Authentication → Sign In / Providers →
Confirm email*. État actuel : **activé** (l'utilisateur doit cliquer le lien
reçu avant de pouvoir se connecter). Deux conséquences à connaître :
- l'application affiche « compte créé, vérifie ta boîte mail » à l'inscription ;
- le SMTP fourni par défaut par Supabase est **limité à quelques e-mails par
  heure** pour tout le projet : au-delà, les nouveaux inscrits ne reçoivent
  rien. Pour un usage réel, brancher un SMTP personnalisé (*Authentication →
  Emails → SMTP Settings* ; Resend, Brevo… gratuits à ce volume) **ou**
  désactiver « Confirm email » (le code d'entreprise reste alors la barrière
  d'accès).

---

## 2. Brancher la page sur le projet

Les deux valeurs publiques du projet (Supabase → *Settings → API Keys*) :
- **Project URL** : `https://….supabase.co`
- **Publishable key** : `sb_publishable_…` (onglet « Publishable and secret API
  keys »)

Elles vivent dans **un seul fichier** : [`data/supabase.json`](../data/supabase.json).
La page est ensuite **générée** — ne pas modifier `app/app/index.html` à la main :

```bash
python3 source/build.py
```

`build.py` injecte URL et clé dans `app/app/index.html` (et régénère la vitrine
et les fichiers hors-ligne). Puis commit.

> 🚫 **Jamais la clé `secret` / `service_role`** dans le dépôt, dans la page ou
> dans un message : elle contourne toutes les protections. Les clés
> *publishable* sont faites pour être publiques et ne donnent rien sans compte.

---

## 3. Déployer sur le serveur OVH

**Automatique** : tout `git push` sur `main` déclenche le workflow *Deploy*
([`.github/workflows/main.yaml`](../.github/workflows/main.yaml)), qui se
connecte au serveur en SSH et exécute :

```
git fetch --all --prune && git reset --hard origin/main
docker compose -f compose.proxy.yaml up -d --build --remove-orphans
docker image prune -f
```

Suivre l'exécution : GitHub → onglet **Actions**. Un run vert = la nouvelle
page est servie. Lancement manuel possible : *Actions → Deploy → Run workflow*.

Secrets attendus côté GitHub (*Settings → Secrets → Actions*) :
`DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_SSH_PORT`
(défaut 22), `DEPLOY_PATH` (clone du dépôt sur le serveur),
`DEPLOY_COMPOSE_FILE` (défaut `compose.proxy.yaml`).

Le conteneur est un Caddy qui sert `app/` en HTTP interne (port 80) ; le HTTPS
et le nom de domaine sont portés par le proxy partagé `amui-proxy`.

**En local** (sans proxy) : `docker compose up -d --build` → http://localhost:8092

---

## Au quotidien

- **Mettre l'appli à jour** : modifier `source/`, `python3 source/build.py`,
  commit, push → déployé en ~1 min. Les données ne bougent pas.
- **Changer de projet Supabase** : éditer `data/supabase.json`, rejouer le
  schéma sur le nouveau projet, `build.py`, commit, push.
- **Si le wifi tombe** : l'appli affiche la dernière version vue, en lecture
  seule, et l'indique. `livre-de-prix-hors-ligne.html` reste le filet de
  secours à garder sur la tablette.
- **Sauvegardes** : écran **Réglages → Exporter une sauvegarde**, avant toute
  grosse opération (inventaire, reprise de fiches).
- **Projet gratuit en pause** : Supabase endort les projets gratuits après une
  semaine sans usage — le rouvrir sur supabase.com suffit.

---

## En cas de problème

| Ce que tu vois | Ce que ça veut dire |
|---|---|
| *Application non configurée* | `data/supabase.json` absent ou incomplet au moment du `build.py` |
| *Compte créé, vérifie ta boîte mail* mais rien n'arrive | Quota du SMTP par défaut atteint → SMTP personnalisé, ou désactiver « Confirm email » |
| *Email not confirmed* à la connexion | Le lien de confirmation n'a pas été cliqué |
| *Impossible de joindre le serveur* | Internet, ou projet Supabase en pause |
| *Code invalide* | Le code d'entreprise est faux (6 caractères, insensible à la casse) |
| La page ne change pas après un push | Regarder le run **Actions** : secrets manquants ou serveur injoignable |
| Les modifs d'un collègue n'apparaissent pas sans recharger | Rejouer le schéma : la publication temps réel ou `REPLICA IDENTITY FULL` manque |
