var timetable = require('./lib/pass3.js'),
    compactifier = require('./lib/compactifier.js'),
    yadisk = require('./lib/yadisk.js'),
    express = require('express'),
    app = express();

var DELTA = 15000;

function fetchTimetableFromServer(type, route) {
    return timetable.getAllTimetables(type, route)
        .then(function(res) {
            var file = type + '/' + route + '.json';
            yadisk.getData(file)
                .then(function(data) { console.log('already having file' + data && data.name + 'at ydisk'); return data.name && yadisk.read(file); })
                .then(function(cached) { 
                    if(!cached || Object.keys(cached).some(function(key) {
                        if (key == 'data') return; 
                        return (cached[key] && cached[key].data.valid) != (res[key] && res[key].data.valid);
                    })) {
                        console.log('updated ' + type + ' #' + route + ': was ' + Object.keys(cached).filter(function(key) { return key !== 'data'; }).map(function(key) { return cached[key] && cached[key].data.valid }) + ', became: ' + Object.keys(res).filter(function(key) { return key !== 'data'; }).map(function(key) { return res[key] && res[key].data.valid }));
                        return yadisk.save(compactifier.compactifyTimetables(res));
                    }
                    else {
                        console.log('not updating ' + type + ' #' + route);
                    }
                });
            return res;
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


