var extend = require('extend'),
    utils = require('./utils.js');

module.exports = {
    flattenTimetable : function(stop) {
        return Object.keys(stop).reduce(function(flat, hour) { 
            return flat.concat(stop[hour].map(function(min) { return 60 * hour + min; }));
        }, []);
    },

    compactifyTimetable : function(timetableForDirection) {
        return timetableForDirection.map(this.flattenTimetable, this).map(function(stop, i, stops) {
            return i == 0?
                utils.deltifyArray(stop) : 
                stop.map(function(min, j) {
                    return min - stops[i - 1][j];
                });
        }).map(utils.compactifyArray);
    },
    
    decompactifyTimetable : function(timetableForDirection) {
        return timetableForDirection.map(decompactifyArray).map(function(stop, i, stops) {
            return i == 0?
                utils.dedeltifyArray(stop) : 
                stop.map(function(min, j) {
                    return stops[i - 1][j] + min;
                });
        });
    },

    _compactifyStops : function(stopsByDirection) {
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
    },
    
    _decompactifyStops : function(titles, stops) {
        return utils.map(stops, function(stopsForDirection) {
            return utils.dedeltifyArray(utils.decompactifyArray(stopsForDirection)).map(function(stopTitleIndex) {
                return titles[stopTitleIndex];
            });
        });
    },

    compactifyTimetables : function(timetablesByDay) {
        return utils.map(timetablesByDay, function(data, key) {
            return key == 'data'?
                extend(data, this._compactifyStops(data.stops)) :
                utils.map(data, function(direction, key) {
                    return key == 'data'? 
                        direction :
                        this.compactifyTimetable(direction);
                }, this);
        }, this);
    },
    
    decompactifyTimetables : function(timetablesByDay) {
        var stopsByDirection = {};
        return utils.map(timetablesByDay, function(data, key) {
            if(key == 'data') {
                data.stops = this._decompactifyStops(data.titles, data.stops);
                delete data.titles;
                delete data.stops;
                return data;
            }
            else {
                return utils.map(data, function(direction, key) {
                    return key == 'data'? 
                        direction :
                        this.decompactifyTimetable(direction);
                }, this);
            }
        }, this);
    }    
};
