var timetable = require('./lib/pass3.js'),
    compactifier = require('./lib/compactifier.js'),
    yadisk = require('./lib/yadisk.js'),
    express = require('express'),
    app = express();

var DELTA = 60000,
    TYPES = ['tram', 'troll', 'bus'];

function logEvent(msg) {
    yadisk.read('log.json').then(function(log) {
        log.push({ date : +new Date(), event : msg });
        return log;
    }, function() {
        return [{ date : +new Date(), event : msg }];
    }).then(function(log) {
        yadisk.save('log.json', log);
    });
}

function fetchTimetableFromServer(type, route) {
    return timetable.getAllTimetables(type, route)
        .then(function(res) {
            var file = type + '/' + route + '.json';
            yadisk.getData(file)
                .then(function(data) { return data.name && yadisk.read(file); })
                .then(function(cached) { 
                    if(!cached) {
                        logEvent({ event : 'created', type : type, route : route });
                        yadisk.save(file, compactifier.compactifyTimetables(res));
                    }
                    else if(Object.keys(cached).some(function(key) {
                        if (key == 'data') return; 
                        return (cached[key] && cached[key].data.valid) != (res[key] && res[key].data.valid);
                    })) {
                        logEvent({ event : 'updated', type : type, route : route });
                        yadisk.save(type + '/' + route +  '.' + (+new Date()) + '.old.json', cached);
                        yadisk.save(file, compactifier.compactifyTimetables(res));
                    }
                });
            return res;
        });
}

function fetchAllRoutes() {
    return Promise.all(TYPES.map(function(type) {
        return timetable.getAllRoutes(type);
    })).then(function(res) {
        return [].concat.apply([], res.map(function(typeRes, i) {
            return typeRes.map(function(typeRoute) {
                return { type : TYPES[i], route : typeRoute };
            });
        }));
    })
}

fetchAllRoutes().then(function(routes) {
    var i = 0;
    setInterval(function() {
        routes[i] && fetchTimetableFromServer(routes[i].type, routes[i].route);
        console.log('fetching ', JSON.stringify(routes[i]));
        if(i == routes.length) {
            fetchAllRoutes().then(function(rts) {
                routes = rts;
                i = 0;
            });
        }
        i++;
    }, DELTA);
});

app.set('port', (process.env.PORT || 5000));

app.get('/', function(request, response) {
    response.json({ ok : true });
});

app
    .get('/:type', function(request, response) {
        response.header('Access-Control-Allow-Origin', '*');
        timetable.getAllRoutes(request.params.type)
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/:type/:route', function(request, response) {
        var file = request.params.type + '/' + request.params.route + '.json';
        
        response.header('Access-Control-Allow-Origin', '*');
        yadisk.getData(file)
            .then(function(data) {
                return data.name?
                    yadisk.read(file).then(compactifier.decompactifyTimetables.bind(compactifier)) :
                    fetchTimetableFromServer(request.params.type, request.params.route);
            })    
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/:type/:route/original', function(request, response) {
        response.header('Access-Control-Allow-Origin', '*');
        timetable.getAllTimetables(type, route)
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/:type/:route/compact', function(request, response) {
        var file = request.params.type + '/' + request.params.route + '.json';
        
        response.header('Access-Control-Allow-Origin', '*');
        yadisk.getData(file)
            .then(function(data) { 
                return data.name?
                    yadisk.read(file) :
                    fetchTimetableFromServer(request.params.type, request.params.route).then(compactifier.compactifyTimetables.bind(compactifier));
            })
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    });

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});