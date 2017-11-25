const express = require('express')
const bodyParser = require('body-parser');
const request = require('request');
const constants = require('constants');
const app = express()

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV == 'production';
const baseUrl = 'https://api.hackathon.developer.nordeaopenbanking.com';
const dashboardUrl = 'https://invest-matti.shinyapps.io/invest-matti/';

let latestAccounts = [];

if(!clientId) {
  throw 'CLIENT_ID is missing';
}

if(!clientSecret) {
  throw 'CLIENT_SECRET is missing';
}

app.use(bodyParser.json());

app.get('/', (req, res) => res.send('pong'))

app.get('/auth', (req, res) => {
  const authUrl = getAuthUrl(req);
  console.log('Redirecting to auth', authUrl);
  res.redirect(authUrl);
});

app.get('/callback', (req, res) => {
  console.log('POST request', req.originalUrl, 'with body', req.body, 'query', req.query);

  acquireToken(req, (err, body) => {
    if (err) {
      console.log('Access token error', err);
      res.status(500).send('failed');
      return;
    }

    console.log('Access token response', body);

    if (body.groupHeader && body.groupHeader.httpCode != 200) {
      console.log('Access token failed');
      res.status(500).send('failed');
    } else {

      fetchAccounts(body.access_token, (err, body) => {
        if (err) {
          console.log('Error fetching accounts', err);
          res.status(500).send('failed');
          return;
        }

        console.log('Accounts', body);

        if (body.groupHeader && body.groupHeader.httpCode != 200) {
          console.log('Failed to fetch with status', body.groupHeader.httpCode);
          res.status(500).send('failed');
        } else {
          console.log('Redirecting to dashboard');

          latestAccounts = body.response.accounts;

          res.redirect(dashboardUrl);
        }

      });

    }

  });
});

app.get('/accounts', (req, res) => {
  console.log('GET accounts', latestAccounts);
  res.json({
    accounts: latestAccounts
  });
});

app.listen(port, () => console.log('App listening on port', port))

function getAuthUrl(req) {
  const redirectUrl = getRedirectUrl(req);
  return `${baseUrl}/v1/authentication?state=123&client_id=${clientId}&redirect_uri=${redirectUrl}`;
}

function getRedirectUrl(req) {
  const protocol = isProd ? 'https' : req.protocol;
  return protocol + '://' + req.get('host') + '/callback';
}

function acquireToken(req, next) {
  const url = `${baseUrl}/v1/authentication/access_token`;
  const form = {
    code: req.query.code,
    redirect_uri: getRedirectUrl(req)
  };
  const headers = {
    'X-IBM-Client-Id': clientId,
    'X-IBM-Client-Secret': clientSecret
  };

  request.post({
    url,
    headers,
    form,
    json: true,
    secureOptions: constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_TLSv1
  }, (err, httpResponse, body) => {
    next(err, body);
  });
}

function fetchAccounts(accessToken, next) {
  const url = `${baseUrl}/v2/accounts`;
  const headers = {
    'X-IBM-Client-Id': clientId,
    'X-IBM-Client-Secret': clientSecret,
    'Authorization': 'Bearer ' + accessToken
  };

  request.get({
    url,
    headers,
    json: true,
    secureOptions: constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_TLSv1
  }, (err, httpResponse, body) => {
    next(err, body);
  });
}
