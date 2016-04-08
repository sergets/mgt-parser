var timetable = require('./lib/pass3.js'),
    compactifier = require('./lib/compactifier.js'),
    yadisk = require('./lib/yadisk.js'),
    express = require('express'),
    app = express();

var DELTA = 20000;

function fetchTimetableFromServer(type, route) {
    return timetable.getAllTimetables(type, route)
        .then(function(res) { 
            return yadisk.save(
                type + '/' + route + '.json',
                JSON.stringify(compactifier.compactifyTimetables(res))
            ).then(function() {
                return res;
            });
        });
}

timetable.getAllRoutes('troll').then(function(routes) {
    var i = 0;
    setInterval(function() {
        routes[i] && fetchTimetableFromServer('troll', routes[i]);
        console.log('// fetching ', routes[i]);
        if(i == routes.length) {
            timetable.getAllRoutes('troll').then(function(rts) {
                routes = rts;
                i = 0;
            });
        }
    }, DELTA);
});

/*var i = 0;

setInterval(function() {
    console.log('scheduled action #' + (i++));
}, 5000);*/

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
                    yadisk.read(file).then(JSON.parse) :
                    fetchTimetableFromServer(request.params.type, request.params.route);
            })      
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/:type/:route/compact', function(request, response) {
        timetable.getAllTimetables(request.params.type, request.params.route, true)
            .then(compactifier.compactifyTimetables.bind(compactifier))
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/disk', function(request, response) {
        yadisk.getData('bus')
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});


