var timetable = require('./lib/pass3.js'),
    compactifier = require('./lib/compactifier.js'),
    yadisk = require('./lib/yadisk.js'),
    express = require('express'),
    app = express();

var DELTA = 15000;

function fetchTimetableFromServer(type, route) {
    return timetable.getAllTimetables(type, route)
        .then(function(res) { 
            return yadisk.save(
                type + '/' + route + '.json',
                compactifier.compactifyTimetables(res)
            ).then(function() {
                return res;
            });
        });
}

timetable.getAllRoutes('bus').then(function(routes) {
    var i = 0;
    setInterval(function() {
        routes[i] && fetchTimetableFromServer('bus', routes[i]);
        console.log('// fetching ', routes[i]);
        if(i == routes.length) {
            timetable.getAllRoutes('bus').then(function(rts) {
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
        timetable.getAllRoutes(request.params.type)
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/:type/:route', function(request, response) {
        var file = request.params.type + '/' + request.params.route + '.json';
        
        yadisk.getData(file)
            .then(function(data) { return new Date() - new Date(data.modified) < 1000 * 86400 * 7; })
            .then(function(isNewEnough) {
                return isNewEnough?
                    yadisk.read(file).then(compactifier.decompactifyTimetables.bind(compactifier)) :
                    fetchTimetableFromServer(request.params.type, request.params.route);
            })      
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/:type/:route/original', function(request, response) {
        fetchTimetableFromServer(request.params.type, request.params.route)  
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/:type/:route/compact', function(request, response) {
        var file = request.params.type + '/' + request.params.route + '.json';
        
        yadisk.getData(file)
            .then(function(data) { return new Date() - new Date(data.modified) < 1000 * 86400 * 7; })
            .then(function(isNewEnough) {
                return isNewEnough?
                    yadisk.read(file) :
                    fetchTimetableFromServer(request.params.type, request.params.route).then(compactifier.compactifyTimetables.bind(compactifier));
            })      
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    });

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});


