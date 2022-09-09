var apiKey = 'AIzaSyCUcQ4n8mNjGdipXjXIDOa5sE7CMvMMjIU';
var discoveryDocs = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
var clientId = '741031859741-qp5hat9nd1narovtmeevdjpmpm0pkpme.apps.googleusercontent.com';
var scopes = 'https://www.googleapis.com/auth/drive.file';

var authorizeButton = document.getElementById('authorize-button');
var signoutButton = document.getElementById('signout-button');
var form = document.getElementById('form');

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
    document.querySelector('#loading').remove();
  }).catch(console.log);
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
    form.hidden = false;
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
    form.hidden = true;
  }
}

function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}
