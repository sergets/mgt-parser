var utils = { 
    repeatUntilTrue : function(attempt) {
        return attempt().then(function(res) {
            return res || utils.repeatUntilTrue(attempt);
        });
    },

    all : function(hash) {
        var keys = Object.keys(hash);
        return Promise.all(keys.map(function(key) { return hash[key]; }))
            .then(function(arr) {
                return arr.reduce(function(all, res, i) {
                    all[keys[i]] = res;
                    return all;
                }, {});
            });
    },

    map : function(object, callback, ctx) {
        return Object.keys(object).reduce(function(res, key) {
            res[key] = callback.call(ctx || this, object[key], key);
            return res;
        }, {});
    }
};

module.exports = utils;