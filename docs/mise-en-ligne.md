# Mettre le Livre de Prix en ligne

Objectif : une adresse internet que toute l'équipe ouvre, avec **les mêmes
données pour tout le monde**, mises à jour en direct.

**Ton temps total : environ 35 minutes**, en cinq étapes. Aucune connaissance
technique n'est nécessaire — il s'agit de créer deux comptes gratuits, de
copier-coller un texte, et de déposer un fichier.

---

## Pourquoi deux services

| Service | À quoi il sert | Coût |
|---|---|---|
| **Supabase** | Garde les données, et vérifie le mot de passe de l'équipe | Gratuit à votre volume |
| **Cloudflare Pages** | Héberge la page elle-même, pour qu'elle ait une adresse | Gratuit |

L'un sans l'autre ne suffit pas : Cloudflare sert la page, Supabase garde ce
que vous y saisissez.

---

## Étape 1 — Créer le projet Supabase *(10 min)*

1. Va sur **supabase.com**, clique **Start your project**, crée un compte
   (une adresse e-mail suffit).
2. Clique **New project**.
3. Renseigne :
   - **Name** : `livre-de-prix-bivouak`
   - **Database Password** : un mot de passe long, **note-le de côté**. Ce
     n'est pas celui de l'équipe, c'est celui de la base — tu ne t'en
     serviras quasiment jamais, mais il est impossible à récupérer.
   - **Region** : choisis l'Europe (Frankfurt ou Paris), pour que l'appli
     réponde vite depuis le restaurant.
4. Clique **Create new project** et laisse tourner deux minutes.

---

## Étape 2 — Préparer la base *(2 min)*

1. Dans le menu de gauche, ouvre **SQL Editor**.
2. Clique **New query**.
3. Ouvre le fichier [`supabase-schema.sql`](supabase-schema.sql) de ce
   dossier, copie **tout** son contenu, colle-le dans la fenêtre.
4. Clique **Run** (ou Ctrl+Entrée).

Tu dois voir *Success. No rows returned*. C'est le résultat attendu : le
script crée des tables, il n'affiche rien.

---

## Étape 3 — Créer l'identifiant de l'équipe *(3 min)*

Un seul compte pour tout le monde, affiché en cuisine.

1. Menu **Authentication** → onglet **Users**.
2. Bouton **Add user** → **Create new user**.
3. Renseigne :
   - **Email** : par exemple `equipe@bivouak.fr` *(l'adresse n'a pas besoin
     d'exister réellement)*
   - **Password** : un mot de passe simple à dicter mais pas évident à
     deviner. Évite `bivouak` ou `123456`.
   - Coche **Auto Confirm User** — sinon Supabase attendrait une
     confirmation par e-mail qui n'arrivera jamais.
4. **Create user**.

> ⚠️ Ce mot de passe donne accès à tous vos prix et marges. Il s'affiche en
> cuisine, pas sur les réseaux, et il se change le jour où quelqu'un quitte
> l'équipe (même écran, bouton **Reset password**).

---

## Étape 4 — Me transmettre deux valeurs *(2 min)*

1. Menu **Project Settings** (la roue dentée) → **API**.
2. Copie :
   - **Project URL** — ressemble à `https://abcdefgh.supabase.co`
   - La clé **`anon` / `public`** — un long texte commençant par `eyJ...`

Envoie-moi ces deux valeurs. Elles sont **publiques par conception** : elles
sont faites pour figurer dans la page, et ne donnent aucun accès sans le mot
de passe de l'équipe.

> 🚫 **Ne transmets jamais la clé `service_role`**, sur la même page, marquée
> *secret*. Celle-là contourne toutes les protections.

Je te renvoie alors le fichier `index.html` prêt à déposer.

---

## Étape 5 — Mettre la page en ligne *(15 min)*

1. Va sur **pages.cloudflare.com**, crée un compte gratuit.
2. **Create a project** → **Upload assets** (et non « Connect to Git »).
3. Nomme le projet `livre-de-prix-bivouak`.
4. Fais glisser le fichier `index.html` que je t'aurai renvoyé.
5. **Deploy site**.

Tu obtiens une adresse du type
`https://livre-de-prix-bivouak.pages.dev`. C'est elle que l'équipe met en
favori.

**La première ouverture prend une minute** : l'appli installe les 477 produits
et les 86 fiches dans la base. Les fois suivantes sont instantanées.

---

## Ensuite

**Mettre l'appli à jour** — quand je fais évoluer le code, je te renvoie un
nouveau `index.html`, tu retournes sur Cloudflare Pages → **Create new
deployment** → tu déposes le fichier. Les données ne bougent pas : elles
vivent dans Supabase, pas dans la page.

**Si le wifi tombe en plein service** — l'appli affiche la dernière version
vue sur l'appareil, en lecture seule, et l'indique clairement. On peut
consulter une fiche, mais pas saisir. Le fichier
`livre-de-prix-hors-ligne.html` reste le vrai filet de secours : garde-le sur
la tablette.

**Sauvegardes** — écran **Réglages** → **Exporter une sauvegarde**. À faire
avant chaque grosse opération (inventaire, reprise de fiches).

---

## En cas de problème

| Ce que tu vois | Ce que ça veut dire |
|---|---|
| *Application non configurée* | Le fichier a été construit sans les deux valeurs de l'étape 4 — redonne-les moi |
| *Identifiant ou mot de passe incorrect* | Le mot de passe d'équipe est faux, ou l'option **Auto Confirm User** a été oubliée à l'étape 3 |
| *Impossible de joindre le serveur* | Problème de connexion internet, ou projet Supabase en pause (les projets gratuits s'endorment après une semaine sans usage — il suffit de le rouvrir sur supabase.com) |
| *Connexion impossible* après avoir saisi le mot de passe | Le script SQL de l'étape 2 n'a pas été exécuté |
