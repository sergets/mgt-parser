var timetable = require('./lib/trn.js'),
    express = require('express'),
    app = express();

app.set('port', (process.env.PORT || 5000));

app.get('/', function(request, response) {
    response.json({ ok : true });
});

app.get('/:type/:route', function(request, response) {
    timetable.getId(request.params.type, request.params.route)
        .then(function(id) {
            return timetable.getAllTimetables(id);
        })
        .then(response.json.bind(response));

});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});


