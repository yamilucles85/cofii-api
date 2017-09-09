"use strict";

const AWS = require("aws-sdk");

const sha1 = require("node-sha1");

AWS.config.update({
    accessKeyId: "AKIAJBHSYYCOQZNVEH5A",
    secretAccessKey: "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",
    signatureVersion: "v4",
});

// TODO: Get it from ENV
const Bucket = "coffii";

module.exports = function handler(Coffeerequest) {
    Coffeerequest.observe("before save", (ctx, next) => {
        const coffeeRequest = ctx.instance;

        const s3 = new AWS.S3();

        const accessToken = ctx.options.accessToken;
        const fileImageKey = sha1(`${accessToken}-${Date.now()}`);

        const imgBuffer = new Buffer(coffeeRequest.photo, "base64");

        const params = {
            Bucket,
            Key: fileImageKey,
            Body: imgBuffer,
        };

        return s3.upload(params)
            .promise()
            .then((resp) => {

                // Set the photo to the URL on S3
                coffeeRequest.photo = resp.Location;
                
                ctx.instance = coffeeRequest;
                console.log(JSON.stringify(ctx.instance));
                return next();
            })
            .catch((err) => {
                return next(err);
            });
    });
};
