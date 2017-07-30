var mongodbUri = require('mongodb-uri');

var URI = process.env.MONGODB_URI || "mongodb://strk9:coffii@ds127963.mlab.com:27963/coffii";
var uriObject = URI ? mongodbUri.parse(URI) : null;
var config = {};

if (uriObject && uriObject.hosts.length >= 1) {
  config.cofidb = {
    name: 'db',
    connector: 'mongodb',
    host: uriObject.hosts[0].host,
    port: uriObject.hosts[0].port,
    database: uriObject.database,
    username: uriObject.username,
    password: uriObject.password,
  };
}

module.exports = config;
