var request = require('request-promise'),
    extend = require('extend'),
    deepEqual = require('deep-equal'),
    utils = require('./utils.js'),
    timetable = require('./timetable.js'),
    cheerio = require('cheerio'),
    iconv = require('iconv'),
    urlencode = require('urlencode'),
    toUtf = new iconv.Iconv('cp1251', 'utf-8'),
    toWin = new iconv.Iconv('utf-8', 'cp1251');

var BASE_URL = 'http://mosgortrans.org/pass3/',
    TYPES_MAP = { 'bus' : 'avto', 'troll' : 'trol', 'tram' : 'tram' };
    
var dowsForRoute = {};
    
module.exports = extend({}, timetable, {
    getAllRoutes : function(type) {
        return callApi('request.ajax.php', {
            list : 'ways', 
            type : TYPES_MAP[type]
        }).then(function(res) {
            return res.split('\n');
        });
    },
    
    _loadTimetableForDay : function(type, route, dow) {
        return getDowsForRoute(type, route).then(function(dows) {
            console.log('-> loading'+ dow+ 'from'+ JSON.stringify(dows));
            var dowSignature = dows.filter(function(ttDow) {
                return dow & ttDow;
            })[0];
            console.log('-> dowSignature is '+ dow);
            return dowSignature && utils.all(['A', 'B'].reduce(function(all, dir) {
                var params = { 
                    type : TYPES_MAP[type],
                    way : route,
                    date : stringToBitmask(dowSignature),
                    direction : { 'A' : 'AB', 'B' : 'BA' }[dir],
                    waypoint : 'all'
                };
                
                all[dir] = callApi('shedule.php', params).then(function(res) {
                    return {
                        params : params,
                        html : cheerio.load(res)
                    };
                });
                return all;
            }, {}));
        });
    },
    
    _loadAllTimetables : function(type, route) {
        var _this = this;
        
        return getDowsForRoute(type, route).then(function(dows) {
            console.log('loading timetables for all days; ' + utils.all + '//////' + _this._loadTimetableForDay);
            return utils.all(dows.reduce(function(all, dow) {
                all[dow] = _this._loadTimetableForDay(type, route, dow);
                return all;
            }, {})).then(function(res) { console.log('returned', res); return res; }, function(err) { console.warn('err', err); });
        });
    },
    
    /*
     * Should return { dow : , source : , downloaded : , valid : } 
     */
    _getDataFromRawTimetable : function(rawTimetable) {
        return {
            dow : rawTimetable.params.date,
            source : 'pass3',
            downloaded : +new Date(),
            valid : 'TODO'
        };
    },
    
    /*
     * Should return [stop, ]
     */
    _getIterableStops : function(rawTimetable) {
        return [];
    },
    
    /*
     * Should return { title : , hours :  } 
     */
    _getStopData : function(stop) {
        return {
            title : stop.title,
            hours : stop.planning
        }
    }
});

function callApi(url, params) {
    console.log('calling', BASE_URL + url + '?' + urlencode.stringify(params, { charset : 'cp1251' }));
    return new Promise(function(resolve, reject) {
        request({
            method : 'GET',
            uri : BASE_URL + url + '?' + urlencode.stringify(params, { charset : 'cp1251' }),
            encoding : null
        }, function(err, res, body) {
            if(err) {
                reject(err); 
            } else {
                resolve(toUtf.convert(body).toString());
            }
        });
    });
}

function getDowsForRoute(type, route) {
    return Promise.resolve((dowsForRoute[type] && dowsForRoute[type][route]) || callApi('request.ajax.php', {
        list : 'days', 
        type : TYPES_MAP[type],
        way : route
    }).then(function(res) {
        return res.split('\n').filter(Boolean).map(stringToBitmask);
    }).then(function(res) {
        (dowsForRoute[type] || (dowsForRoute[type] = {}))[route] = res;
        return res;
    }));
}

function bitmaskToString(bitmask) {
    return ([].slice.call(bitmask.toString(2)).reverse().join('') + '0000000').substr(0, 7)
}

function stringToBitmask(string) {
    return [].reduce.call(string, function(r, val, i) {
        +val && (r += 1 << i);
        return r; 
    }, 0);
}
