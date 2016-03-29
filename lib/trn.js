var request = require('request-promise'),
    base64 = require('js-base64').Base64,
    extend = require('extend'),
    deepEqual = require('deep-equal'),
    utils = require('./utils.js'),
    timetable = require('./timetable.js');

var BASE_URL = 'http://moscow.office.transnavi.ru',
    API_URL = '/api/browser/',
    AUTH_HEADERS = {
        'Authorization' : 'Basic dHJuZ3Vlc3Q6dHJuZ3Vlc3Q=',
        'Referer' : BASE_URL + '/main.php'
    };

var cookies,
    routeIds = {};
    
module.exports = extend({}, timetable, {
    getAllRoutes : function(type) {
        if(routeIds[type]) {
            return Promise.resolve(Object.keys(routeIds[type]));
        }
        return callApi('timetables', {
            action : 'routes',
            type : { 'bus' : 1, 'troll' : 2, 'tram' : 3 }[type],
            okato : 'all',
            'route-type' : 'all' 
        }).then(function(list) {
            var res = list.reduce(function(routes, route) {
                routes[route.mr_num[0] + route.mr_num.substr(1).toLowerCase()] = route.mr_id;
                return routes;
            }, {});
            routeIds[type] = res;
            return Object.keys(routeIds[type]);
        })
    },
    
    _loadTimetableForDay : function(type, route, dow) {
        var now = new Date(),
            lastSunday = new Date(+now - 86400 * 1000 * now.getDay()),
            ds = Array.apply([], Array(7)).map(function(d, i) { 
                var day = new Date(+lastSunday + 86400 * 1000 * (i + 1));
                return day.getFullYear() + '-' + (day.getMonth() + 1) + '-' + day.getDate();
            });

        return this.getAllRoutes(type)
            .then(function() {
                var id = routeIds[type][route];
                if(!id) {
                    return Promise.reject({ error : 'no route found' });
                }
                return utils.all(['A', 'B'].reduce(function(all, dir) {
                    all[dir] = callApi('timetables', { 
                        action : 'timetable',
                        date : ds[dow],
                        direction : dir,
                        mr_id : routeIds[type][route],
                        st_id : 'all'
                    });
                    return all;
                }, {}))
            });
    },
    
    _loadAllTimetables : function(type, route) {
        var usedDays = Array.apply([], Array(7)),
            res = {},
            that = this;

        return utils.repeatUntilTrue(function() {
            var firstEmpty = usedDays.indexOf();
            if(firstEmpty == -1) { return Promise.resolve(true); }

            return that._loadTimetableForDay(type, route, firstEmpty).then(function(tts) {
                var firstDirection = tts[Object.keys(tts)[0]],
                    dow = firstDirection? firstDirection.dow : 1 << firstEmpty
            
                Object.keys(usedDays).forEach(function(day) {
                    if(dow & (1 << day)) {
                        usedDays[day] = true;
                    }
                });
                res[dow] = tts;
            }, function() {
                return true;
            });
        }).then(function() {
            return res;
        });
    },
    
    /*
     * Should return { dow : , source : , downloaded : , valid : } 
     */
    _getDataFromRawTimetable : function(rawTimetable) {
        return {
            dow : rawTimetable.dow,
            source : 'trn',
            downloaded : +new Date(),
            valid : rawTimetable.interval
        };
    },
    
    /*
     * Should return [stop, ]
     */
    _getIterableStops : function(rawTimetable) {
        return (rawTimetable && rawTimetable.schedule) || [];
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

function addSomeSugar(a) {
    if (!a) return "-";
    if (a.charAt(a.length - 1) + a.charAt(a.length - 2) + a.charAt(a.length - 3) == "key") {
        var b = base64.decode("MEFiQ2RFZkdoSmtMbU9wcVJzVHVWVw==").split(""),
            c = base64.decode("ITw+QCcjLiQlP14mKigpXy1dW317fA==").split(""),
            d = a.split("");
        d.length = d.length - 3;
        for (var e = d.length; e--;)
            for (var f = b.length; f--;) d[e] == c[f] && (d[e] = b[f]);
        return base64.decode(d.join(""))
    }
    return a;
}

function init() {
    if(cookies) {
        return Promise.resolve();
    }
    return request(BASE_URL, { 
        headers : AUTH_HEADERS,
        resolveWithFullResponse: true
    }).then(function(res) {
        cookies = res.headers['set-cookie'].map(function(cookie) {
            return cookie.split(';')[0];
        }).join('; ');
    });
}

function callApi(method, query) {
    return init()
            .then(function() {
                return request(BASE_URL + API_URL + method + '.php', {
                    qs : query,
                    headers : extend({ 'Cookie' : cookies }, AUTH_HEADERS)
                });
            })
            .then(addSomeSugar)
            .then(JSON.parse);
}
