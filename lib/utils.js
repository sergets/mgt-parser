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
    },
    
    each : function(object, callback, ctx) {
        return Object.keys(object).forEach(function(key) {
            callback.call(ctx || this, object[key], key);
        })
    },
    
    compactifyArray : function(arr) {
        res = [];
        arr.forEach(function(item, i) {
            if(item == arr[i - 1]) {
                res[res.length - 1][1]++; 
            } else {
                res.push([item, 1]);
            }
        });
        return res.map(function(item) {
            return item[1] == 1? item[0] : item;
        });
    },
    
    decompactifyArray : function(arr) {
        return [].concat.apply([], arr.map(function(item) {
            return Array.isArray(item) && item[1]?
                Array.apply([], Array(item[1])).map(function() { return item[0]; }) :
                item;
        }));
    },
    
    deltifyArray : function(arr) {
        return arr.map(function(item, i) {
            return i > 0? item - arr[i - 1] : item;
        });
    },
    
    dedeltifyArray : function(arr) {
        return arr.reduce(function(res, item, i) {
            return res.concat(i > 0? item + res[i - 1] : item);
        }, []);
    }
};

module.exports = utils;