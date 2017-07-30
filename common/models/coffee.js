'use strict';

const Clarifai = require('clarifai')

// instantiate a new Clarifai app passing in your api key.
const clarifai = new Clarifai.App({
 apiKey: process.env.CLARIFAI_KEY || 'ec64fde9fdd04242aece41cb196215c8'
});


module.exports = function (Coffee) {
    Coffee.search = function (image, cb) {
        // predict the contents of an image by passing in a url
        clarifai.models.predict('coffee', {
            base64: image
        }).then(response => {
            var outputs = response.outputs && response.outputs;
            var data = outputs && outputs[0] && outputs[0].data;
            var concepts = data && data.concepts.length >= 1 && data.concepts;
            var firstConcept = concepts[0];
            if(firstConcept){
                Coffee.findOne({
                    brand: firstConcept.name
                }, function (err, docs) {
                    cb(err, docs);
                });
            }else{
                cb(null, null)
            }
        }).catch(err => {
            console.error(err);
        })
    };

    Coffee.remoteMethod("search", {
        description: "Searching coffee based on an image",
        accepts: { arg: "image", type: "string" },
        returns: { arg: "result", type: "object", root: true}
    });
};
