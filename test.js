function myFunction() {
  
}

function authorizeDrive() {
  const folder = DriveApp.getFolderById('1--rBq8CHSUm0O-QDGezoEKWe0dYY6ysQ');
  Logger.log('OK: ' + folder.getName());
}