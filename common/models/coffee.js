'use strict';

module.exports = function (Coffee) {
    Coffee.search = function (image, cb) {
        Coffee.find({
        }, function (err, docs) {
            return cb(null, docs);
        });

        // return cb(null,"Hello");
    };

    Coffee.remoteMethod("search", {
        description: "Searching coffee based on an image",
        accepts: { arg: "image", type: "string" },
        returns: { arg: "result", type: "Object" }
    });
};
