rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;

      // Una cuenta nueva puede crear solamente su propio perfil inactivo.
      allow create: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.active == false
                    && request.resource.data.email == request.auth.token.email;

      // La activación se realiza desde Firebase Console o Admin SDK.
      allow update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
