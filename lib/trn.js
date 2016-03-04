var request = require('request-promise'),
    base64 = require('js-base64').Base64,
    extend = require('extend');
    utils = require('./utils.js');

var BASE_URL = 'http://moscow.office.transnavi.ru',
    API_URL = '/api/browser/',
    AUTH_HEADERS = {
        'Authorization' : 'Basic dHJuZ3Vlc3Q6dHJuZ3Vlc3Q=',
        'Referer' : BASE_URL + '/main.php'
    };

var cookies,
    routeIds = {};

module.exports = {
    getId : function(type, number) {
        if(routeIds[type]) {
            return Promise.resolve(routeIds[type][number]);
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
            return res[number];
        });
    },

    getTimetableForDay : function(routeId, dow) {
        var now = new Date(),
            lastSunday = new Date(+now - 86400 * 1000 * now.getDay()),
            ds = Array.apply([], Array(7)).map(function(d, i) { 
                var day = new Date(+lastSunday + 86400 * 1000 * (i + 1));
                return day.getFullYear() + '-' + (day.getMonth() + 1) + '-' + day.getDate();
            });

        return utils.all(['A', 'B'].reduce(function(all, dir) {
            all[dir] = callTrnApi('timetables', { 
                action : 'timetable',
                date : ds[dow],
                direction : dir,
                mr_id : routeId,
                st_id : 'all'
            });
            return all;
        }, {})).then(processTimetable);
    },

    getAllTimetables : function(routeId) {
        var usedDays = Array.apply([], Array(7)),
            res = {};

        return repeatUntilTrue(function() {
            var firstEmpty = usedDays.indexOf();
            if(firstEmpty == -1) { return Promise.resolve(true); }

            return this.getTimetableForDay(routeId, firstEmpty).then(function(tts) {
                if(!tts) return true;
                var firstDow = tts['A'] || tts['B'],
                    dow = firstDow? firstDow.data.dow : 1 << firstEmpty
            
                Object.keys(usedDays).forEach(function(day) {
                    if(dow & (1 << day)) {
                        usedDays[day] = true;
                    }
                });
                res[dow] = tts;
            });
        }).then(function() {
            return res;
        });
    }
}

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

function processTimetable(timesForDayByDirection) {
    var first = timesForDayByDirection['A'] || timesForDayByDirection['B'];

    return extend(
        {
            data : { dow : first.dow }
        },
        Object.keys(timesForDayByDirection).reduce(function(readyTimesForDayByDirection, direction) {
            timesForDayByDirection[direction] && timesForDayByDirection[direction].schedule && (readyTimesForDayByDirection[direction] = timesForDayByDirection[direction].schedule.reduce(function(readyTimesForDirection, stop) {
                readyTimesForDirection[stop.id] = map(stop.planning, function(timesForHour, hour) {
                    return timesForHour.map(function(mins) { 
                        var minsNum = +('' + mins[0]).replace(/^0/, '');
                        if(mins.length == 1) {
                            return minsNum;
                        }
                        else {
                            if(!readyTimesForDayByDirection[mins[1]]) { readyTimesForDayByDirection[mins[1]] = {}; }
                            if(!readyTimesForDayByDirection[mins[1]][stop.id]) { readyTimesForDayByDirection[mins[1]][stop.id] = {}; }
                            if(!readyTimesForDayByDirection[mins[1]][stop.id][hour]) { readyTimesForDayByDirection[mins[1]][stop.id][hour] = []; }
                            readyTimesForDayByDirection[mins[1]][stop.id][hour].push(minsNum);
                        }
                    }).filter(function(x) { return +x === x; });
                });
                return readyTimesForDirection;
            }, {}));
            return readyTimesForDayByDirection;
        }, {})
    );
}