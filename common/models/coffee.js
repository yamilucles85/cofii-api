const app = require("../../server/server");

const Clarifai = require("clarifai");

const winston = require("winston");


const ObjectID = require("mongodb").ObjectID;

// instantiate a new Clarifai app passing in your api key.
const clarifai = new Clarifai.App({
    // TODO: Remove this
    apiKey: process.env.CLARIFAI_KEY || "f7c91965b9c94bd88d49643d3c9ce0a2",
});

module.exports = (Coffee) => {
    /**
     * Runs a query agains the photos of the Coffee bags and returns the top result
     
     filters: {
        coffee_name,
        alltitude,
        rating,
        variety,
        coffee_type

    } */
    Coffee.explora = (filters, cb) => {
        const Brand = app.models.Brand;
        console.log(filters);
        const _filters = filters || {};
        //console.log(_filters);
        // const BrandCollection = Brand.getDataSource().connector.collection(Brand.modelName);
        const query = {};
        if (_filters.hasOwnProperty("coffee_name") && Object.keys(filters).length === 1) {
            query.name = { $regex: filters.coffee_name };
            query.includes = ["coffee", "variety", "reviews"];

            Brand.find({ where: query }, (err, result) => {

                if (err)
                { console.log(`Error ${err}`); return cb(err, null); }

                return cb(null, result);
            });
        } else {
            query.includes = ["brand", "variety", "reviews"];

            if (_filters.hasOwnProperty("altitude"))
            { query.altitude = filters.altitude; }

            if (_filters.hasOwnProperty("price"))
            { query.price = { between: filters.price }; }

            if (_filters.hasOwnProperty("avg_rating"))
            { query.price = { between: filters.rating }; }

            Coffee.find({ where: query }, (err, result) => {
                if (err)
                { return cb(err, null); }

                return cb(null, result);
            });
        }

    };

    Coffee.remoteMethod("explora", {
        description: "Searches coffee based on filters",
        accepts: { arg: "filters", type: "object" },
        return: { arg: "result", tpye: "array", root: true },
    });

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

        let token = options && options.accessToken;
        let currentUserId = token && token.userId;

        let filter = {
            coffeeId: id,
            userId: currentUserId,
            methodId: null,
        };

        if (data.methodId) {
            filter.methodId = data.methodId;
            data.methodId = new ObjectID(data.methodId);
        }

        if (!currentUserId) {
            return cb(new Error("User not logged in"));
        }

        Review.findOne({ where: filter })
            .then((_review) => {
                let review = _review;

                if (!review) {
                    review = new Review({
                        coffeeId: new ObjectID(id),
                        userId: currentUserId,
                        methodId: null,
                    });
                }

                Object.assign(review, data || {});
                review.rating = Math.max(Math.min((review.rating || 0), 5), 0);
                review.save(cb);
            }).catch((err) => {
                cb(err);
            });
    };

    Coffee.remoteMethod(
        "sendReview", {
            accepts: [{
                arg: "id",
                type: "string",
                required: true,
            },
            {
                arg: "review",
                type: "object",
                required: true,
                http: {
                    source: "body",
                },
            },
            {
                arg: "options",
                type: "object",
                http: "optionsFromRequest",
            }],
            returns: {
                arg: "review",
                type: "object",
                root: true,
            },
            http: {
                path: "/:id/send-review",
                verb: "post",
            },
        });

    Coffee.myReviews = (id, filter, options, cb) => {
        const Review = app.models.Review;

        let token = options && options.accessToken;
        let currentUserId = token && token.userId;

        var filter = filter || {};

        filter.coffeeId = id;
        filter.userId = currentUserId;

        Review.find({
            where: filter,
            include: [
                { coffee: ["brand", "variety"] }, "method",
            ],
        })
            .then((_reviews) => {
                cb(null, _reviews);
            }).catch((err) => {
                cb(err);
            });
    };

    Coffee.remoteMethod(
        "myReviews", {
            accepts: [{
                arg: "id",
                type: "string",
                required: true,
            },
            {
                arg: "filter",
                type: "object",
                required: false,
                http: {
                    source: "query",
                },
            },
            {
                arg: "options",
                type: "object",
                http: "optionsFromRequest",
            }],
            returns: {
                arg: "reviews",
                type: "object",
                root: true,
            },
            http: {
                path: "/:id/my-reviews",
                verb: "get",
            },
        });

    Coffee.prototype.train = function (cb) {
        let _self = this;
        if (!_self.trained) {
            if (!_self.image) {
                return cb(new Error("Image not found for coffee id:" + _self.id.toString()));
            }
            clarifai.inputs.create([{
                url: _self.image,
                metadata: {
                    id: _self.id,
                    brandId: _self.brandId,
                    varietyId: _self.varietyId,
                    model: _self.model || "Original",
                },
            }]).then(
                (inputs) => {
                    _self.trained = true;
                    _self.save(cb);
                },
                (error) => { cb(error); });
        } else {
            cb(new Error("Coffee Already Trained"));
        }
    };

    Coffee.observe("after save", (ctx, next) => {
        var coffee = ctx.instance;
        if (!coffee.trained && coffee.image) {
            coffee.train((err, _coffee) => {
                next(err);
            });
        } else {
            next();
        }
    });
};
