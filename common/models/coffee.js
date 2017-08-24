const Clarifai = require("clarifai");

const winston = require("winston");

// instantiate a new Clarifai app passing in your api key.
const clarifai = new Clarifai.App({
    // TODO: Remove this
    apiKey: process.env.CLARIFAI_KEY || "f7c91965b9c94bd88d49643d3c9ce0a2",
});

module.exports = (Coffee) => {
    /**
     * Runs a query agains the photos of the Coffee bags and returns the top result
     */
    Coffee.search = (image, cb) => {

        const query = { input: { bytes: new Buffer(image, "base64") } };

        clarifai.inputs.search(query, { page: 1, perPage: 1 })
            .then((response) => {
                const hits = response.hits;

                if (!hits || !hits.length) {
                    // Didn't get the hits object or it's empty
                    return cb("no hits");
                }

                return cb(null, hits[0].input.data.metadata);
            })
            .catch((err) => {
                winston.error("search coffee", err);
                return cb(err);
            });
    };

    Coffee.remoteMethod("search", {
        description: "Searches coffee based on an image",
        accepts: { arg: "image", type: "string" },
        returns: { arg: "result", type: "object", root: true },
    });
};
