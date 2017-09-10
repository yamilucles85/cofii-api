const app = require("../../server/server");

const Clarifai = require("clarifai");

const winston = require("winston");

const stream = require('stream');

const ObjectID = require('mongodb').ObjectID;
const _ = require("lodash");

const THRESHOLD = 0.5;

const BUCKET_NAME = process.env.BUCKET_NAME;


// instantiate a new Clarifai app passing in your api key.
const clarifai = new Clarifai.App({
    // TODO: Remove this
    apiKey: process.env.CLARIFAI_KEY || "f7c91965b9c94bd88d49643d3c9ce0a2",
});

const buildS3Url = (bucket, fileName) => {
    return `https://s3-us-west-2.amazonaws.com/${bucket}/${fileName}`;
}

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

        const queryBrands = filters.hasOwnProperty("coffee_name") ? Brand.find({
            where: {
                name: { like: new RegExp(".*" + filters.coffee_name + ".*", "i") }
            }
        }) : Promise.resolve([]);

        queryBrands.then(brands => {
            return brands.map(
                (x) => {
                    return x.id;
                }
            )
        }).then(brandsIds => {
            if (filters.hasOwnProperty("coffee_name") || brandsIds.length) {
                query.brandId = {
                    inq: brandsIds
                }
            }

            if (_filters.hasOwnProperty("altitude"))
            { query.altitude = filters.altitude; }

            if (_filters.hasOwnProperty("price"))
            { query.price = { between: filters.price }; }

            if (_filters.hasOwnProperty("avg_rating"))
            { query.price = { between: filters.rating }; }

            Coffee.find({ where: query, include: ["brand", "variety"] }, cb);
        }).catch(err => cb(err));
    };

    Coffee.remoteMethod("explora", {
        description: "Searches coffee based on filters",
        accepts: [{
            arg: "filters", type: "object", required: true,
            http: {
                source: 'body',
            }
        }],
        returns: { arg: "result", type: "object", root: true },
        http: {
            path: '/explora',
            verb: 'post',
        },
    });


    Coffee.search = (image, cb) => {

        const query = { input: { base64: image } };

        clarifai.inputs.search(query, { page: 1, perPage: 5 })
            .then((response) => {
                let hits = response.hits;

                if (!hits) {
                    // Didn't get the hits object or it's empty
                    return cb("no hits");
                }

                if (!hits.length) {
                    return cb(null, null);
                }

                hits = _.sortBy(hits, "score");
                hits = hits.reverse();

                if (hits[0].score < THRESHOLD) {
                    return cb();
                }

                const metadata = hits[0].input.data.metadata;

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

            return cb(new Error('User not logged in'));
        }

        Review.findOne({ where: filter })
            .then(_review => {
                var review = _review;


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
            .then(_reviews => {
                cb(null, _reviews);
            }).catch(err => {
                cb(err);
            })
    }

    Coffee.remoteMethod(
        'myReviews', {
            accepts: [{
                arg: 'id',
                type: 'string',
                required: true,
            },
            {
                arg: 'filter',
                type: 'object',
                required: false,
                http: {
                    source: 'query',
                },
            },
            {
                arg: 'options',
                type: 'object',
                http: 'optionsFromRequest',
            }],
            returns: {
                arg: 'reviews',
                type: 'object',
                root: true,
            },
            http: {
                path: '/:id/my-reviews',
                verb: 'get',
            },
        }
    );

    Coffee.thumbnail = function (id, size, res, cb) {
        const Thumbnail = app.models.Thumbnail;
        const options = {
            size: size
        };

        Coffee.findById(id)
            .then(coffee => {
                if (!coffee || !coffee.image) {
                    var err = new Error('Image not found');
                    err.statusCode = 404;
                    return Promise.reject(err);
                }
                Thumbnail.generate(coffee.image, options, res, cb);
            })
            .catch(err => cb(err));
    }

    Coffee.remoteMethod(
        'thumbnail', {
            accepts: [{
                arg: 'id',
                type: 'string',
                required: true,
            },
            {
                arg: 'size',
                type: 'string',
                http: { source: 'query' }
            },
            {
                arg: 'res',
                type: 'object',
                http: { source: 'res' }
            }],
            returns: {
                arg: 'body',
                type: 'file',
                root: true,
            },
            http: {
                path: '/:id/thumbnail',
                verb: 'get',
            },
        }
    );


    Coffee.relatedCoffees = function (id, cb) {
        Coffee.findById(id)
            .then(_coffee => {
                if (!_coffee) {
                    return {};
                }
                return Promise.all([
                    Coffee.find({
                        where: {
                            id: {
                                neq: _coffee.id
                            },
                            brandId: _coffee.brandId,
                            model: _coffee.model
                        }
                    }),
                    Coffee.find({
                        where: {
                            id: {
                                neq: _coffee.id
                            },
                            brandId: _coffee.brandId,
                            varietyId: _coffee.varietyId
                        }
                    })
                ]).then(
                    results => {
                        return {
                            varieties: results[0],
                            models: results[1]
                        }
                    }
                    );
            })
            .then(response => {
                cb(null, response);
            })
            .catch(err => {
                cb(err)
            })
    }

    Coffee.remoteMethod(
        'relatedCoffees', {
            accepts: [{
                arg: 'id',
                type: 'string',
                required: true,
            }],
            returns: {
                arg: 'response',
                type: 'object',
                root: true,
            },
            http: {
                path: '/:id/related-coffees',
                verb: 'get',
            },
        }
    );

    Coffee.prototype.train = function (cb) {
        var _self = this;
        if (!_self.trained) {
            if (!_self.image) {
                return cb(new Error('Image not found for coffee id:' + _self.id.toString()))
            }

            var image = _self.image.base64 ? {
                "base64": _self.image.base64
            } : {
                    "url": (_self.image.url || _self.image)
                };

            var input = {};

            Object.assign(input, image, {
                metadata: {
                    "id": _self.id.toString(),
                    "brandId": _self.brandId.toString(),
                    "varietyId": _self.varietyId.toString(),
                    "model": _self.model || 'Original',
                }
            });

            clarifai.inputs.create(input).then(
                (inputs) => {
                    _self.trained = true;
                    _self.save(cb);
                },
                (err) => {
                    console.log(err);
                    cb(new Error('Error while training'));
                }
            );
        } else {
            cb(new Error('Coffee Already Trained'))
        }
    };

    /*     Coffee.observe('after save', function (ctx, next) {
            const Container = app.models.Container;
            const Thumbnail = app.models.Thumbnail;
            var coffee = ctx.instance;
            var fileName = `coffee-${coffee.id.toString()}.jpg`;
            if (coffee.image && coffee.image.base64 && !coffee.image.url) {
                Thumbnail.generate(coffee.image, {size: 'original'}, null, (err, buffer) => {
                    if(err){
                        return next(err);
                    }
                    var upload = Container.uploadStream(BUCKET_NAME, fileName);
                    var bufferStream = new stream.PassThrough();
                    upload.on('err', next);
                    upload.on('finish', () => {
                        coffee.image =  { url: buildS3Url(BUCKET_NAME,fileName) };
                        coffee.save((err, data) => {
                            next(err);
                        });
                    });
                    bufferStream.end(buffer);
                    bufferStream.pipe(upload);
                });
            }else{
                next();
            }
        }); */

    Coffee.observe('after save', function (ctx, next) {
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
