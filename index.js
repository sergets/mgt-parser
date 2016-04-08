var timetable = require('./lib/pass3.js'),
    compactifier = require('./lib/compactifier.js'),
    express = require('express'),
    app = express();

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
        timetable.getAllTimetables(request.params.type, request.params.route)
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    })
    .get('/:type/:route/compact', function(request, response) {
        timetable.getAllTimetables(request.params.type, request.params.route, true)
            .then(compactifier.compactifyTimetables)
            .then(response.json.bind(response))
            .catch(response.json.bind(response));
    });

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});


