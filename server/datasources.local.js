var mongodbUri = require('mongodb-uri');

var URI = process.env.MONGODB_URI || "mongodb://strk9:coffii@ds127963.mlab.com:27963/coffii";
var uriObject = URI ? mongodbUri.parse(URI) : null;
var config = require('./datasources.json') || {};

// override mongodb config
if (uriObject && uriObject.hosts.length >= 1) {
  config.db = {
    name: 'db',
    connector: 'mongodb',
    host: uriObject.hosts[0].host,
    port: uriObject.hosts[0].port,
    database: uriObject.database,
    username: uriObject.username,
    password: uriObject.password,
  };
}

// override s3 config
const S3_KEY = process.env.S3_KEY || "PqkhurKwIBjj+ckVbOZxrPHZrD1lhqm+C3M9XuHp";
const S3_KEY_ID = process.env.S3_KEY_ID || "AKIAJJRYTDV4VIPNLGUQ";

if(config.storage || config.storage.provider === 'amazon'){
  config.storage = require('loopback-component-storage');
  if(S3_KEY){
    config.storage.key = S3_KEY;
  }
  if(S3_KEY_ID){
    config.storage.keyId = S3_KEY_ID;
  }
}

module.exports = config;
