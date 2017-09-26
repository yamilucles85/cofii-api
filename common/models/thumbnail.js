'use strict';

const Jimp = require("jimp");

var thumbSizes = {
    default: 250,
    small: 100,
    medium: 300,
    large: 480,
};

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
    return obj.base64 ? bufferFromBase64(obj.base64.replace(/^data:image\/\w+;base64,/, '')) : (obj || null);
}

const resizeImage = (image, options) => {
    let thumbSize = thumbSizes.default;

    if(options && options.quality){
        image = image.quality(options.quality);
    }

    if(options && options.maxSize){
        if(Math.max(image.bitmap.width, image.bitmap.heigth) > options.maxSize){
            if(image.bitmap.width >= image.bitmap.heigth){
                image = image.resize(options.maxSize, Jimp.AUTO);
            }else{
                image = image.resize(Jimp.AUTO, options.maxSize);
            }
        }
    }

    if(options && options.size === 'original'){
        return image;
    }

    if(options && options.size){
        thumbSize = (isNaN(options.size) ? thumbSize[options.size] : parseInt(options.size)) || thumbSize;
    }

    return image.contain(thumbSize, thumbSize);
}

module.exports = function(Thumbnail) {

    Thumbnail.generate = function (obj, options, res, cb) {
        let image = guessImageForJimp(obj);
        if(!image){
            console.log('image not found');
            let error = new Error('Image not found');
            return cb(error);
        }
        Jimp.read(image).then(function (image) {
            return resizeImage(image, options);
        }).then(image => {
            if(res){
                res.set('Content-Type', Jimp.MIME_JPEG);
            }
            return image.getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
                cb(err, buffer, Jimp.MIME_JPEG);
                image = null;
            });
        })
        .catch(err => {
            cb(err);
        })
    };
};
