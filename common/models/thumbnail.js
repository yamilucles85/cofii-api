'use strict';

const Jimp = require("jimp");

const bufferFromBase64 = (b64string) => {
    if (typeof Buffer.from === "function") {
        // Node 5.10+
        return Buffer.from(b64string, 'base64');
    }
    // older Node versions
    return new Buffer(b64string, 'base64');
}

const guessImageForJimp = (obj) => {
    if(obj.url){
        return obj.url;
    }
    return obj.base64 ? bufferFromBase64(obj.base64) : (obj || null);
}

module.exports = function(Thumbnail) {
    Thumbnail.generate = function (obj, res, cb) {
        let image = guessImageForJimp(obj);
        if(!image){
            return cb(new Error('Image not found'));
        }
        Jimp.read(image).then(function (image) {
                return image.contain(250,250);
        })
        .then(image => {
            res.set('Content-Type', Jimp.MIME_JPEG);
            return image.getBuffer(Jimp.MIME_JPEG, (err, buffer) => cb(err, buffer, Jimp.MIME_JPEG));
        })
        .catch(err => {
            cb(err);
        })
    };
};
