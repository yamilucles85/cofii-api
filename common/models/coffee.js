const app = require('../../server/server');

const Clarifai = require("clarifai");

const winston = require("winston");

const ObjectID = require('mongodb').ObjectID;

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

        const query = { input: { base64: image } };

        clarifai.inputs.search(query, { page: 1, perPage: 1 })
            .then((response) => {
                const hits = response.hits;

                if (!hits) {
                    // Didn't get the hits object or it's empty
                    return cb("no hits");
                }

                if (!hits.length) {
                    return cb(null, null);
                }

                const metadata = hits[0].input.data.metadata;
                console.log(metadata);
                Coffee.findById(metadata.id, (error, instance) => cb(null, instance));
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


    Coffee.sendReview = (id, data, options, cb) => {
        const Review = app.models.Review;

        var token = options && options.accessToken;
        var currentUserId = token && token.userId;

        var filter = {
            coffeeId: id,
            userId: currentUserId,
        }

        Review.findOne(filter)
        .then(_review => {
            var review = _review;

            if(!review){
                review = new Review({
                    coffeeId: new ObjectID(id),
                    userId: currentUserId,
                });
            }

            Object.assign(review, data || {});
            review.rating = Math.max(Math.min((review.rating || 0), 5), 0);
            review.save(cb);
        }).catch(err => {
            cb(err);
        })
    }

    Coffee.remoteMethod(
        'sendReview', {
          accepts: [{
            arg: 'id',
            type: 'string',
            required: true,
          },
          {
            arg: 'review',
            type: 'object',
            required: true,
            http: {
              source: 'body',
            },
          },
          {
            arg: 'options',
            type: 'object',
            http: 'optionsFromRequest',
          }],
          returns: {
            arg: 'review',
            type: 'object',
            root: true,
          },
          http: {
            path: '/:id/send-review',
            verb: 'post',
          },
        }
      );
};
