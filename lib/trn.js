var request = require('request-promise'),
    base64 = require('js-base64').Base64,
    extend = require('extend'),
    deepEqual = require('deep-equal'),
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

    getTimetableForDay : function(type, route, dow) {
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
            })
            .then(processTimetable);
    },

    getAllTimetables : function(type, route, compactify) {
        var usedDays = Array.apply([], Array(7)),
            res = { data : {} },
            that = this;

        return utils.repeatUntilTrue(function() {
            var firstEmpty = usedDays.indexOf();
            if(firstEmpty == -1) { return Promise.resolve(true); }

            return that.getTimetableForDay(type, route, firstEmpty).then(function(tts) {
                if(!tts) return true;
                var dow = tts.data? tts.data.dow : 1 << firstEmpty
            
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
            return compactify?
                compactifyAllTimetables(mergeDays(res)) :
                mergeDays(res);
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
    var first = timesForDayByDirection['A'] || timesForDayByDirection['B'],
        directions = {},
        res = {
            data : {
                dow : first.dow,
                source : 'trn',
                downloaded : +new Date(),
                valid : first.interval,
                stops : {}
            }
        };
        
    Object.keys(timesForDayByDirection).forEach(function(direction) {
        timesForDayByDirection[direction].schedule.forEach(function(stop, stopIndex) {
            splitStopIntoDirections(stop.planning, direction, direction + stopIndex, stop.title, directions);
        });
    });
    
    utils.each(directions, function(timesForDirection, direction) {
        sortStops(timesForDirection);
        res.data.stops[direction] = timesForDirection.map(function(stop) {
            return stop.title;
        });
        res[direction] = timesForDirection.map(function(stop) {
            return stop.hours;
        });
    });

    return res;
}

function sortStops(timesForDirection) {
    timesForDirection.sort(function(a, b) {
        var flatA = flattenTimetable(a.hours),
            flatB = flattenTimetable(b.hours);
            
        var i = 0,
            delta = 0;
        while (i < flatA.length && !delta) {
            delta = flatA[i] - flatB[i];
            i++;
        }
        return delta;
    });
}

function mergeDays(res) {
    var resStops = {};

    utils.each(res, function(timetableForDow, dow) {
        if(!timetableForDow.data) return;
        utils.each(timetableForDow.data.stops, function(stopsForDirection, direction) {
            if(!resStops[direction]) {
                resStops[direction] = stopsForDirection;
            }
            if(!deepEqual(stopsForDirection, resStops[direction])) {
                resStops['' + direction + dow] = stopsForDirection;
                timetableForDow['' + direction + dow] = timetableForDow[direction];
                delete timetableForDow[direction];
            }
        });
        delete timetableForDow.data.stops;
        delete timetableForDow.data.dow;
    });
    (res.data || (res.data = {})).stops = resStops;

    return res;
}

function splitStopIntoDirections(timesForStopByHour, direction, stopId, stopTitle, directions) {
    utils.each(timesForStopByHour, function(mins, hour) {
        mins.forEach(function(min) {
            var minNum = +('' + min[0]).replace(/^0/, ''),
                trueDirection = min[1] || direction,
                directionStop = (directions[trueDirection] || (directions[trueDirection] = [])).filter(function(item) { 
                    return item.id == stopId;
                })[0];
            
            if(!directionStop) {
                directionStop = { 
                    id : stopId,
                    title : stopTitle,
                    hours : {}
                };
                directions[trueDirection].push(directionStop);
            }
            (directionStop.hours[hour] || (directionStop.hours[hour] = [])).push(minNum);
        });
    });
}

function flattenTimetable(stop) {
    return Object.keys(stop).reduce(function(flat, hour) { 
        return flat.concat(stop[hour].map(function(min) { return 60 * hour + min; }));
    }, []);
}

function compactifyTimetable(timetableForDirection) {
    return timetableForDirection.map(flattenTimetable).map(function(stop, i, stops) {
        return i == 0?
            utils.deltifyArray(stop) : 
            stop.map(function(min, j) {
                return min - stops[i - 1][j];
            });
    }).map(utils.compactifyArray);
}

function compactifyStops(stopsByDirection) {
    var titles = [],
        directions = utils.map(stopsByDirection, function(stopsForDirection) {
            return utils.compactifyArray(utils.deltifyArray(stopsForDirection.map(function(stopTitle) {
                var index = titles.indexOf(stopTitle);
                return index == -1?
                    titles.push(stopTitle) - 1 :
                    index;
            })));
        });
    return { titles : titles, stops : directions };
}

function compactifyAllTimetables(timetablesByDay) {
    return utils.map(timetablesByDay, function(data, key) {
        return key == 'data'?
            extend(data, compactifyStops(data.stops)) :
            utils.map(data, function(direction, key) {
                return key == 'data'? 
                    direction :
                    compactifyTimetable(direction);
            });
    })
}
