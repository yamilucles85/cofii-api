"use strict";

const app = require("../../server/server");

var md5 = require("blueimp-md5");

var GRAVATAR_URI = "https://www.gravatar.com/avatar/";

var avatarSizes = {
    small: 100,
    medium: 300,
    large: 480,
};

var buildGravatarSizesMap = function (hash) {
    var result = {};
    for (var key in avatarSizes) {
        result[key] = GRAVATAR_URI + hash + "?s=" + avatarSizes[key] + "&d=mm";
    }
    return result;
};

var reservedWords = ["admin"];

module.exports = function (Account) {
    Account.validatesExclusionOf("username", { in: reservedWords });

    Account.afterRemote("findById", function (ctx, user, next) {
        var currentUserId = ctx.req.accessToken && ctx.req.accessToken.userId;
        if (!currentUserId || currentUserId.toString() !== user.id.toString()) {
            user.email = undefined;
        }
        next();
    });

    Account.beforeRemote("login", function (ctx, modelInstance, next) {
        if (ctx.args.credentials.username) {
            ctx.args.credentials.username = ctx.args.credentials.username.toLowerCase();
        }
        if (ctx.args.credentials.email) {
            ctx.args.credentials.email = ctx.args.credentials.email.toLowerCase();
        }
        next();
    });

    Account.beforeRemote("create", function (ctx, user, next) {
        var body = ctx.req.body;
        if (body.username) {
            body.username = body.username.toLowerCase();
        }
        if (body.email) {
            body.email = body.email.toLowerCase();
        }
        next();
    });

    /* Reset Password */
    /*   Account.on("resetPasswordRequest", function (info) {
        // requires AccessToken.belongsTo(User)
        var _client = new postmark.Client(process.env.POSTMARK_TOKEN);
        info.accessToken.user(function (err, user) {
          // Send an email:
          _client.sendEmailWithTemplate({
            "From": "info@coffii.com",
            "To": info.email,
            "TemplateId": process.env.POSTMARK_RESETPASSWORD_TEMPLATEID,
            "TemplateModel": {
              "name": user.fullname || user.username,
              "action_url": "https://web.coffii.co/Account/reset?access_token=" + info.accessToken.id,
              "support_url": "https://coffii.co/support"
            }
          });
        });
      }); */

    Account.avatar = function (id, req, res, cb) {
        const redirect = !(req.query.json ? req.query.json === "true" : false);
        const avatarSize = req.query.size || req.query.s || "small";

        if (avatarSize === "s") {
            avatarSize = "small";
        }
        if (avatarSize === "m") {
            avatarSize = "medium";
        }
        if (avatarSize === "l") {
            avatarSize = "large";
        }

        Account.findOne({ where: { id: id } }, function (err, user) {
            if (err) cb(err);
            if (!user) {
                err = new Error(
                    "No instance with id " + id + " found for " + Account.modelName
                );
                err.statusCode = 404;
                return cb(err);
            }

            var avatarSizesMap = (
                user.avatar || buildGravatarSizesMap(md5(user.email))
            );

            var avatarData = {
                url: avatarSizesMap[avatarSize] || avatarSizesMap["small"],
            };

            if (redirect) {
                res.redirect(avatarData.url);
            } else {
                cb(null, avatarData);
            }
        });
    };

    Account.remoteMethod(
        "avatar", {
            accepts: [
                { arg: "id", type: "string" },
                { arg: "req", type: "object", http: { source: "req" } },
                { arg: "res", type: "object", http: { source: "res" } },
            ],
            returns: {
                arg: "data",
                type: "object",
                root: true,
            },
            http: {
                path: "/:id/avatar",
                verb: "get",
            },
        }
    );

    /*   Account.registerDevice = function(data, options, cb) {
        var Installation = app.models.UserInstallation;
        var token = options && options.accessToken;
        var currentUserId = token && token.userId;
        Installation.findOne({
          where: {
            deviceToken: data.deviceToken,
            deviceType: data.deviceType,
          },
        }).then(function(installation) {
          if (installation) {
            installation.userId = currentUserId;
            installation.modified = new Date();
            installation.status = "active";
            return installation.save();
          } else {
            return Installation.create({
              appId: "coffi-push-app",
              userId: currentUserId,
              deviceToken: data.deviceToken,
              deviceType: data.deviceType,
              created: new Date(),
              modified: new Date(),
              status: "active",
            });
          }
        }).then(function(installation) {
          cb(null, installation);
        })
        .catch(function(err) {
          cb(err);
        });
      }; */

    /*   Account.remoteMethod(
        "registerDevice", {
          accepts: [{
            arg: "data",
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
            arg: "installation",
            type: "object",
            root: true,
          },
          http: {
            path: "/register-device",
            verb: "post",
          },
        }
      ); */

    Account.search = function (query, options, cb) {
        /* case-insensitive RegExp search */
        var pattern = new RegExp(".*" + query + ".*", "i");
        Account.find(
            {
                limit: 10,
                where: {
                    or: [
                        { username: { like: pattern } },
                        { fullname: { like: pattern } },
                        { email: query.toLowerCase() },
                    ],
                },
                fields: {
                    id: true,
                    username: true,
                    fullname: true,
                    name: true,
                },
            }).then(function (results) {
                cb(null, results);
            }).catch(function (err) {
                cb(err);
            });
    };

    Account.remoteMethod(
        "search", {
            accepts: [{
                arg: "query",
                type: "string",
                required: true,
            }, {
                arg: "options",
                type: "object",
                http: "optionsFromRequest",
            }],
            returns: {
                arg: "users",
                type: "object",
                root: true,
            },
            http: {
                path: "/search",
                verb: "get",
            },
        });

    Account.follow = (id, options, cb) => {
        const Follow = app.models.Follow;
        let token = options && options.accessToken;
        let currentUserId = token && token.userId;

        const relationship = {
            followingId: id,
            followerId: currentUserId
        };

        if(id.toString() === currentUserId.toString()){
            return cb(new Error('Can\'t not follow your self'), false);
        }

        Follow.findOne({ where: relationship }).then(_relationship => {
            if (!_relationship) {
                var follow = new Follow(relationship);
                follow.save((err, _data) => {
                    cb(err, !err ? true : false);
                })
            } else {
                cb(null, true)
            }
        }).catch(err => cb(err, false));
    }

    Account.remoteMethod(
        "follow", {
            accepts: [{
                arg: "id",
                type: "string",
                required: true,
            }, {
                arg: "options",
                type: "object",
                http: "optionsFromRequest",
            }],
            returns: {
                arg: "success",
                type: "boolean",
            },
            http: {
                path: "/:id/follow",
                verb: "post",
            },
        });

    Account.unfollow = (id, options, cb) => {
        const Follow = app.models.Follow;
        let token = options && options.accessToken;
        let currentUserId = token && token.userId;

        const relationship = {
            followingId: id,
            followerId: currentUserId
        };

        Follow.destroyAll(relationship, (err, info) => {
            cb(err, !err ? true : false);
        });
    }

    Account.remoteMethod(
        "unfollow", {
            accepts: [{
                arg: "id",
                type: "string",
                required: true,
            }, {
                arg: "options",
                type: "object",
                http: "optionsFromRequest",
            }],
            returns: {
                arg: "success",
                type: "boolean",
            },
            http: {
                path: "/:id/unfollow",
                verb: "post",
            },
        });
};
