rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function hasActiveAccess() {
      return request.auth != null
        && firestore.get(
          /databases/(default)/documents/users/$(request.auth.uid)
        ).data.active == true;
    }

    match /materiales/{allPaths=**} {
      allow read: if hasActiveAccess();
      allow write: if false;
    }

    match /paquetes/{allPaths=**} {
      allow read: if hasActiveAccess();
      allow write: if false;
    }
  }
}
