var extend = require('extend'),
    deepEqual = require('deep-equal'),
    utils = require('./utils.js');

module.exports = {
    getAllRoutes : function(type) {
        return Promise.reject({ error : 'Not implemented' });
    },

    _loadTimetableForDay : function(type, route, dow) {
        return Promise.reject({ error : 'Not implemented' });
    },

    /*
     * Should resolve with { data : { dow : <bitmask>, stops : { 'A' : [...], ... } }, 'A' : [ { 5 : [], 6 : [], ...}, ... ], ... }
     */
    getTimetableForDay : function(type, route, dow) {
        return this._loadTimetableForDay(type, route, dow).then(this._processTimetable, this);
    },

    _loadAllTimetables : function(type, route) {
        var usedDays = Array.apply([], Array(7)),
            res = { data : {} },
            that = this;

        return utils.repeatUntilTrue(function() {
            var firstEmpty = usedDays.indexOf();
            if(firstEmpty == -1) { return Promise.resolve(true); }

            return that._loadTimetableForDay(type, route, firstEmpty).then(function(tts) {
                console.log('-->  tts is ', JSON.stringify(tts).substr(0, 500));
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
            return res;
        });
    },
    
    /*
     * Should resolve with { { data : { stops : { 'A' : [...], ... } }, <bitmask> : { 'A' : [ { 5 : [], 6 : [], ...}, ... ], ... } } }
     */
    getAllTimetables : function(type, route, compactify) {
        var p = null;
        return this._loadAllTimetables(type, route)
            .then(function(res) {
                return utils.map(res, this._processTimetable, this);
            }.bind(this))
            .then(this._mergeDays.bind(this))
            .then(compactify? this._compactifyAllTimetables.bind(this) : function(res) { return res; });
    },
    
    /*
     * Should return { dow : , source : , downloaded : , valid : } 
     */
    _getDataFromRawTimetable : function() {
        throw { error : 'Not implemented' };
    },
    
    /*
     * Should return [stop, stop, ...]
     */
    _getIteratableStops : function() {
        throw { error : 'Not implemented' };
    },
    
    /*
     * Should return { title : , hours :  } 
     */
    _getStopData : function() {
        throw { error : 'Not implemented' };
    },
    
    _processTimetable : function(rawTimetableForDayByDirection) {
        var first = rawTimetableForDayByDirection[Object.keys(rawTimetableForDayByDirection)[0]],
            directions = {},
            res = {
                data : extend(first? this._getDataFromRawTimetable(first) : {}, { stops : {} })
            };
            
        utils.each(rawTimetableForDayByDirection, function(rawTimetable, direction) {
            this._getIteratableStops(rawTimetable).forEach(function(stop, stopIndex) {
                this._splitStopIntoDirections(this._getStopData(stop), direction, direction + stopIndex, directions);
            }, this);
        }, this);
        
        utils.each(directions, function(timesForDirection, direction) {
            this._sortStops(timesForDirection);

            res.data.stops[direction] = timesForDirection.map(function(stop) {
                return stop.title;
            });
            res[direction] = timesForDirection.map(function(stop) {
                return stop.hours;
            });
        }, this);
    
        return res;
    },
    
    _splitStopIntoDirections : function(stopData, direction, stopId, directions) {
        utils.each(stopData.hours, function(mins, hour) {
            mins.forEach(function(min) {
                var minNum = +('' + min[0]).replace(/^0/, ''),
                    trueDirection = min[1] || direction,
                    directionStop = (directions[trueDirection] || (directions[trueDirection] = [])).filter(function(item) { 
                        return item.id == stopId;
                    })[0];
                
                if(!directionStop) {
                    directionStop = { 
                        id : stopId,
                        title : stopData.title,
                        hours : {}
                    };
                    directions[trueDirection].push(directionStop);
                }
                (directionStop.hours[hour] || (directionStop.hours[hour] = [])).push(minNum);
            });
        });
    },
    
    _sortStops : function(timesForDirection) {
        timesForDirection.sort(function(a, b) {
            var flatA = this.flattenTimetable(a.hours),
                flatB = this.flattenTimetable(b.hours);
                
            var i = 0,
                delta = 0;
            while (i < flatA.length && !delta) {
                delta = flatA[i] - flatB[i];
                i++;
            }
            return delta;
        }.bind(this));
    },

    _mergeDays : function(res) {
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
    },

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

    _compactifyAllTimetables : function(timetablesByDay) {
        return utils.map(timetablesByDay, function(data, key) {
            return key == 'data'?
                extend(data, this._compactifyStops(data.stops)) :
                utils.map(data, function(direction, key) {
                    return key == 'data'? 
                        direction :
                        this.compactifyTimetable(direction);
                }, this);
        }, this)
    }
};
