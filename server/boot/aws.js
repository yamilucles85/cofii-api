'use strict';

// override s3 config
const S3_KEY = process.env.S3_KEY || "PqkhurKwIBjj+ckVbOZxrPHZrD1lhqm+C3M9XuHp";
const S3_KEY_ID = process.env.S3_KEY_ID || "AKIAJJRYTDV4VIPNLGUQ";

module.exports = function(server) {
    server.set('awsConfig', {
        accessKeyId: S3_KEY,
        secretAccessKey: S3_KEY_ID,
        signatureVersion: "v4",
    });
};