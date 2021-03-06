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
            return res.split('\n').filter(Boolean);
        });
    },
    
    _loadTimetableForDay : function(type, route, dow) {
        return getDowsForRoute(type, route).then(function(dows) {
            var dowSignature = dows.filter(function(ttDow) {
                return dow & ttDow;
            })[0];
            return dowSignature && utils.all(['A', 'B'].reduce(function(all, dir) {
                var params = { 
                    type : TYPES_MAP[type],
                    way : route,
                    date : bitmaskToString(dowSignature),
                    direction : { 'A' : 'AB', 'B' : 'BA' }[dir],
                    waypoint : 'all'
                };
                
                all[dir] = callApi('shedule.php', params).then(function(res) {
                    return {
                        params : params,
                        cheerio : cheerio.load(res)
                    };
                });
                return all;
            }, {}));
        });
    },
    
    _loadAllTimetables : function(type, route) {
        var _this = this;
        
        return getDowsForRoute(type, route).then(function(dows) {
            return utils.all(dows.reduce(function(all, dow) {
                all[dow] = _this._loadTimetableForDay(type, route, dow);
                return all;
            }, {}));
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
            valid : dateToNumbers(rawTimetable.cheerio('h3').eq(4).text())
        };
    },
    
    /*
     * Should return [stop, ]
     */
    _getIterableStops : function(rawTimetable) {
        var $ = rawTimetable.cheerio,
            directionMapping = { base : rawTimetable.params.direction, used : {} };
            
        return $('h2').not($('h2').last()).map(function(_, h2) { 
            return {
                title : $(h2).text(),
                timetable : $(h2).closest('tr').next().find('table').find('td'),
                cheerio : $,
                directionMapping : directionMapping
            };
        }).toArray();
    },
    
    /*
     * Should return { title : , hours :  } 
     */
    _getStopData : function(stop) {
        var $ = stop.cheerio,
            timetable = {},
            curHour = 5;
        
        stop.timetable.each(function(_, td) {
            td = $(td);
            if(td.attr('align') == 'right') {
                curHour = td.find('.hour').text();
                if(curHour && +curHour < 4) { curHour = +curHour + 24; }
            }
            if(curHour && td.attr('align') == 'left') {
                timetable[curHour] = $(td).find('.minutes').toArray().map(function(min) {
                    var res = [$(min).text()],
                        color = $(min).css('color');
                    
                    if(color) {
                        if(!(color in stop.directionMapping.used)) {
                            stop.directionMapping.used[color] = String.fromCharCode(stop.directionMapping.base.charCodeAt(0) + 2 * (Object.keys(stop.directionMapping.used).length + 1));
                        }
                        res.push(stop.directionMapping.used[color]);
                    }
                    return res;
                });
            }
        });
        
        return {
            title : stop.title,
            hours : timetable
        }
    }
});

function callApi(url, params) {
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

function dateToNumbers(date) {
    var months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    
    return date
        .split(' ')
        .map(function(x) { return -~months.indexOf(x) || x; })
        .map(function(x) { return (''+x).length < 2? ('0' + x) : x; })
        .join('.');
}
