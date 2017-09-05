'use strict';

var app = require('../../server/server');

module.exports = function (Review) {
    Review.observe('after save', function (ctx, next) {
        var Coffee = app.models.Coffee;
        var coffeeId = ctx.instance.coffeeId;
        var collection = Review.getDataSource().connector.collection(Review.modelName);
        var coffee = Review.getDataSource().ObjectID(coffeeId);
        collection.aggregate([
            { $match: { coffeId: coffee } },
            {
                $group: {
                    _id: coffee,
                    rating: { $avg: "$rating" },
                },
            },
        ], function (err, results) {
            var data = results && results.length && results[0];
            if (err) {
                next(err);
            } else {
                Coffee.findById(coffeeId)
                    .then(_coffee => {
                        if (data && data.rating) {
                            _coffee['avg_rating'] = data.rating;
                        }
                        return _coffee.save()
                            .then(_c => {
                                next();
                            });
                    }).catch(_err => {
                        next(_err);
                    })
            }
        });
    });
};
