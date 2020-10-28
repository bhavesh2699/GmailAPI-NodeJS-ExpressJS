//initializing installed in  project dependencies
const nodemailer = require('nodemailer'); //module used for creating object and sending mails
const google = require('googleapis').google; //google api module 
const express = require('express') //express module 
const bodyParser = require('body-parser'); //reading json data module
const OAuth2Data = require('./credentials.json'); //import credentials file
const OAuth2Token = require('./token.json'); //import token file, will be created later
const opn = require('opn'); //opn module used for opening links in browser
const fetch = require('node-fetch'); //for opening link getting json response
const fs = require('fs'); //module for readand write into files
const readline = require('readline'); //module for readlines from files

const app = express(); //initializing express

//variables declaration
const SCOPES = [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://mail.google.com/',
               ]; //Array of scopes for authentication gmail api
               
const TOKEN_PATH = 'token.json'; //variable for storing token file name 
const CLIENT_ID = OAuth2Data.web.client_id; //read client_id from credentials.json 
const CLIENT_SECRET = OAuth2Data.web.client_secret; //read client_secret from credentials.json
const REDIRECT_URL = OAuth2Data.web.redirect_uris[0]; //read redirect_uris from credentials.json
var user_id=''; 
var authed = false;

//creating new auth object for validation of credentials
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL) 

app.use(bodyParser.json()); //initializing bodyParser middleware func^
app.use(bodyParser.urlencoded()); //initializing bodyParser middleware func^
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
}); //definig headers res/req header

/*
GET http://localhost:5000/

Route for authenticating user using API call to gmail Server and storing tokens like
Refresh token and Access token credentials into token.json file.
*/
app.get('/', (req, res) => {
    if (!authed) 
    {
        // Generate an OAuth URL and redirect there
        const url = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });

        //console.log(url)
        opn(url); //opening OAuth URL in browser
    } 
    else 
    {
        //res.send("loggin");
        res.redirect("/auth/google/callback"); //redirecting to callback url with Authorization code
    }

    return res.send("LoggedIn");
});

//Redirecting route with Authorization code
app.get('/auth/google/callback', function (req, res) {

    const code = req.query.code; //fetching code from req header from gmail

    if (code) 
    {
        // Get an access token based on our OAuth code
        oAuth2Client.getToken(code, function (err, tokens) {
            if (err) 
            {
                //console.log('Error authenticating');
                //console.log(err);
                res.send(err);
            } 
            else
            {
                //console.log('Successfully authenticated');
                //console.log(tokens.refresh_token);
                fs.writeFile(TOKEN_PATH, JSON.stringify({refresh_token:tokens.refresh_token,access_token:tokens.access_token}) ,function (err) {
                  if (err) throw err; });
          
                res.send('Successfully Authenticated');
            }
        });
    }
});

/*
Post http://localhost:5000/send

Request Type: x-www-form-urlencoded
Request Body:
{
  to: Sender's Email ID,
  message: Message to be sent in body,
  subject: Email subject text
}
*/

app.post('/send', function (req, res){

  const access_token = OAuth2Token.access_token;
  const refresh_token = OAuth2Token.refresh_token;

  fetch(`https://gmail.googleapis.com/gmail/v1/users/me/profile?access_token=${access_token}`)
          .then(response => response.json())
          .then(d => {
            const smtpTransport = nodemailer.createTransport({
                 service: "gmail",
                 auth: {
                      type: "OAuth2",
                      user: d.emailAddress, 
                      clientId: CLIENT_ID,
                      clientSecret: CLIENT_SECRET,
                      refreshToken: refresh_token,
                      accessToken: access_token,
                      tls: { rejectUnauthorized: false}
                 }
            });

            const mailOptions = {
             from: d.emailAddress,
             to: req.body.to,
             subject: req.body.subject,
             generateTextFromHTML: true,
             html: req.body.message
        };

        smtpTransport.sendMail(mailOptions, (error, response) => {
             error ? res.send(error) : res.send(response);
             smtpTransport.close();
        });                   
    });
});

const port = process.env.port || 5000
app.listen(port, () => console.log(`Server running at ${port}`));

