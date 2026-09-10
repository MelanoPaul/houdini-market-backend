# Houdini-Market — Backend Notch Pay Sandbox

Ce dossier contient le petit backend Node.js/Express utilisé par `index_paiement_notchpay.html`.

## 1. Prérequis

Node.js 18 ou plus récent.

## 2. Installation

Dans ce dossier :

```bash
npm install
```

Puis copie `.env.example` vers `.env` et mets ta clé publique Sandbox :

```env
NOTCHPAY_PUBLIC_KEY=pk_test_...
```

Les clés privées/secrètes ne sont volontairement pas mises dans le frontend.

## 3. Lancer

```bash
npm start
```

Puis ouvre :

```text
http://localhost:3000
```

## 4. Test Sandbox

Pour simuler les scénarios Mobile Money, Notch Pay fournit des numéros de test.
Pour un succès MTN Cameroun, la documentation donne par exemple :

`+237670000000`

Pour Orange Cameroun :

`+237690000000`

Les autres suffixes de test permettent de simuler notamment fonds insuffisants, échec, timeout et annulation.

## 5. Flux utilisé

Le backend :

1. initialise `/payments`;
2. traite le paiement avec `/payments/{reference}`;
3. vérifie ensuite `/payments/{reference}`;
4. renvoie uniquement au navigateur l'état du paiement.

Le navigateur ne reçoit jamais la clé secrète du serveur.

## 6. Important pour la production

Le solde affiché dans cette version est un **solde de test local** conservé dans `localStorage`.
Ce n'est pas encore un vrai portefeuille financier.

Avant la production, il faudra :
- enregistrer les paiements dans Firestore/backend ;
- vérifier les webhooks Notch Pay ;
- empêcher le client de choisir librement le montant d'une commande ;
- lier chaque paiement à un utilisateur/commande côté serveur ;
- utiliser les clés Live uniquement côté serveur ;
- déployer le backend avec HTTPS.

Documentation Notch Pay :
https://developer.notchpay.co/
