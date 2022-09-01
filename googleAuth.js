var apiKey = 'AIzaSyCUcQ4n8mNjGdipXjXIDOa5sE7CMvMMjIU';
var discoveryDocs = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
var clientId = '741031859741-qp5hat9nd1narovtmeevdjpmpm0pkpme.apps.googleusercontent.com';
var scopes = 'https://www.googleapis.com/auth/spreadsheets';

var authorizeButton = document.getElementById('authorize-button');
var signoutButton = document.getElementById('signout-button');

function handleClientLoad() {
  // Load the API client and auth2 library
  gapi.load('client:auth2', initClient);
}

function initClient() {
  gapi.client.init({
      apiKey: apiKey,
      discoveryDocs: discoveryDocs,
      clientId: clientId,
      scope: scopes
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
  }).catch(console.log);
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
  }
}

function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}
