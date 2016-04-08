var request = require('request-promise'),
    compactifier = require('./compactifier.js');
    
var BASE_URL = 'https://cloud-api.yandex.net/v1/disk/resources',
    TOKEN = process.env.YADISK_OAUTH_TOKEN;

module.exports = {
    save : function(path, content) {
        return callApi('upload', {
            path : 'app:/' + path,
            overwrite : true
        }).then(function(res) { 
            return request({
                uri : res.href,
                method : 'PUT',
                body : content
            });
        });
    },
    
    getData : function(path) {
        return callApi('', {
            path : 'app:/' + path
        }).then(function(r) { console.log(r); return r; }, function(e) { console.log(e); return { error: '' + e }; });
    },
    
    read : function(path) { 
        return callApi('download', {
            path : 'app:/' + path
        }).then(function(res) { 
            return request({
                uri : res.href,
                method : res.method
            });
        });
    }
}

function callApi(method, query) {
    return request({
        uri : [BASE_URL, method].filter(Boolean).join('/'),
        headers : {
            'Authorization' : 'OAuth ' + TOKEN
        },
        qs : query
    });
}
