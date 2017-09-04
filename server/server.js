'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();

var crypto = require('crypto');
var cookieParser = require('cookie-parser');
var session = require('express-session');

app.middleware('session:before', cookieParser(app.get('cookieSecret')));
app.middleware('session', session({
  secret: process.env.SESSION_SECRET || 'kitty',
  saveUninitialized: true,
  resave: true,
}));

// Passport configurators..
var loopbackPassport = require('loopback-component-passport');
var PassportConfigurator = loopbackPassport.PassportConfigurator;
var passportConfigurator = new PassportConfigurator(app);

var flash = require('express-flash');
app.use(flash());

app.get('/auth/error', function (req, res) {
  var flash = req.flash('error').length >= 1 && req.flash('error')[0];
  var error = flash || 'unknow error';
  res.status(403).json({ success: false, error: error });
});

// attempt to build the providers/passport config
var facebookKeys = {
  clientID: process.env.FACEBOOCK_CLIENT_ID || "113119379370031",
  clientSecret: process.env.FACEBOOCK_CLIENT_SECRET || "c08e8da9f58f8b776d8754af579bbbe6",
};

var providersConfig = {};

try {
  providersConfig = require('../providers.json');
} catch (err) {
  console.trace(err);
  process.exit(1); // fatal
}

var generateKey = function (hmacKey, algorithm, encoding) {
  //assert(hmacKey, g.f('{{HMAC}} key is required'));
  algorithm = algorithm || 'sha1';
  encoding = encoding || 'hex';
  var hmac = crypto.createHmac(algorithm, hmacKey);
  var buf = crypto.randomBytes(32);
  hmac.update(buf);
  var key = hmac.digest(encoding);
  return key;
}

var profileToUser = function (provider, profile, options) {
  // Let's create a user for that
  var profileEmail = profile.emails && profile.emails[0] &&
    profile.emails[0].value;
  var generatedEmail = (profile.username || profile.id) + '@' +
    (profile.provider || provider) + '.coffii.co';
  var email = provider === 'ldap' ? profileEmail : generatedEmail;
  var username = provider + '.' + (profile.username || profile.id);
  var password = generateKey('password');
  var fullname = (
    profile.displayName || profile.name || profile.username || username
  );
  var userObj = {
    username: username,
    password: password,
    fullname: fullname,
  };
  if (email) {
    userObj.email = email;
  }
  return userObj;
};

app.start = function () {
  // start the web server
  return app.listen(function () {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// -- Add your pre-processing middleware here --
app.use(loopback.token());
app.use(function setCurrentUser(req, res, next) {
  if (!req.accessToken) {
    return next();
  }

  app.models.CoffiiUser.findById(req.accessToken.coffiiUserId, function (err, user) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return next(new Error('No user with this access token was found.'));
    }
    req.currentUser = user;
    next();
  });
});

app.use(function (req, res, next) {
  var token = req.accessToken;
  if (!token) {
    return next();
  }

  var now = new Date();
  if (now.getTime() - token.created.getTime() < 1000) {
    return next();
  }

  req.accessToken.created = now;
  req.accessToken.ttl = 604800 * 10; // ten weeks
  req.accessToken.save(next);
});

app.all('/auth/*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  next();
});

process.on('uncaughtException', function (err) {
  console.log(err);
});

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;

  //require('./push-application')(app);

  passportConfigurator.init();

  passportConfigurator.setupModels({
    userModel: app.models.CoffiiUser,
    userIdentityModel: app.models.CoffiiUserIdentity,
    userCredentialModel: app.models.CoffiiUserCredential,
  });

  for (const s in providersConfig) {
    var c = providersConfig[s];
    switch (c.provider) {
      case 'facebook':
        c.clientID = facebookKeys.clientID;
        c.clientSecret = facebookKeys.clientSecret;
        break;
      default:
        break;
    }
    c.session = c.json ? false : c.session !== false;
    c.profileToUser = function (provider, profile, options) {
      var userObj = profileToUser(provider, profile, options);
      return userObj;
    };
    passportConfigurator.configureProvider(s, c);
  }

  // start the server if `$ node server.js`
  if (require.main === module) {
    //app.transloadit = new TransloaditClient(transloaditKeys);
    app.start();
  }
});
