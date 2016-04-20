# mgt-parser
A JSON proxy for http://mosgortrans.org/pass3
A working instance is at http://mgt-parser.herokuapp.com/

* http://mgt-parser.herokuapp.com/tram - list all trams
* http://mgt-parser.herokuapp.com/tram/28 - view timetable for tram 28
* http://mgt-parser.herokuapp.com/tram/28/compact - view compactified timetable for tram 28 (times are delta-coded)

Other types are `bus` and `troll`. Data is stored to a user's yandex.disk.

### timetable syntax

````js
{
    "31": {  // day of validity for each timetable, coded as bitmask (1 for monday, 2 for tuesday... 64 for sunday)
        "data": {
            "source" : "pass3",
            "downloaded" : 1460286541467,
            "valid" : "09.11.2015" // timetable is valid since this date
        },
        "A" : [ // Name of direction/thread. Generally, simple directions are "A" and "B", shortened are "C"/"D" etc.
                // If a direction's stop list differs for some day, day bitmask is added (e. g. "A" for working days /
                // "A96" for weekends) 
            {
                "7" : [5, 50], // times for first stop of direction: 7:05, 7:50, 8:45 etc.
                "8" : [45],
                "18" : [10] // after-midnight hours are coded as 24, 25, 26 and 27.
            },
            {
                "7" : [7, 53], // times for second stop of direction
                "8" : [48],
                "18" : [13]
            },
            // etc
        ],
        "B" : [
            // similar
        ],
        ...
    },
    "data" : {
        "stops" : { // description of directions
            "A" : [
                "Метро \"Калужская\" (к/ст, пос.)",
                "Метро \"Калужская\" (южн.)",
                // etc
            ],
            "B":[
                "ВКНЦ",
                "Проходная Ин-та им. Бакулева",
                // etc
            ]
        }
    }
}
````
