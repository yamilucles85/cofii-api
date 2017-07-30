'use strict';

// instantiate a new Clarifai app passing in your api key.
const clarifai = new Clarifai.App({
 apiKey: proccess.env.CLARIFAI_KEY || ''
});


module.exports = function (Coffee) {
    Coffee.search = function (image, cb) {
        // predict the contents of an image by passing in a url
        clarifai.models.predict('Coffee', {
            base64: image
        }).then(response => {
            var outputs = response.outputs && response.outputs.length >= 1 && response.outputs;
            var data = outputs && outputs[0] && outputs[0].data;
            var concepts = data && data.concepts.length >= 1 && data.concepts;
            
            if(concepts && concepts.length >= 1 && concepts[0].value >= 0.6){
                Coffee.findOne({
                    where: {
                        brand: concepts[0].name
                    }
                }, function (err, docs) {
                    cb(null, docs);
                });
            }else{
                cb(null, null)
            }
        })
    };

    Coffee.remoteMethod("search", {
        description: "Searching coffee based on an image",
        accepts: { arg: "image", type: "string" },
        returns: { arg: "result", type: "any", root: true}
    });
};
