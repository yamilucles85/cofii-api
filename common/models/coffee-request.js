"use strict";

const app = require("../../server/server");

const AWS = require("aws-sdk");

const sha1 = require("node-sha1");

const Bucket = process.env.BUCKET_NAME || "coffii-prod";

module.exports = function handler(Coffeerequest) {
    let awsConfig = app.get('awsConfig');
    if(awsConfig){
        AWS.config.update(awsConfig);
    }

    Coffeerequest.observe("before save", (ctx, next) => {
        const coffeeRequest = ctx.instance;

        const s3 = new AWS.S3();

        const accessToken = ctx.options.accessToken;
        const fileImageKey = sha1(`${accessToken}-${Date.now()}.jpg`);

        const imgBuffer = new Buffer(coffeeRequest.coffee.image, "base64");

        const params = {
            Bucket,
            Key: fileImageKey,
            Body: imgBuffer,
        };

        return s3.upload(params)
            .promise()
            .then((resp) => {

                // Set the photo to the URL on S3
                coffeeRequest.coffee.image = resp.Location;
                
                ctx.instance = coffeeRequest;
                return next();
            })
            .catch((err) => {
                return next(err);
            });
    });
};
