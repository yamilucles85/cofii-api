'use strict';

module.exports = function(options) {
  function validateToken(accessToken, cb) {
    cb(accessToken ? true : false);
  }

  return function errorOverride(err, req, res, next) {
    if (err && err.code === 'AUTHORIZATION_REQUIRED') {
      validateToken(req.accessToken, function(isValid) {
        if (!isValid) {
          err.code = 'INVALID_TOKEN';
        }
        next(err);
      });
    } else {
      next(err);
    }
  };
};